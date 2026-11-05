import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { generateSenderAccessToken } from "@/lib/sender-tools";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const senders = await prisma.sender.findMany({
      where: { weddingId: wedding.id },
      include: {
        _count: {
          select: { guests: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ senders });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : null;
    const pin = typeof body?.pin === "string" ? body.pin.trim() : null;
    const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
    const messageOverride = typeof body?.messageOverride === "string" ? body.messageOverride.trim() : null;

    if (!name) {
      return NextResponse.json({ error: "Sender name is required" }, { status: 400 });
    }

    const accessToken = generateSenderAccessToken();

    const sender = await prisma.sender.create({
      data: {
        weddingId: wedding.id,
        name,
        phone,
        accessToken,
        pin: pin || null,
        expiresAt,
        messageOverride: messageOverride || null,
      },
      include: {
        _count: { select: { guests: true } },
      },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "SENDER_CREATED",
      details: { senderId: sender.id, name: sender.name },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ sender }, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
