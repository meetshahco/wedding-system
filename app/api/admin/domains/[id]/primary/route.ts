import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const targetDomain = await prisma.weddingDomain.findFirst({
      where: { id, weddingId: wedding.id },
    });

    if (!targetDomain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    // Set all other domains for this wedding to isPrimary: false
    await prisma.weddingDomain.updateMany({
      where: { weddingId: wedding.id },
      data: { isPrimary: false },
    });

    // Set target to primary
    const updated = await prisma.weddingDomain.update({
      where: { id },
      data: { isPrimary: true },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "domain.set_primary",
      details: { domain: targetDomain.domain },
    });

    return NextResponse.json({ success: true, domain: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

