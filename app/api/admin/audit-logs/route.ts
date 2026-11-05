import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const weddingId = req.nextUrl.searchParams.get("weddingId");

    const where: Record<string, unknown> = {};

    if (session.globalRole !== "OWNER") {
      // Non-owners can only see logs for weddings they have access to
      const accesses = await prisma.weddingAccess.findMany({
        where: { userId: session.userId },
        select: { weddingId: true },
      });
      const allowedWeddingIds = accesses.map((a) => a.weddingId);

      if (weddingId) {
        if (!allowedWeddingIds.includes(weddingId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        where.weddingId = weddingId;
      } else {
        where.weddingId = { in: allowedWeddingIds };
      }
    } else if (weddingId) {
      where.weddingId = weddingId;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        wedding: { select: { id: true, slug: true, coupleName1: true, coupleName2: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ logs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
