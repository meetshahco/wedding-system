import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto-passwords";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireAuth();
    const body = await req.json().catch(() => null);

    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const upgradedHash = hashPassword(newPassword);

    await prisma.user.update({
      where: { id: sessionUser.userId },
      data: {
        passwordHash: upgradedHash,
        mustChangePassword: false,
      },
    });

    // Update active session
    const session = await getSession();
    session.mustChangePassword = false;
    await session.save();

    await logAuditEvent({
      userId: sessionUser.userId,
      weddingId: sessionUser.activeWeddingId,
      action: "USER_PASSWORD_CHANGED",
      details: { email: sessionUser.email },
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });

    return NextResponse.json({ success: true, message: "Password updated successfully." });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
