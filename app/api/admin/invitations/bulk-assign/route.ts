import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { bulkAssignGuests } from "@/lib/invitation-service";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.guestIds) || body.guestIds.length === 0) {
      return NextResponse.json({ error: "guestIds array is required" }, { status: 400 });
    }

    const updatedCount = await bulkAssignGuests({
      weddingId: wedding.id,
      guestIds: body.guestIds,
      accessLevelId: body.accessLevelId,
      senderId: body.senderId,
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "invitations.bulk_assign",
      details: {
        updatedCount,
        accessLevelId: body.accessLevelId ?? null,
        senderId: body.senderId ?? null,
        guestIdsCount: body.guestIds.length,
      },
    });

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
