import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { InviteUserSchema } from "@/lib/zod-schemas";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";

export async function GET() {
  try {
    const session = await requireAuth();

    if (session.globalRole !== "OWNER" && session.globalRole !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [users, pendingInvites] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          globalRole: true,
          isActive: true,
          createdAt: true,
          weddingAccess: {
            include: {
              wedding: { select: { id: true, coupleName1: true, coupleName2: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userInvite.findMany({
        where: { usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ users, pendingInvites });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    if (session.globalRole !== "OWNER" && session.globalRole !== "MANAGER") {
      return NextResponse.json({ error: "Only Owners and Managers can invite users" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = InviteUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
    }

    const { email, targetRole, weddingId, weddingRole } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      // If user exists and weddingId is provided, grant wedding access directly
      if (weddingId) {
        await prisma.weddingAccess.upsert({
          where: {
            userId_weddingId: {
              userId: existingUser.id,
              weddingId,
            },
          },
          update: { role: weddingRole || "VIEWER" },
          create: {
            userId: existingUser.id,
            weddingId,
            role: weddingRole || "VIEWER",
          },
        });
        return NextResponse.json({ message: "Existing user granted access to wedding" });
      }
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    // Generate single-use expiring token (valid for 7 days)
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.userInvite.create({
      data: {
        email: email.toLowerCase().trim(),
        token,
        invitedById: session.userId,
        targetRole,
        weddingId: weddingId || null,
        weddingRole: weddingRole || "VIEWER",
        expiresAt,
      },
    });

    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const inviteUrl = `${origin}/invite/${token}`;

    await logAuditEvent({
      userId: session.userId,
      weddingId: weddingId || null,
      action: "USER_INVITED",
      details: { email: invite.email, role: targetRole },
    });

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
        inviteUrl,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to invite user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

