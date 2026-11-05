import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { getDashboardStats, getGoLiveChecklist } from "@/lib/dashboard-service";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const [stats, checklist] = await Promise.all([
      getDashboardStats(wedding.id),
      getGoLiveChecklist(wedding.id),
    ]);

    return NextResponse.json({
      wedding: {
        id: wedding.id,
        slug: wedding.slug,
        coupleName1: wedding.coupleName1,
        coupleName2: wedding.coupleName2,
        weddingDate: wedding.weddingDate,
        accentColor: wedding.accentColor,
      },
      stats,
      checklist,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
