import { prisma } from "../prisma";
import { mockProvider } from "../providers/mock-provider";
import { renderTemplate, resolveTemplateForGuest } from "../template-renderer";
import { getSendingMethod, checkDailyCaps } from "../sending-settings";
import { getInviteUrl } from "../url-builder";

export interface QueueProcessOptions {
  batchSize?: number;
  maxAttempts?: number;
  weddingId?: string;
}

export interface QueueProcessSummary {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  capBlocked: number;
}

/**
 * Atomically claims a batch of queued jobs using PostgreSQL `FOR UPDATE SKIP LOCKED`.
 * This prevents double-sends even when multiple workers or cron executions overlap.
 */
export async function claimQueueBatch(batchSize = 10, weddingId?: string): Promise<string[]> {
  if (weddingId) {
    const claimed = await prisma.$queryRaw<{ id: string }[]>`
      WITH to_claim AS (
        SELECT id FROM "MessageLog"
        WHERE status = 'queued'
          AND "weddingId" = ${weddingId}
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= (NOW() AT TIME ZONE 'UTC'))
          AND ("scheduledAt" IS NULL OR "scheduledAt" <= (NOW() AT TIME ZONE 'UTC'))
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "MessageLog" m
      SET status = 'sending', attempts = m.attempts + 1
      FROM to_claim
      WHERE m.id = to_claim.id
      RETURNING m.id;
    `;
    return claimed.map((r) => r.id);
  }

  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    WITH to_claim AS (
      SELECT id FROM "MessageLog"
      WHERE status = 'queued'
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= (NOW() AT TIME ZONE 'UTC'))
        AND ("scheduledAt" IS NULL OR "scheduledAt" <= (NOW() AT TIME ZONE 'UTC'))
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "MessageLog" m
    SET status = 'sending', attempts = m.attempts + 1
    FROM to_claim
    WHERE m.id = to_claim.id
    RETURNING m.id;
  `;

  return claimed.map((r) => r.id);
}

/**
 * Claims and processes a batch of queued messages from the job queue.
 */
export async function processQueueBatch(
  options: QueueProcessOptions = {}
): Promise<QueueProcessSummary> {
  const { batchSize = 10, maxAttempts = 3, weddingId } = options;

  const summary: QueueProcessSummary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    capBlocked: 0,
  };

  // 1. Atomically claim batch
  const claimedIds = await claimQueueBatch(batchSize, weddingId);
  if (claimedIds.length === 0) {
    return summary;
  }

  summary.processed = claimedIds.length;

  // 2. Load claimed jobs
  const jobs = await prisma.messageLog.findMany({
    where: { id: { in: claimedIds } },
    include: {
      wedding: true,
      guest: {
        include: {
          accessLevel: true,
        },
      },
    },
  });

  for (const job of jobs) {
    const { wedding, guest } = job;

    // Rule: Worker ignores queued jobs when active provider is manual
    const sendingMethod = await getSendingMethod(wedding.id);
    if (sendingMethod === "manual") {
      // Return to queued without incrementing attempts, manual sender will handle via wa.me
      await prisma.messageLog.update({
        where: { id: job.id },
        data: {
          status: "queued",
          attempts: { decrement: 1 },
        },
      });
      summary.skipped++;
      continue;
    }

    // Rule: Check 24-hour rolling send caps for automated sends
    const capCheck = await checkDailyCaps(wedding.id);
    if (!capCheck.allowed) {
      // Revert to queued with backoff
      await prisma.messageLog.update({
        where: { id: job.id },
        data: {
          status: "queued",
          nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000), // Check again in 1 hour
          errorMessage: capCheck.reason,
          attempts: { decrement: 1 },
        },
      });
      summary.capBlocked++;
      continue;
    }

    // Resolve template
    const templateKey = job.templateKey || "invitation";
    const template = await resolveTemplateForGuest(wedding.id, templateKey, guest.language);

    const coupleNames = `${wedding.coupleName1} & ${wedding.coupleName2}`;
    const formattedDate = new Date(wedding.weddingDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const inviteUrl = getInviteUrl(guest, wedding);

    const renderedBody = template
      ? renderTemplate(template.body, {
          guest_name: guest.name,
          couple_names: coupleNames,
          wedding_date: formattedDate,
          pax: guest.pax,
          code: guest.code,
          invite_url: inviteUrl,
          access_level: guest.accessLevel?.name || "All Events",
        })
      : `Dear ${guest.name}, you are joyfully invited to the wedding of ${coupleNames} on ${formattedDate}. View your invite: ${inviteUrl}`;

    // Select provider (MockProvider used by default or for testing)
    const provider = mockProvider;

    const result = await provider.send({
      weddingId: wedding.id,
      guestId: guest.id,
      phone: guest.phone,
      templateKey,
      language: guest.language,
      body: renderedBody,
      inviteUrl,
    });

    const now = new Date();

    if (result.success) {
      await prisma.messageLog.update({
        where: { id: job.id },
        data: {
          status: result.status,
          externalMessageId: result.externalMessageId,
          sentAt: now,
          errorMessage: null,
          provider: provider.name,
        },
      });

      await prisma.guest.update({
        where: { id: guest.id },
        data: { inviteStatus: "sent" },
      });

      summary.succeeded++;
    } else {
      // Handle failure: permanent vs retryable
      const isPermanent = result.retryable === false || job.attempts >= maxAttempts;

      if (isPermanent) {
        await prisma.messageLog.update({
          where: { id: job.id },
          data: {
            status: "failed",
            errorMessage: result.errorMessage,
            provider: provider.name,
          },
        });

        await prisma.guest.update({
          where: { id: guest.id },
          data: { inviteStatus: "failed" },
        });

        summary.failed++;
      } else {
        // Exponential backoff: 2^attempts * 60 seconds
        const delaySeconds = Math.pow(2, job.attempts) * 60;
        const nextAttemptAt = new Date(now.getTime() + delaySeconds * 1000);

        await prisma.messageLog.update({
          where: { id: job.id },
          data: {
            status: "queued",
            nextAttemptAt,
            errorMessage: result.errorMessage,
            provider: provider.name,
          },
        });

        summary.failed++;
      }
    }
  }

  return summary;
}
