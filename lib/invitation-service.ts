import { prisma } from "./prisma";
import { getSendingMethod, checkDailyCaps } from "./sending-settings";
import { seedDefaultTemplates } from "./template-renderer";

export interface InvitationSummary {
  stats: {
    totalGuests: number;
    eligible: number;
    queued: number;
    sending: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    optedOut: number;
    unassignedSender: number;
  };
  caps: {
    dailyCap: number;
    sentToday: number;
    remainingToday: number;
    globalRemaining: number;
    allowed: boolean;
  };
  sendingMethod: "mock" | "whatsapp_cloud" | "manual";
}

/**
 * Computes high-level invitation counts and cap statuses for a wedding.
 */
export async function getInvitationSummary(weddingId: string): Promise<InvitationSummary> {
  const [
    totalGuests,
    queuedCount,
    sendingCount,
    sentCount,
    deliveredCount,
    readCount,
    failedCount,
    optedOutCount,
    unassignedSenderCount,
    eligibleCount,
    caps,
    sendingMethod,
  ] = await Promise.all([
    prisma.guest.count({ where: { weddingId } }),
    prisma.guest.count({ where: { weddingId, inviteStatus: "queued" } }),
    prisma.messageLog.count({
      where: { weddingId, templateKey: "invitation", kind: "template", status: "sending" },
    }),
    prisma.guest.count({ where: { weddingId, inviteStatus: "sent" } }),
    prisma.guest.count({ where: { weddingId, inviteStatus: "delivered" } }),
    prisma.guest.count({ where: { weddingId, inviteStatus: "read" } }),
    prisma.guest.count({ where: { weddingId, inviteStatus: "failed" } }),
    prisma.guest.count({ where: { weddingId, optedOut: true } }),
    prisma.guest.count({ where: { weddingId, senderId: null } }),
    prisma.guest.count({
      where: {
        weddingId,
        phone: { not: "" },
        optedOut: false,
        inviteStatus: "not_invited",
      },
    }),
    checkDailyCaps(weddingId),
    getSendingMethod(weddingId),
  ]);

  return {
    stats: {
      totalGuests,
      eligible: eligibleCount,
      queued: queuedCount,
      sending: sendingCount,
      sent: sentCount,
      delivered: deliveredCount,
      read: readCount,
      failed: failedCount,
      optedOut: optedOutCount,
      unassignedSender: unassignedSenderCount,
    },
    caps: {
      dailyCap: caps.weddingCap,
      sentToday: caps.weddingCount,
      remainingToday: caps.weddingRemaining,
      globalRemaining: caps.globalRemaining,
      allowed: caps.allowed,
    },
    sendingMethod,
  };
}

export interface QueueInvitationsOptions {
  guestIds?: string[];
  retryFailed?: boolean;
}

export interface QueueInvitationsResult {
  success: boolean;
  error?: string;
  queuedCount: number;
  skippedCount: number;
  remainingCap: number;
}

/**
 * Queues invitation messages for eligible guests.
 * Guarantees idempotency (no double-sends) and enforces daily caps.
 */
