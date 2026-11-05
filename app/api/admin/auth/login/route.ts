import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { LoginSchema } from "@/lib/zod-schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/crypto-passwords";
import { logAuditEvent } from "@/lib/audit";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email and password" },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      weddingAccess: {
        include: {
          wedding: { select: { id: true, slug: true, coupleName1: true, coupleName2: true } },
        },
      },
    },
  });

  if (!user || !user.isActive || !user.passwordHash) {
    return NextResponse.json(
      { error: `Invalid email or password. ${remaining} attempt(s) remaining.` },
      { status: 401 }
    );
  }

  const isPasswordValid = verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    return NextResponse.json(
      { error: `Invalid email or password. ${remaining} attempt(s) remaining.` },
      { status: 401 }
    );
  }

  // Resolve default active wedding
  let activeWeddingId: string | undefined = undefined;
  if (user.weddingAccess.length > 0) {
    activeWeddingId = user.weddingAccess[0].weddingId;
  } else {
    const firstWedding = await prisma.wedding.findFirst({
      where: { archived: false },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    activeWeddingId = firstWedding?.id;
  }

  // Set session
  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  session.globalRole = user.globalRole;
  session.activeWeddingId = activeWeddingId;
  session.isLoggedIn = true;
  await session.save();

  // Audit log
  await logAuditEvent({
    userId: user.id,
    weddingId: activeWeddingId,
    action: "USER_LOGIN",
    details: { email: user.email },
    ipAddress: ip,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      activeWeddingId,
    },
  });
}
