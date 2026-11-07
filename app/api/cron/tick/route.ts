import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { processQueueBatch } from "@/lib/queue/processor";

function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  return handleCronTick(req);
}

export async function POST(req: NextRequest) {
  return handleCronTick(req);
}

async function handleCronTick(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: CRON_SECRET is not configured." },
      { status: 401 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const customHeader = req.headers.get("x-cron-secret");

  const tokenFromAuth = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = tokenFromAuth || customHeader;

  if (!token || !constantTimeCompare(token, cronSecret)) {
    return NextResponse.json(
      { error: "Unauthorized. Valid CRON_SECRET required." },
      { status: 401 }
    );
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
