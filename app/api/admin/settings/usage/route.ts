import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { getUsageReport, generateUsageCsv } from "@/lib/dashboard-service";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const searchParams = req.nextUrl.searchParams;
    const isExport = searchParams.get("export") === "csv";
    const utilityRate = parseFloat(searchParams.get("utilityRate") || "0.35");
    const marketingRate = parseFloat(searchParams.get("marketingRate") || "0.80");
    const currency = searchParams.get("currency") || "INR";

    const rateOptions = {
      rates: {
        utility: isNaN(utilityRate) ? 0.35 : utilityRate,
        marketing: isNaN(marketingRate) ? 0.80 : marketingRate,
        currency,
      },
    };

    if (isExport) {
      const csv = await generateUsageCsv(wedding.id, rateOptions);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="wedding-usage-${wedding.slug}-${Date.now()}.csv"`,
        },
      });
    }

    const report = await getUsageReport(wedding.id, rateOptions);
    return NextResponse.json({ report });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

