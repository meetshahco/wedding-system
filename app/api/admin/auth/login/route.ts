import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { LoginSchema } from "@/lib/zod-schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { ensurePragmas } from "@/lib/prisma";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  await ensurePragmas();

  const ip = getClientIp(req);

  // Rate limit: 10 attempts per 15 minutes per IP
  const { allowed, remaining, resetAt } = await checkRateLimit(
    ip,
    "admin_login",
    10,
    15 * 60 * 1000
  );

  if (!allowed) {
    return NextResponse.json(
      {
        error: `Too many login attempts. Try again after ${resetAt.toLocaleTimeString()}.`,
      },
      { status: 429 }
    );
  }

  // Parse and validate
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD env var is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  if (parsed.data.password !== adminPassword) {
    return NextResponse.json(
      { error: `Invalid password. ${remaining} attempt(s) remaining.` },
      { status: 401 }
    );
  }

  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true });
}

