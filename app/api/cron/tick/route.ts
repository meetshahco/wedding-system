import { NextRequest, NextResponse } from "next/server";
import { processQueueBatch } from "@/lib/queue/processor";

export async function GET(req: NextRequest) {
  return handleCronTick(req);
}

export async function POST(req: NextRequest) {
  return handleCronTick(req);
}

async function handleCronTick(req: NextRequest) {
  // CRON_SECRET validation
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-cron-secret");

    const tokenFromAuth = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const isAuthorized = tokenFromAuth === cronSecret || customHeader === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized. Valid CRON_SECRET required." },
        { status: 401 }
      );
    }
  }

  try {
    const url = new URL(req.url);
    const batchParam = url.searchParams.get("batchSize");
    const batchSize = batchParam ? Math.min(100, Math.max(1, parseInt(batchParam, 10))) : 20;

    const summary = await processQueueBatch({ batchSize });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (error) {
    console.error("Cron tick error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
