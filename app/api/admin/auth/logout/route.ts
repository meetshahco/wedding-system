import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST() {
  const session = await getSession();
  if (session.isLoggedIn && session.userId) {
    await logAuditEvent({
      userId: session.userId,
      weddingId: session.activeWeddingId,
      action: "USER_LOGOUT",
    });
  }
  session.destroy();
  return NextResponse.json({ ok: true });
}
