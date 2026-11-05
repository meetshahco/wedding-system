import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { vercelDomains } from "@/lib/domains/vercel-service";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const domains = await prisma.weddingDomain.findMany({
      where: { weddingId: wedding.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    const platformDomain = process.env.PLATFORM_DOMAIN || "weddings.test";
    const subdomain = `${wedding.slug}.${platformDomain}`;

    return NextResponse.json({
      domains,
      platformSubdomain: subdomain,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const body = await req.json().catch(() => null);
    const rawDomain = typeof body?.domain === "string" ? body.domain.toLowerCase().trim() : "";
    const cleanDomain = rawDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    if (!cleanDomain || !cleanDomain.includes(".")) {
      return NextResponse.json({ error: "Please enter a valid domain name (e.g. yourwedding.com)" }, { status: 400 });
    }

    // Check uniqueness
    const existing = await prisma.weddingDomain.findUnique({
      where: { domain: cleanDomain },
    });

    if (existing) {
      return NextResponse.json({ error: "This domain is already registered in the system." }, { status: 400 });
    }

    // Add to Vercel project
    const vercelResult = await vercelDomains.addDomain(cleanDomain);
    if (!vercelResult.success) {
      return NextResponse.json({ error: vercelResult.error || "Failed to register domain with Vercel" }, { status: 400 });
    }

    // If first domain, automatically make primary
    const existingCount = await prisma.weddingDomain.count({ where: { weddingId: wedding.id } });
    const isPrimary = existingCount === 0 || Boolean(body?.isPrimary);

    if (isPrimary && existingCount > 0) {
      await prisma.weddingDomain.updateMany({
        where: { weddingId: wedding.id },
        data: { isPrimary: false },
      });
    }

    const domainRecord = await prisma.weddingDomain.create({
      data: {
        weddingId: wedding.id,
        domain: cleanDomain,
        isPrimary,
        status: "configuring",
        vercelConfig: vercelResult.data ? JSON.stringify(vercelResult.data) : null,
      },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "domain.create",
      details: { domain: cleanDomain, isPrimary },
    });

    return NextResponse.json({ success: true, domain: domainRecord });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
