import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { getMatchingAudience, AudienceFilter } from "@/lib/reminder-service";

export async function POST(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const body = await req.json().catch(() => ({}));
    const filter: AudienceFilter = {
      accessLevelId: body?.accessLevelId || undefined,
      city: body?.city || undefined,
      group: body?.group || undefined,
      senderId: body?.senderId || undefined,
      notSentYet: Boolean(body?.notSentYet),
      notOpenedYet: Boolean(body?.notOpenedYet),
      hasPhoneOnly: body?.hasPhoneOnly !== false,
      excludeOptedOut: body?.excludeOptedOut !== false,
    };

    const result = await getMatchingAudience(wedding.id, filter);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

