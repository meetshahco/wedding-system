import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ accessToken: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { accessToken } = await params;

    const sender = await prisma.sender.findUnique({
      where: { accessToken },
    });

    if (!sender || sender.revokedAt || (sender.expiresAt && sender.expiresAt < new Date())) {
      return NextResponse.json({ error: "Unauthorized or expired sender link" }, { status: 403 });
    }

    if (sender.pin) {
      const pinHeader = req.headers.get("x-sender-pin");
      if (pinHeader !== sender.pin) {
        return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => null);
    const { guestId, action, reminderId } = body || {};

    if (!guestId || (action !== "sent" && action !== "undo")) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    // Verify guest belongs to THIS sender and wedding
    const guest = await prisma.guest.findFirst({
      where: {
        id: guestId,
        weddingId: sender.weddingId,
        senderId: sender.id,
      },
    });

    if (!guest) {
      return NextResponse.json({ error: "Guest not found or not assigned to this sender" }, { status: 404 });
    }

    const now = new Date();

    if (reminderId) {
      // Handling reminder round message status
      if (action === "sent") {
        await prisma.messageLog.updateMany({
          where: {
            weddingId: sender.weddingId,
            guestId: guest.id,
            reminderId,
          },
          data: {
            status: "sent",
            sentAt: now,
          },
        });
        return NextResponse.json({ success: true, guestId, status: "sent", reminderId });
      } else {
        await prisma.messageLog.updateMany({
          where: {
            weddingId: sender.weddingId,
            guestId: guest.id,
            reminderId,
          },
          data: {
            status: "queued",
            sentAt: null,
          },
        });
        return NextResponse.json({ success: true, guestId, status: "queued", reminderId });
      }
    }

    // Default invitation status handling
    if (action === "sent") {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { inviteStatus: "sent" },
      });

      // Upsert message log record
      await prisma.messageLog.upsert({
        where: {
          weddingId_guestId_templateKey_kind_reminderId: {
            weddingId: sender.weddingId,
            guestId: guest.id,
            templateKey: "invitation",
            kind: "template",
            reminderId: "",
          },
        },
        create: {
          weddingId: sender.weddingId,
          guestId: guest.id,
          templateKey: "invitation",
          kind: "template",
          provider: "manual",
          status: "sent",
          sentAt: now,
        },
        update: {
          status: "sent",
          provider: "manual",
          sentAt: now,
        },
      });

      return NextResponse.json({ success: true, guestId, status: "sent" });
    } else if (action === "undo") {
      // Revert status back to not_invited
      await prisma.guest.update({
        where: { id: guest.id },
        data: { inviteStatus: "not_invited" },
      });

      // Update message log if exists
      await prisma.messageLog.deleteMany({
        where: {
          weddingId: sender.weddingId,
          guestId: guest.id,
          templateKey: "invitation",
        },
      });

      return NextResponse.json({ success: true, guestId, status: "not_invited" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Sender status update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