export async function queueInvitations(
  weddingId: string,
  options: QueueInvitationsOptions = {}
): Promise<QueueInvitationsResult> {
  const { guestIds, retryFailed = false } = options;

  // 1. Verify sending method
  const sendingMethod = await getSendingMethod(weddingId);
  if (sendingMethod === "manual") {
    return {
      success: false,
      error: "MANUAL_MODE_ACTIVE",
      queuedCount: 0,
      skippedCount: 0,
      remainingCap: 0,
    };
  }

  // 2. Check rolling daily caps
  const caps = await checkDailyCaps(weddingId);
  if (!caps.allowed || caps.weddingRemaining <= 0 || caps.globalRemaining <= 0) {
    return {
      success: false,
      error: "DAILY_CAP_REACHED",
      queuedCount: 0,
      skippedCount: 0,
      remainingCap: 0,
    };
  }

  // 3. Ensure templates are seeded
  await seedDefaultTemplates(weddingId);

  // 4. Query eligible candidates
  const whereClause: Record<string, unknown> = {
    weddingId,
    phone: { not: "" },
    optedOut: false,
  };

  if (guestIds && guestIds.length > 0) {
    whereClause.id = { in: guestIds };
  }

  if (retryFailed) {
    whereClause.inviteStatus = "failed";
  } else {
    // Only uninvited guests
    whereClause.inviteStatus = "not_invited";
  }

  const candidateGuests = await prisma.guest.findMany({
    where: whereClause,
    select: { id: true, name: true, phone: true, inviteStatus: true },
    orderBy: { createdAt: "asc" },
  });

  if (candidateGuests.length === 0) {
    return {
      success: true,
      queuedCount: 0,
      skippedCount: 0,
      remainingCap: caps.weddingRemaining,
    };
  }

  // 5. Check against active MessageLogs to strictly prevent double-sends
  const candidateIds = candidateGuests.map((g) => g.id);
  const activeLogs = await prisma.messageLog.findMany({
    where: {
      weddingId,
      guestId: { in: candidateIds },
      templateKey: "invitation",
      kind: "template",
      status: { in: ["queued", "sending", "sent", "delivered", "read"] },
    },
    select: { guestId: true },
  });

  const activeGuestIdSet = new Set(activeLogs.map((l) => l.guestId));

  // Filter out any guests who already have an active/sent invitation
  const eligibleGuests = candidateGuests.filter((g) => !activeGuestIdSet.has(g.id));
  const skippedCount = candidateGuests.length - eligibleGuests.length;

  if (eligibleGuests.length === 0) {
    return {
      success: true,
      queuedCount: 0,
      skippedCount,
      remainingCap: caps.weddingRemaining,
    };
  }

  // 6. Enforce cap limit on this queue batch
  const maxToQueue = Math.min(
    eligibleGuests.length,
    caps.weddingRemaining,
    caps.globalRemaining
  );

  const guestsToQueue = eligibleGuests.slice(0, maxToQueue);
  const additionalSkippedDueToCap = eligibleGuests.length - maxToQueue;

  // 7. Perform queue insertion and status update
  if (retryFailed) {
    // Reset existing failed message logs for these guests
    for (const guest of guestsToQueue) {
      const existingFailed = await prisma.messageLog.findFirst({
        where: {
          weddingId,
          guestId: guest.id,
          templateKey: "invitation",
          kind: "template",
          status: "failed",
        },
      });

      if (existingFailed) {
        await prisma.messageLog.update({
          where: { id: existingFailed.id },
          data: {
            status: "queued",
            attempts: 0,
            errorMessage: null,
            nextAttemptAt: null,
            sentAt: null,
          },
        });
      } else {
        await prisma.messageLog.create({
          data: {
            weddingId,
            guestId: guest.id,
            kind: "template",
            templateKey: "invitation",
            status: "queued",
          },
        });
      }

      await prisma.guest.update({
        where: { id: guest.id },
        data: { inviteStatus: "queued" },
      });
    }
  } else {
    // Fresh invitations queueing
    for (const guest of guestsToQueue) {
      await prisma.messageLog.create({
        data: {
          weddingId,
          guestId: guest.id,
          kind: "template",
          templateKey: "invitation",
          status: "queued",
        },
      });

      await prisma.guest.update({
        where: { id: guest.id },
        data: { inviteStatus: "queued" },
      });
    }
  }

  const remainingCap = caps.weddingRemaining - guestsToQueue.length;

  return {
    success: true,
    queuedCount: guestsToQueue.length,
    skippedCount: skippedCount + additionalSkippedDueToCap,
    remainingCap,
  };
}

export interface BulkAssignParams {
  weddingId: string;
  guestIds: string[];
  accessLevelId?: string | null;
  senderId?: string | null;
}

/**
 * Bulk updates accessLevel and/or sender for selected guests within a wedding.
 */
export async function bulkAssignGuests(params: BulkAssignParams): Promise<number> {
  const { weddingId, guestIds, accessLevelId, senderId } = params;

  if (!guestIds || guestIds.length === 0) {
    return 0;
  }

  // Validate that guestIds belong to this wedding
  const validGuests = await prisma.guest.findMany({
    where: { id: { in: guestIds }, weddingId },
    select: { id: true },
  });

  const verifiedGuestIds = validGuests.map((g) => g.id);
  if (verifiedGuestIds.length === 0) {
    return 0;
  }

  const updateData: Record<string, unknown> = {};

  if (accessLevelId !== undefined) {
    if (accessLevelId === null || accessLevelId === "") {
      updateData.accessLevelId = null;
    } else {
      // Validate accessLevel belongs to this wedding
      const validLevel = await prisma.accessLevel.findFirst({
        where: { id: accessLevelId, weddingId },
      });
      if (validLevel) {
        updateData.accessLevelId = validLevel.id;
      }
    }
  }

  if (senderId !== undefined) {
    if (senderId === null || senderId === "") {
      updateData.senderId = null;
    } else {
      // Validate sender belongs to this wedding
      const validSender = await prisma.sender.findFirst({
        where: { id: senderId, weddingId },
      });
      if (validSender) {
        updateData.senderId = validSender.id;
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    return 0;
  }

  const result = await prisma.guest.updateMany({
    where: { id: { in: verifiedGuestIds }, weddingId },
    data: updateData,
  });

  return result.count;
}

/**
 * Returns current real-time sending progress counts for invitations.
 */
export async function getInvitationProgress(weddingId: string) {
  const [queued, sending, sent, delivered, read, failed] = await Promise.all([
    prisma.messageLog.count({
      where: { weddingId, templateKey: "invitation", kind: "template", status: "queued" },
    }),
    prisma.messageLog.count({
      where: { weddingId, templateKey: "invitation", kind: "template", status: "sending" },
    }),
    prisma.messageLog.count({
      where: { weddingId, templateKey: "invitation", kind: "template", status: "sent" },
    }),
    prisma.messageLog.count({
      where: { weddingId, templateKey: "invitation", kind: "template", status: "delivered" },
    }),
    prisma.messageLog.count({
      where: { weddingId, templateKey: "invitation", kind: "template", status: "read" },
    }),
    prisma.messageLog.count({
      where: { weddingId, templateKey: "invitation", kind: "template", status: "failed" },
    }),
  ]);

  const total = queued + sending + sent + delivered + read + failed;
  const isFinished = queued === 0 && sending === 0;

  return {
    queued,
    sending,
    sent,
    delivered,
    read,
    failed,
    total,
    isFinished,
  };
}
