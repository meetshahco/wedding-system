import { NextRequest, NextResponse } from "next/server";
import { prisma, ensurePragmas } from "@/lib/prisma";
import { CreateGuestSchema } from "@/lib/zod-schemas";
import { normalisePhone } from "@/lib/phone";
import { generateUniqueCode, generateUniqueToken } from "@/lib/token";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  await ensurePragmas();

  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim() || "";
  const city = searchParams.get("city")?.trim() || "";
  const accessLevelId = searchParams.get("accessLevelId")?.trim() || "";
  const inviteStatus = searchParams.get("inviteStatus")?.trim() || "";
  const rsvpStatus = searchParams.get("rsvpStatus")?.trim() || "";

  // Build where filter
  const where: Prisma.GuestWhereInput = {};

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { phone: { contains: q } },
      { code: { contains: q } },
      { city: { contains: q } },
    ];
  }

  if (city) {
    where.city = city;
  }

  if (accessLevelId) {
    if (accessLevelId === "unassigned") {
      where.accessLevelId = null;
    } else {
      where.accessLevelId = accessLevelId;
    }
  }

  if (inviteStatus) {
    where.inviteStatus = inviteStatus as Prisma.EnumInviteStatusFilter;
  }

  if (rsvpStatus) {
    if (rsvpStatus === "attending") {
      where.rsvps = { some: { status: "attending" } };
    } else if (rsvpStatus === "declined") {
      where.rsvps = { some: { status: "declined" } };
    } else if (rsvpStatus === "pending") {
      where.rsvps = { none: {} };
    }
  }

  const [guests, allGuests] = await Promise.all([
    prisma.guest.findMany({
      where,
      include: {
        accessLevel: { select: { id: true, name: true } },
        rsvps: {
          select: {
            id: true,
            eventId: true,
            status: true,
            paxAttending: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.guest.findMany({
      select: {
        id: true,
        pax: true,
        city: true,
      },
    }),
  ]);

  // Distinct cities for filter dropdown
  const cities = Array.from(
    new Set(allGuests.map((g) => g.city).filter(Boolean))
  ).sort();

  const totalGuests = allGuests.length;
  const totalPax = allGuests.reduce((acc, curr) => acc + curr.pax, 0);

  // Filtered totals
  const filteredGuests = guests.length;
  const filteredPax = guests.reduce((acc, curr) => acc + curr.pax, 0);

  return NextResponse.json({
    guests,
    cities,
    totals: {
      totalGuests,
      totalPax,
      filteredGuests,
      filteredPax,
    },
  });
}

export async function POST(req: NextRequest) {
  await ensurePragmas();

  const body = await req.json().catch(() => null);
  const parsed = CreateGuestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { name, phone, city, pax } = parsed.data;

  // Normalise phone number to E.164
  const normalisedPhone = normalisePhone(phone);
  if (!normalisedPhone) {
    return NextResponse.json(
      { error: "Invalid phone number format. Please provide a valid phone number." },
      { status: 400 }
    );
  }

  // Check for duplicate phone in database
  const existing = await prisma.guest.findUnique({
    where: { phone: normalisedPhone },
  });

  if (existing) {
    return NextResponse.json(
      { error: `A guest with phone ${normalisedPhone} already exists (${existing.name}).` },
      { status: 409 }
    );
  }

  const [token, code] = await Promise.all([
    generateUniqueToken(),
    generateUniqueCode(),
  ]);

  const guest = await prisma.guest.create({
    data: {
      name,
      phone: normalisedPhone,
      city: city || "",
      pax: pax ?? 1,
      token,
      code,
    },
    include: {
      accessLevel: true,
    },
  });

  return NextResponse.json({ guest }, { status: 201 });
}

