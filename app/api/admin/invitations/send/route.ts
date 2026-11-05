import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { queueInvitations } from "@/lib/invitation-service";
import { processQueueBatch } from "@/lib/queue/processor";
import { getSendingMethod } from "@/lib/sending-settings";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const body = await req.json().catch(() => ({}));
    const guestIds = Array.isArray(body?.guestIds) && body.guestIds.length > 0 ? body.guestIds : undefined;

    const result = await queueInvitations(wedding.id, { guestIds });

    if (!result.success) {
      if (result.error === "MANUAL_MODE_ACTIVE") {
        return NextResponse.json(
          {
            error: "Manual sending method is active for this wedding. Use Senders portal to dispatch invitations.",
            isManual: true,
          },
          { status: 400 }
        );
      }
      if (result.error === "DAILY_CAP_REACHED") {
        return NextResponse.json(
          {
            error: "Daily send cap reached for today.",
            capReached: true,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: result.error || "Failed to queue invitations" }, { status: 400 });
    }

    // If mock provider is configured, run a quick processing cycle in the background
    const method = await getSendingMethod(wedding.id);
    if (method === "mock" && result.queuedCount > 0) {
      processQueueBatch({ weddingId: wedding.id, batchSize: Math.min(50, result.queuedCount) }).catch((err) => {
        console.error("Auto-process mock batch error:", err);
      });
    }

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "invitations.send",
      details: {
        queuedCount: result.queuedCount,
        skippedCount: result.skippedCount,
        remainingCap: result.remainingCap,
        targetedSpecificGuests: Boolean(guestIds),
      },
    });

    return NextResponse.json({
      success: true,
      queuedCount: result.queuedCount,
      skippedCount: result.skippedCount,
      remainingCap: result.remainingCap,
    });
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
