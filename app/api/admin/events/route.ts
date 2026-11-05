import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { CreateEventSchema } from "@/lib/zod-schemas";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const events = await prisma.event.findMany({
      where: { weddingId: wedding.id },
      include: {
        accessLevels: {
          include: {
            accessLevel: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { date: "asc" }],
    });

    return NextResponse.json({
      events,
      wedding: {
        id: wedding.id,
        slug: wedding.slug,
        coupleName1: wedding.coupleName1,
        coupleName2: wedding.coupleName2,
        weddingDate: wedding.weddingDate,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const body = await req.json().catch(() => null);
    const parsed = CreateEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, date, startTime, venue, address, mapUrl, dressCode, description, sortOrder } =
      parsed.data;

    const event = await prisma.event.create({
      data: {
        weddingId: wedding.id,
        name,
        date: new Date(date),
        startTime,
        venue,
        address,
        mapUrl: mapUrl || "",
        dressCode: dressCode || "",
        description: description || "",
        sortOrder: sortOrder ?? 0,
      },
      include: {
        accessLevels: {
          include: {
            accessLevel: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "EVENT_CREATED",
      details: { eventId: event.id, name: event.name },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

