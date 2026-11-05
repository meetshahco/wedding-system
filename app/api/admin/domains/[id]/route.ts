import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { vercelDomains } from "@/lib/domains/vercel-service";
import { logAuditEvent } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const domainRecord = await prisma.weddingDomain.findFirst({
      where: { id, weddingId: wedding.id },
    });

    if (!domainRecord) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    // Remove from Vercel
    await vercelDomains.removeDomain(domainRecord.domain);

    // Remove from DB
    await prisma.weddingDomain.delete({
      where: { id },
    });

    // If deleted domain was primary, promote remaining domain if one exists
    if (domainRecord.isPrimary) {
      const remaining = await prisma.weddingDomain.findFirst({
        where: { weddingId: wedding.id },
        orderBy: { createdAt: "asc" },
      });
      if (remaining) {
        await prisma.weddingDomain.update({
          where: { id: remaining.id },
          data: { isPrimary: true },
        });
      }
    }

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "domain.delete",
      details: { domain: domainRecord.domain },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
