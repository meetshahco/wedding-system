import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireAuth();

    // Fetch accessible weddings
    let weddings;
    if (session.globalRole === "OWNER" || session.globalRole === "MANAGER") {
      weddings = await prisma.wedding.findMany({
        where: { archived: false },
        select: {
          id: true,
          slug: true,
          coupleName1: true,
          coupleName2: true,
          weddingDate: true,
          accentColor: true,
        },
        orderBy: { weddingDate: "asc" },
      });
    } else {
      const accesses = await prisma.weddingAccess.findMany({
        where: { userId: session.userId, wedding: { archived: false } },
        include: {
          wedding: {
            select: {
              id: true,
              slug: true,
              coupleName1: true,
              coupleName2: true,
              weddingDate: true,
              accentColor: true,
            },
          },
        },
      });
      weddings = accesses.map((a) => a.wedding);
    }

    // Resolve active wedding details
    const activeWedding = weddings.find((w) => w.id === session.activeWeddingId) || weddings[0] || null;

    return NextResponse.json({
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        globalRole: session.globalRole,
      },
      activeWedding,
      weddings,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
