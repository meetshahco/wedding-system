import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { autoSplitGuests } from "@/lib/sender-tools";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const body = await req.json().catch(() => null);
    const senderIds = Array.isArray(body?.senderIds) ? body.senderIds : [];
    const guestIds = Array.isArray(body?.guestIds) ? body.guestIds : undefined;
    const unassignedOnly = body?.unassignedOnly !== false;

    if (senderIds.length === 0) {
      return NextResponse.json(
        { error: "At least one sender ID is required for auto-split" },
        { status: 400 }
      );
    }

    const result = await autoSplitGuests({
      weddingId: wedding.id,
      senderIds,
      guestIds,
      unassignedOnly,
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "GUESTS_AUTO_SPLIT",
      details: {
        sendersCount: senderIds.length,
        guestsAssigned: result.splitCount,
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

