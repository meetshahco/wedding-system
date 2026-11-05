import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { CreateAccessLevelSchema } from "@/lib/zod-schemas";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const accessLevels = await prisma.accessLevel.findMany({
      where: { weddingId: wedding.id },
      include: {
        events: {
          include: {
            event: true,
          },
        },
        _count: {
          select: { guests: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ accessLevels });
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
    const parsed = CreateAccessLevelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, eventIds } = parsed.data;

    // Check unique name per wedding
    const existing = await prisma.accessLevel.findUnique({
      where: { weddingId_name: { weddingId: wedding.id, name } },
    });

    if (existing) {
      return NextResponse.json(
        { error: `An access level named '${name}' already exists for this wedding` },
        { status: 409 }
      );
    }

    // Filter eventIds to ensure they belong to this wedding
    let validEventIds: string[] = [];
    if (eventIds && eventIds.length > 0) {
      const dbEvents = await prisma.event.findMany({
        where: { id: { in: eventIds }, weddingId: wedding.id },
        select: { id: true },
      });
      validEventIds = dbEvents.map((e) => e.id);
    }

    const accessLevel = await prisma.$transaction(async (tx) => {
      const created = await tx.accessLevel.create({
        data: {
          weddingId: wedding.id,
          name,
        },
      });

      if (validEventIds.length > 0) {
        await tx.accessLevelEvent.createMany({
          data: validEventIds.map((eventId) => ({
            accessLevelId: created.id,
            eventId,
          })),
        });
      }

      return tx.accessLevel.findUnique({
        where: { id: created.id },
        include: {
          events: {
            include: { event: true },
          },
          _count: {
            select: { guests: true },
          },
        },
      });
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "ACCESS_LEVEL_CREATED",
      details: { accessLevelId: accessLevel?.id, name, eventCount: validEventIds.length },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ accessLevel }, { status: 201 });
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
