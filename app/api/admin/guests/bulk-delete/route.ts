import { NextRequest, NextResponse } from "next/server";
import { prisma, ensurePragmas } from "@/lib/prisma";
import { BulkDeleteSchema } from "@/lib/zod-schemas";

export async function POST(req: NextRequest) {
  await ensurePragmas();

  const body = await req.json().catch(() => null);
  const parsed = BulkDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid guest IDs" }, { status: 400 });
  }

  const { count } = await prisma.guest.deleteMany({
    where: { id: { in: parsed.data.ids } },
  });

  return NextResponse.json({ success: true, deletedCount: count });
}

