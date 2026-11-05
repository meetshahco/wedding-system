import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AcceptInviteSchema } from "@/lib/zod-schemas";
import { hashPassword } from "@/lib/crypto-passwords";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = AcceptInviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { token, name, password } = parsed.data;

  // Lookup invite
  const invite = await prisma.userInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invalid or expired invite token" }, { status: 404 });
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: "This invite link has already been used" }, { status: 410 });
  }

  if (new Date() > invite.expiresAt) {
    return NextResponse.json({ error: "This invite link has expired" }, { status: 410 });
  }

  const passwordHash = hashPassword(password);

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email: invite.email.toLowerCase().trim() },
    update: {
      name,
      passwordHash,
      isActive: true,
      globalRole: invite.targetRole,
    },
    create: {
      email: invite.email.toLowerCase().trim(),
      name,
      passwordHash,
      isActive: true,
      globalRole: invite.targetRole,
    },
  });

  // Assign wedding access if specified in invite
  if (invite.weddingId) {
    await prisma.weddingAccess.upsert({
      where: {
        userId_weddingId: {
          userId: user.id,
          weddingId: invite.weddingId,
        },
      },
      update: {
        role: invite.weddingRole || "VIEWER",
      },
      create: {
        userId: user.id,
        weddingId: invite.weddingId,
        role: invite.weddingRole || "VIEWER",
      },
    });
  }

  // Mark invite as used
  await prisma.userInvite.update({
    where: { id: invite.id },
    data: { usedAt: new Date() },
  });

  // Audit log
  await logAuditEvent({
    userId: user.id,
    weddingId: invite.weddingId,
    action: "INVITE_ACCEPTED",
    details: { email: user.email, role: invite.targetRole },
  });

  return NextResponse.json({ success: true, email: user.email });
}

