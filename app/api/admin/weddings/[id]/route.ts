import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWeddingAccess } from "@/lib/auth";
import { UpdateWeddingSchema } from "@/lib/zod-schemas";
import { logAuditEvent } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireWeddingAccess(id, "VIEWER");

    const wedding = await prisma.wedding.findUnique({
      where: { id },
      include: {
        _count: {
          select: { guests: true, events: true },
        },
      },
    });

    if (!wedding) {
      return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
    }

    return NextResponse.json({ wedding });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 401 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session } = await requireWeddingAccess(id, "MANAGER");

    const body = await req.json().catch(() => null);
    const parsed = UpdateWeddingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.coupleName1 !== undefined) updateData.coupleName1 = parsed.data.coupleName1;
    if (parsed.data.coupleName2 !== undefined) updateData.coupleName2 = parsed.data.coupleName2;
    if (parsed.data.weddingDate !== undefined) updateData.weddingDate = new Date(parsed.data.weddingDate);
    if (parsed.data.accentColor !== undefined) updateData.accentColor = parsed.data.accentColor;
    if (body?.archived !== undefined) updateData.archived = Boolean(body.archived);

    const updated = await prisma.wedding.update({
      where: { id },
      data: updateData,
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: id,
      action: "WEDDING_UPDATED",
      details: updateData,
    });

    return NextResponse.json({ wedding: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 500 });
  }
}

