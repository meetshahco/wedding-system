import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Enable WAL mode and busy timeout on first connection so web + worker
// can safely share the same SQLite file without SQLITE_BUSY errors.
// journal_mode returns a result row so we use $queryRawUnsafe; busy_timeout
// does not return rows so we use $executeRawUnsafe.
let pragmasApplied = false;
export async function ensurePragmas() {
  if (pragmasApplied) return;
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;");
  pragmasApplied = true;
}
