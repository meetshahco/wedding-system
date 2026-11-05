import { prisma } from "./prisma";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * DB-backed rate limiter.
 *
 * @param identifier  e.g. the IP address
 * @param action      e.g. "code_entry" | "admin_login"
 * @param limit       max attempts per window
 * @param windowMs    window length in milliseconds
 */
export async function checkRateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();
  const key = `${action}:${identifier}`;

  // Clean up expired rows opportunistically (best-effort, ignore errors)
  await prisma.rateLimit
    .deleteMany({ where: { expiresAt: { lt: now } } })
    .catch(() => {});

  const expiresAt = new Date(now.getTime() + windowMs);

  // Upsert: create on first hit, increment on subsequent hits within window
  const record = await prisma.rateLimit.upsert({
    where: { key_action: { key, action } },
    create: {
      key,
      action,
      attempts: 1,
      windowStart: now,
      expiresAt,
    },
    update: {
      attempts: { increment: 1 },
    },
  });

  // If the existing window has expired, reset it
  if (record.expiresAt < now) {
    await prisma.rateLimit.update({
      where: { key_action: { key, action } },
      data: { attempts: 1, windowStart: now, expiresAt },
    });
    return { allowed: true, remaining: limit - 1, resetAt: expiresAt };
  }

  const allowed = record.attempts <= limit;
  const remaining = Math.max(0, limit - record.attempts);

  return { allowed, remaining, resetAt: record.expiresAt };
}

