import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { BulkDeleteSchema } from "@/lib/zod-schemas";

export async function POST(req: NextRequest) {
  const { scoped } = await getWeddingContext(req);

  const body = await req.json().catch(() => null);
  const parsed = BulkDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid guest IDs" }, { status: 400 });
  }

  const { count } = await scoped.guest.deleteMany({
    where: { id: { in: parsed.data.ids } },
  });

  return NextResponse.json({ success: true, deletedCount: count });
}
