import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { getSendingMethod, checkDailyCaps } from "./sending-settings";
import { resolveTemplateForGuest, seedDefaultTemplates } from "./template-renderer";
import { processQueueBatch } from "./queue/processor";

export interface AudienceFilter {
  accessLevelId?: string; // "all" | "none" | specific id
  city?: string;          // specific city or empty
  group?: string;         // specific group or empty
  senderId?: string;      // "all" | "none" | specific id
  notSentYet?: boolean;   // inviteStatus === 'not_invited'
  notOpenedYet?: boolean; // openCount === 0 or viewedAt === null
  hasPhoneOnly?: boolean; // phone !== "" (default: true)
  excludeOptedOut?: boolean; // optedOut === false (default: true)
}

/**
 * Builds Prisma where clause for audience filtering.
 */
export function buildAudienceWhere(weddingId: string, filter: AudienceFilter): Prisma.GuestWhereInput {
  const where: Prisma.GuestWhereInput = {
    weddingId,
  };

  if (filter.hasPhoneOnly !== false) {
    where.phone = { not: "" };
  }

  if (filter.excludeOptedOut !== false) {
    where.optedOut = false;
  }

  if (filter.accessLevelId) {
    if (filter.accessLevelId === "none") {
      where.accessLevelId = null;
    } else if (filter.accessLevelId !== "all") {
      where.accessLevelId = filter.accessLevelId;
    }
  }

  if (filter.city && filter.city.trim()) {
    where.city = { equals: filter.city.trim(), mode: "insensitive" };
  }

  if (filter.group && filter.group.trim()) {
    where.group = { equals: filter.group.trim(), mode: "insensitive" };
  }

  if (filter.senderId) {
    if (filter.senderId === "none") {
      where.senderId = null;
    } else if (filter.senderId !== "all") {
      where.senderId = filter.senderId;
    }
  }

  if (filter.notSentYet) {
    where.inviteStatus = "not_invited";
  }

  if (filter.notOpenedYet) {
    where.openCount = 0;
  }

  return where;
}

/**
 * Queries the count and list of guests matching audience filters.
 */
