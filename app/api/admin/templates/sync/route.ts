import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { isWhatsAppApiEnabled } from "@/lib/features";

export async function POST(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "MANAGER");

    if (!isWhatsAppApiEnabled()) {
      return NextResponse.json(
        { error: "WhatsApp API sending is coming soon" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Template sync completed successfully.",
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

