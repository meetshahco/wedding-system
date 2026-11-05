import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * Generate a 10-character URL-safe token using crypto.randomBytes.
 * Ensures global uniqueness by checking the Guest table.
 */
export async function generateUniqueToken(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const token = crypto.randomBytes(8).toString("base64url").slice(0, 10);
    const existing = await prisma.guest.findUnique({ where: { token } });
    if (!existing) return token;
  }
  throw new Error("Failed to generate unique token after 100 attempts");
}

/**
 * Generate a 4-digit code, ensuring uniqueness per wedding (or globally if no weddingId provided).
 */
export async function generateUniqueCode(weddingId?: string): Promise<string> {
  for (let i = 0; i < 1000; i++) {
    const code = String(Math.floor(Math.random() * 9000) + 1000);
    const existing = await prisma.guest.findFirst({
      where: {
        code,
        ...(weddingId ? { weddingId } : {}),
      },
    });
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique code after 1000 attempts");
}

/**
 * Pure helpers (no DB) — used in unit tests.
 */
export function makeRawToken(): string {
  return crypto.randomBytes(8).toString("base64url").slice(0, 10);
}

export function makeRawCode(): string {
  return String(Math.floor(Math.random() * 9000) + 1000);
}
