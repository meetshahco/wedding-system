import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { generateSenderAccessToken } from "@/lib/sender-tools";
import { logAuditEvent } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
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

    const newAccessToken = generateSenderAccessToken();

    const updated = await prisma.sender.update({
      where: { id },
      data: {
        accessToken: newAccessToken,
        revokedAt: null, // Clear revocation on regeneration
      },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "SENDER_TOKEN_REGENERATED",
      details: { senderId: id, name: updated.name },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ sender: updated, accessToken: newAccessToken });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
