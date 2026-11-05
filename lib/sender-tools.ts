import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * Generates a URL-safe, cryptographically secure 24-character token for senders.
 */
export function generateSenderAccessToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export interface AutoSplitParams {
  weddingId: string;
  senderIds: string[];
  guestIds?: string[];
  unassignedOnly?: boolean;
}

export interface AutoSplitResult {
  totalGuests: number;
  splitCount: number;
  assignments: Record<string, number>;
}

/**
 * Distributes guests evenly across the specified senders using a round-robin algorithm.
 */
export async function autoSplitGuests(params: AutoSplitParams): Promise<AutoSplitResult> {
  const { weddingId, senderIds, guestIds, unassignedOnly = true } = params;

  if (!senderIds || senderIds.length === 0) {
    return { totalGuests: 0, splitCount: 0, assignments: {} };
  }

  // Verify all senderIds belong to this wedding
  const validSenders = await prisma.sender.findMany({
    where: { id: { in: senderIds }, weddingId },
    select: { id: true },
  });

  const verifiedSenderIds = validSenders.map((s) => s.id);
  if (verifiedSenderIds.length === 0) {
    return { totalGuests: 0, splitCount: 0, assignments: {} };
  }

  // Build guest query
  const where: Record<string, unknown> = { weddingId };
  if (guestIds && guestIds.length > 0) {
    where.id = { in: guestIds };
  } else if (unassignedOnly) {
    where.senderId = null;
  }

  const guests = await prisma.guest.findMany({
    where,
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (guests.length === 0) {
    return { totalGuests: 0, splitCount: 0, assignments: {} };
  }

  const assignments: Record<string, number> = {};
  for (const sId of verifiedSenderIds) {
    assignments[sId] = 0;
  }

  // Update in a transaction
  await prisma.$transaction(
    guests.map((g, idx) => {
      const assignedSenderId = verifiedSenderIds[idx % verifiedSenderIds.length];
      assignments[assignedSenderId] = (assignments[assignedSenderId] || 0) + 1;

      return prisma.guest.update({
        where: { id: g.id },
        data: { senderId: assignedSenderId },
      });
    })
  );

  return {
    totalGuests: guests.length,
    splitCount: guests.length,
    assignments,
  };
}