export async function getMatchingAudience(weddingId: string, filter: AudienceFilter) {
  const where = buildAudienceWhere(weddingId, filter);

  const [count, guests] = await Promise.all([
    prisma.guest.count({ where }),
    prisma.guest.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        city: true,
        group: true,
        pax: true,
        language: true,
        inviteStatus: true,
        openCount: true,
        accessLevel: { select: { id: true, name: true } },
        sender: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  return { count, guests };
}

export interface CreateReminderParams {
  weddingId: string;
  title: string;
  templateKey: string;
  audienceFilter: AudienceFilter;
  variableMap?: Record<string, string>;
  scheduledAt?: Date | string | null;
  sendImmediately?: boolean;
}

/**
 * Creates a reminder or message round and schedules/queues it based on sending method.
 */
export async function createAndScheduleReminder(params: CreateReminderParams) {
  const {
    weddingId,
    title,
    templateKey,
    audienceFilter,
    variableMap = {},
    scheduledAt,
    sendImmediately = false,
  } = params;

  if (!title || !title.trim()) {
    throw new Error("Reminder title is required");
  }

  if (!templateKey || !templateKey.trim()) {
    throw new Error("Template key is required");
  }

  // Ensure templates exist
  await seedDefaultTemplates(weddingId);

  const sendingMethod = await getSendingMethod(weddingId);
  const where = buildAudienceWhere(weddingId, audienceFilter);

  const matchingGuests = await prisma.guest.findMany({
    where,
    select: { id: true, senderId: true },
  });

  if (matchingGuests.length === 0) {
    throw new Error("No eligible guests match the specified audience filter");
  }

  const scheduledDate = scheduledAt ? new Date(scheduledAt) : sendImmediately ? new Date() : null;

  // Create the Reminder record
  const reminder = await prisma.reminder.create({
    data: {
      weddingId,
      title: title.trim(),
      templateKey: templateKey.trim(),
      audienceFilter: JSON.stringify(audienceFilter),
      variableMap: JSON.stringify(variableMap),
      scheduledAt: scheduledDate,
      status: sendingMethod === "manual" ? "scheduled" : scheduledDate ? "scheduled" : "draft",
    },
  });

  // Handle Manual Mode: Message Round queue generation per sender
  if (sendingMethod === "manual") {
    const senderAssignments: Record<string, number> = {};

    for (const guest of matchingGuests) {
      await prisma.messageLog.create({
        data: {
          weddingId,
          guestId: guest.id,
          reminderId: reminder.id,
          kind: "template",
          templateKey: templateKey.trim(),
          provider: "manual",
          status: "queued",
        },
      });

      const sId = guest.senderId || "unassigned";
      senderAssignments[sId] = (senderAssignments[sId] || 0) + 1;
    }

    return {
      reminder,
      sendingMethod: "manual" as const,
      totalQueued: matchingGuests.length,
      senderAssignments,
    };
  }

  // Handle API Modes (Mock / WhatsApp Cloud API)
  const caps = await checkDailyCaps(weddingId);
  if (!caps.allowed || caps.weddingRemaining <= 0) {
    throw new Error("Daily send cap has been reached for this wedding");
  }

  const maxToQueue = Math.min(matchingGuests.length, caps.weddingRemaining, caps.globalRemaining);
  const guestsToQueue = matchingGuests.slice(0, maxToQueue);

  for (const guest of guestsToQueue) {
    await prisma.messageLog.create({
      data: {
        weddingId,
        guestId: guest.id,
        reminderId: reminder.id,
        kind: "template",
        templateKey: templateKey.trim(),
        scheduledAt: scheduledDate,
        status: "queued",
      },
    });
  }

  // If sendImmediately and mock mode, process immediately
  if (sendImmediately && sendingMethod === "mock") {
    processQueueBatch({ weddingId, batchSize: guestsToQueue.length }).catch((err) => {
      console.error("Auto-process mock reminder error:", err);
    });
  }

  return {
    reminder,
    sendingMethod,
    totalQueued: guestsToQueue.length,
    scheduledAt: scheduledDate,
    capRemaining: caps.weddingRemaining - guestsToQueue.length,
  };
}

/**
 * Cancels a scheduled reminder and removes/skips its queued message logs.
 */
export async function cancelReminder(reminderId: string, weddingId: string) {
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, weddingId },
  });

  if (!reminder) {
    throw new Error("Reminder not found");
  }

  if (reminder.status === "cancelled" || reminder.status === "done") {
    return { reminder, cancelledLogsCount: 0 };
  }

  // Update reminder status
  const updatedReminder = await prisma.reminder.update({
    where: { id: reminderId },
    data: { status: "cancelled" },
  });

  // Delete or mark skipped any queued logs that haven't been sent yet
  const result = await prisma.messageLog.updateMany({
    where: {
      weddingId,
      reminderId,
      status: "queued",
    },
    data: {
      status: "skipped",
      errorMessage: "Reminder was cancelled by admin",
    },
  });

  return {
    reminder: updatedReminder,
    cancelledLogsCount: result.count,
  };
}

/**
 * Returns breakdown of message rounds for a sender in manual mode.
 */
export async function getSenderRounds(weddingId: string, senderId: string) {
  // Query reminders that have queued or sent message logs for this sender's guests
  const senderGuests = await prisma.guest.findMany({
    where: { weddingId, senderId },
    select: { id: true },
  });

  const guestIds = senderGuests.map((g) => g.id);
  if (guestIds.length === 0) return [];

  const reminders = await prisma.reminder.findMany({
    where: { weddingId, status: { not: "cancelled" } },
    include: {
      messageLogs: {
        where: { guestId: { in: guestIds } },
        select: { id: true, status: true, guestId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return reminders.map((r) => {
    const total = r.messageLogs.length;
    const sent = r.messageLogs.filter((m) => m.status === "sent" || m.status === "delivered" || m.status === "read").length;
    const pending = total - sent;

    return {
      id: r.id,
      title: r.title,
      templateKey: r.templateKey,
      status: r.status,
      total,
      sent,
      pending,
    };
  });
}

