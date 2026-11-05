import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { UpdateAccessLevelSchema } from "@/lib/zod-schemas";
import { logAuditEvent } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const accessLevel = await prisma.accessLevel.findFirst({
      where: { id, weddingId: wedding.id },
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
    });

    if (!accessLevel) {
      return NextResponse.json({ error: "Access level not found" }, { status: 404 });
    }

    return NextResponse.json({ accessLevel });
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

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const existing = await prisma.accessLevel.findFirst({
      where: { id, weddingId: wedding.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Access level not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = UpdateAccessLevelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, eventIds } = parsed.data;

    if (name && name !== existing.name) {
      const duplicate = await prisma.accessLevel.findUnique({
        where: { weddingId_name: { weddingId: wedding.id, name } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `An access level named '${name}' already exists for this wedding` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (name) {
        await tx.accessLevel.update({
          where: { id },
          data: { name },
        });
      }

      if (eventIds !== undefined) {
        // Remove existing associations
        await tx.accessLevelEvent.deleteMany({
          where: { accessLevelId: id },
        });

        // Validate eventIds belong to this wedding
        if (eventIds.length > 0) {
          const dbEvents = await tx.event.findMany({
            where: { id: { in: eventIds }, weddingId: wedding.id },
            select: { id: true },
          });

          if (dbEvents.length > 0) {
            await tx.accessLevelEvent.createMany({
              data: dbEvents.map((e) => ({
                accessLevelId: id,
                eventId: e.id,
              })),
            });
          }
        }
      }

      return tx.accessLevel.findUnique({
        where: { id },
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
      action: "ACCESS_LEVEL_UPDATED",
      details: { accessLevelId: id, name: updated?.name },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ accessLevel: updated });
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

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const existing = await prisma.accessLevel.findFirst({
      where: { id, weddingId: wedding.id },
      include: {
        _count: { select: { guests: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Access level not found" }, { status: 404 });
    }

    // Cascade deletes AccessLevelEvent; Guest.accessLevelId is set to NULL automatically by Prisma
    await prisma.accessLevel.delete({
      where: { id },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "ACCESS_LEVEL_DELETED",
      details: { accessLevelId: id, name: existing.name, affectedGuests: existing._count.guests },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, affectedGuests: existing._count.guests });
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

