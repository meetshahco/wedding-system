import { prisma } from "./prisma";

export interface LogAuditParams {
  userId?: string | null;
  weddingId?: string | null;
  action: string;
  details?: Record<string, unknown> | string;
  ipAddress?: string | null;
}

/**
 * Record an audit log entry in the database.
 */
export async function logAuditEvent({
  userId,
  weddingId,
  action,
  details,
  ipAddress,
}: LogAuditParams) {
  try {
    const detailsStr =
      typeof details === "object" ? JSON.stringify(details) : details ?? null;

    return await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        weddingId: weddingId ?? null,
        action,
        details: detailsStr,
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
    return null;
  }
}
