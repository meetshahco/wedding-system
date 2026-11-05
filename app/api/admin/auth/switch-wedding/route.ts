import { NextRequest, NextResponse } from "next/server";
import { getSession, requireWeddingAccess } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const targetWeddingId = body?.weddingId;

    if (!targetWeddingId) {
      return NextResponse.json({ error: "Missing weddingId" }, { status: 400 });
    }

    // Verify access
    await requireWeddingAccess(targetWeddingId, "VIEWER");

    const session = await getSession();
    session.activeWeddingId = targetWeddingId;
    await session.save();

    const response = NextResponse.json({ success: true, activeWeddingId: targetWeddingId });
    // Also set a readable cookie for clients and middleware
    response.cookies.set("wedding_active_id", targetWeddingId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 401 });
  }
}
