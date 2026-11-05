import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { CreateGuestSchema } from "@/lib/zod-schemas";
import { normalisePhone } from "@/lib/phone";
import { generateUniqueCode, generateUniqueToken } from "@/lib/token";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { wedding, scoped } = await getWeddingContext(req);

  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim() || "";
  const city = searchParams.get("city")?.trim() || "";
  const accessLevelId = searchParams.get("accessLevelId")?.trim() || "";
  const inviteStatus = searchParams.get("inviteStatus")?.trim() || "";

  // Build where filter scoped to wedding
  const where: Prisma.GuestWhereInput = {};

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
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

  const [guests, allGuests] = await Promise.all([
    scoped.guest.findMany({
      where,
      include: {
        accessLevel: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    scoped.guest.findMany({
      select: {
        id: true,
        pax: true,
        city: true,
      },
    }),
  ]) as [
    Array<{ id: string; pax: number; city: string; [key: string]: unknown }>,
    Array<{ id: string; pax: number; city: string }>
  ];

  const cities = Array.from(
    new Set(allGuests.map((g) => g.city).filter(Boolean))
  ).sort();

  const totalGuests = allGuests.length;
  const totalPax = allGuests.reduce((acc, curr) => acc + curr.pax, 0);

  const filteredGuests = guests.length;
  const filteredPax = guests.reduce((acc, curr) => acc + curr.pax, 0);

  return NextResponse.json({
    wedding: {
      id: wedding.id,
      slug: wedding.slug,
      coupleName1: wedding.coupleName1,
      coupleName2: wedding.coupleName2,
    },
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
  const { wedding, scoped } = await getWeddingContext(req);

  const body = await req.json().catch(() => null);
  const parsed = CreateGuestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { name, phone, city, pax, accessLevelId } = parsed.data;

  const normalisedPhone = normalisePhone(phone);
  if (!normalisedPhone) {
    return NextResponse.json(
      { error: "Invalid phone number format. Please provide a valid phone number." },
      { status: 400 }
    );
  }

  // Check for duplicate phone in this wedding
  const existing = (await scoped.guest.findFirst({
    where: { phone: normalisedPhone },
  })) as { name: string } | null;

  if (existing) {
    return NextResponse.json(
      { error: `A guest with phone ${normalisedPhone} already exists in this wedding (${existing.name}).` },
      { status: 409 }
    );
  }

  const [token, code] = await Promise.all([
    generateUniqueToken(),
    generateUniqueCode(wedding.id),
  ]);

  const guest = await scoped.guest.create({
    data: {
      name,
      phone: normalisedPhone,
      city: city || "",
      pax: pax ?? 1,
      accessLevelId: accessLevelId || null,
      token,
      code,
    },
    include: {
      accessLevel: true,
    },
  });

  return NextResponse.json({ guest }, { status: 201 });
}
