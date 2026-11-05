import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { createAndScheduleReminder, AudienceFilter } from "@/lib/reminder-service";
import { getSendingMethod } from "@/lib/sending-settings";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const [reminders, sendingMethod] = await Promise.all([
      prisma.reminder.findMany({
        where: { weddingId: wedding.id },
        include: {
          messageLogs: {
            select: { id: true, status: true, sentAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      getSendingMethod(wedding.id),
    ]);

    const formatted = reminders.map((r) => {
      let audienceFilter: AudienceFilter = {};
      try {
        audienceFilter = JSON.parse(r.audienceFilter);
      } catch {
        // ignore
      }

      const total = r.messageLogs.length;
      const sent = r.messageLogs.filter((m) => m.status === "sent" || m.status === "delivered" || m.status === "read").length;
      const queued = r.messageLogs.filter((m) => m.status === "queued" || m.status === "sending").length;
      const failed = r.messageLogs.filter((m) => m.status === "failed").length;

      return {
        id: r.id,
        title: r.title,
        templateKey: r.templateKey,
        audienceFilter,
        scheduledAt: r.scheduledAt,
        status: r.status,
        createdAt: r.createdAt,
        stats: { total, sent, queued, failed },
      };
    });

    return NextResponse.json({ reminders: formatted, sendingMethod });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const body = await req.json().catch(() => null);
    if (!body?.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!body?.templateKey) {
      return NextResponse.json({ error: "Template key is required" }, { status: 400 });
    }

    const filter: AudienceFilter = body.audienceFilter || {};
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    const sendImmediately = Boolean(body.sendImmediately);

    const result = await createAndScheduleReminder({
      weddingId: wedding.id,
      title: body.title,
      templateKey: body.templateKey,
      audienceFilter: filter,
      variableMap: body.variableMap || {},
      scheduledAt,
      sendImmediately,
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "reminders.create",
      details: {
        reminderId: result.reminder.id,
        title: result.reminder.title,
        templateKey: result.reminder.templateKey,
        totalQueued: result.totalQueued,
        sendingMethod: result.sendingMethod,
      },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
