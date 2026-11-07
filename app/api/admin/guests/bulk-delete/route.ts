import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { BulkDeleteSchema } from "@/lib/zod-schemas";

export async function POST(req: NextRequest) {
  try {
    const { wedding, scoped } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "MANAGER");

    const body = await req.json().catch(() => null);
    const parsed = BulkDeleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid guest IDs" }, { status: 400 });
    }

    const { count } = await scoped.guest.deleteMany({
      where: { id: { in: parsed.data.ids } },
    });

    return NextResponse.json({ success: true, deletedCount: count });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
