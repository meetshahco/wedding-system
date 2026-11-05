import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { UpdateUserStatusSchema } from "@/lib/zod-schemas";
import { logAuditEvent } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOwner();
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = UpdateUserStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const { isActive, globalRole, weddingId, weddingRole } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (globalRole !== undefined) updateData.globalRole = globalRole;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    if (weddingId && weddingRole !== undefined) {
      if (weddingRole === null) {
        await prisma.weddingAccess.deleteMany({
          where: { userId: id, weddingId },
        });
      } else {
        await prisma.weddingAccess.upsert({
          where: { userId_weddingId: { userId: id, weddingId } },
          update: { role: weddingRole },
          create: { userId: id, weddingId, role: weddingRole },
        });
      }
    }

    await logAuditEvent({
      userId: session.userId,
      action: "USER_UPDATED",
      details: { targetUserId: id, updateData },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 500 });
  }
}
