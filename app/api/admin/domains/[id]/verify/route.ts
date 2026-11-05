import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { vercelDomains } from "@/lib/domains/vercel-service";
import { logAuditEvent } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
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

    const [verifyResult, configResult] = await Promise.all([
      vercelDomains.verifyDomain(domainRecord.domain),
      vercelDomains.getDomainConfig(domainRecord.domain),
    ]);

    const isVerified = verifyResult.verified || configResult.configured;
    const newStatus = isVerified ? "active" : "configuring";

    const updated = await prisma.weddingDomain.update({
      where: { id },
      data: {
        status: newStatus,
        vercelConfig: JSON.stringify({ verifyResult, configResult }),
      },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "domain.verify",
      details: { domain: domainRecord.domain, isVerified, newStatus },
    });

    return NextResponse.json({
      success: true,
      verified: isVerified,
      status: newStatus,
      domain: updated,
      dns: {
        type: configResult.type || "CNAME",
        recommendedValue: configResult.recommendedValue || "cname.vercel-dns.com",
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

