import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const sender = await prisma.sender.findFirst({
      where: { id, weddingId: wedding.id },
      include: {
        guests: {
          select: {
            id: true,
            name: true,
            phone: true,
            city: true,
            pax: true,
            group: true,
            inviteStatus: true,
            code: true,
            token: true,
          },
          orderBy: { name: "asc" },
        },
        _count: { select: { guests: true } },
      },
    });

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    return NextResponse.json({ sender });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const existing = await prisma.sender.findFirst({
      where: { id, weddingId: wedding.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const { name, phone, pin, expiresAt, messageOverride } = body || {};

    const updated = await prisma.sender.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        ...(pin !== undefined && { pin: pin ? pin.trim() : null }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(messageOverride !== undefined && { messageOverride: messageOverride ? messageOverride.trim() : null }),
      },
      include: {
        _count: { select: { guests: true } },
      },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "SENDER_UPDATED",
      details: { senderId: id, name: updated.name },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ sender: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const existing = await prisma.sender.findFirst({
      where: { id, weddingId: wedding.id },
      include: { _count: { select: { guests: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    // Delete sender; guests have senderId set to null via SetNull cascade
    await prisma.sender.delete({
      where: { id },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "SENDER_DELETED",
      details: { senderId: id, name: existing.name, unassignedGuests: existing._count.guests },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, unassignedGuests: existing._count.guests });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
