import { prisma } from "./prisma";
import { MessageLogStatus } from "@prisma/client";
import { SendingMethod } from "./providers/types";

export const DEFAULT_WEDDING_DAILY_CAP = 250;
export const DEFAULT_GLOBAL_DAILY_CAP = 1000;

/**
 * Gets the configured sending method for a wedding.
 * Defaults to "mock".
 */
export async function getSendingMethod(weddingId: string): Promise<SendingMethod> {
  const setting = await prisma.setting.findUnique({
    where: {
      weddingId_key: {
        weddingId,
        key: "sending_method",
      },
    },
  });

  const val = setting?.value?.toLowerCase();
  if (val === "whatsapp_cloud" || val === "manual") {
    return val as SendingMethod;
  }
  return "mock";
}

/**
 * Sets the sending method for a wedding.
 */
export async function setSendingMethod(weddingId: string, method: SendingMethod) {
  return prisma.setting.upsert({
    where: {
      weddingId_key: {
        weddingId,
        key: "sending_method",
      },
    },
    create: {
      weddingId,
      key: "sending_method",
      value: method,
    },
    update: {
      value: method,
    },
  });
}

/**
 * Gets the configured daily send cap for a wedding.
 */
export async function getWeddingDailyCap(weddingId: string): Promise<number> {
  const setting = await prisma.setting.findUnique({
    where: {
      weddingId_key: {
        weddingId,
        key: "daily_send_cap",
      },
    },
  });

  if (setting?.value) {
    const num = parseInt(setting.value, 10);
    if (!isNaN(num) && num > 0) return num;
  }

  return DEFAULT_WEDDING_DAILY_CAP;
}

/**
 * Checks rolling 24-hour daily send caps for a wedding and platform-wide.
 * Applies only to automated message sends.
 */
export async function checkDailyCaps(weddingId: string): Promise<{
  allowed: boolean;
  weddingCount: number;
  weddingCap: number;
  weddingRemaining: number;
  globalCount: number;
  globalCap: number;
  globalRemaining: number;
  reason?: string;
}> {
  const now = new Date();
  const rollingWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const weddingCap = await getWeddingDailyCap(weddingId);
  const globalCap = parseInt(process.env.DAILY_SEND_CAP || String(DEFAULT_GLOBAL_DAILY_CAP), 10);

  // Count messages in rolling 24h window
  const countedStatuses: MessageLogStatus[] = ["sending", "sent", "delivered", "read"];

  const [weddingCount, globalCount] = await Promise.all([
    prisma.messageLog.count({
      where: {
        weddingId,
        status: { in: countedStatuses },
        sentAt: { gte: rollingWindowStart },
      },
    }),
    prisma.messageLog.count({
      where: {
        status: { in: countedStatuses },
        sentAt: { gte: rollingWindowStart },
      },
    }),
  ]);

  const weddingRemaining = Math.max(0, weddingCap - weddingCount);
  const globalRemaining = Math.max(0, globalCap - globalCount);

  if (weddingRemaining <= 0) {
    return {
      allowed: false,
      weddingCount,
      weddingCap,
      weddingRemaining,
      globalCount,
      globalCap,
      globalRemaining,
      reason: `Wedding rolling 24-hour send cap of ${weddingCap} reached.`,
    };
  }

  if (globalRemaining <= 0) {
    return {
      allowed: false,
      weddingCount,
      weddingCap,
      weddingRemaining,
      globalCount,
      globalCap,
      globalRemaining,
      reason: `Platform-wide rolling 24-hour send cap of ${globalCap} reached.`,
    };
  }

  return {
    allowed: true,
    weddingCount,
    weddingCap,
    weddingRemaining,
    globalCount,
    globalCap,
    globalRemaining,
  };
}
