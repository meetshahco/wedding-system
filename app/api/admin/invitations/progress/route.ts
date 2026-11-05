import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { getInvitationProgress } from "@/lib/invitation-service";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const progress = await getInvitationProgress(wedding.id);
    return NextResponse.json({ progress });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

