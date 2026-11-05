import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const template = await prisma.messageTemplate.findFirst({
      where: { id, weddingId: wedding.id },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const bodyText = typeof body?.body === "string" ? body.body.trim() : undefined;
    const category = typeof body?.category === "string" ? body.category.trim() : undefined;
    const buttons = typeof body?.buttons === "string" ? body.buttons : undefined;
    const sampleValues = typeof body?.sampleValues === "string" ? body.sampleValues : undefined;

    if (bodyText !== undefined && !bodyText) {
      return NextResponse.json({ error: "Template body cannot be empty" }, { status: 400 });
    }

    const updated = await prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(bodyText !== undefined ? { body: bodyText } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(buttons !== undefined ? { buttons } : {}),
        ...(sampleValues !== undefined ? { sampleValues } : {}),
      },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "templates.update",
      details: { templateId: id, key: template.key },
    });

    return NextResponse.json({ success: true, template: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const template = await prisma.messageTemplate.findFirst({
      where: { id, weddingId: wedding.id },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Protect primary English invitation template from deletion
    if (template.key === "invitation" && template.language === "en") {
      return NextResponse.json(
        { error: "The primary English invitation template cannot be deleted." },
        { status: 400 }
      );
    }

    await prisma.messageTemplate.delete({
      where: { id },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "templates.delete",
      details: { templateId: id, key: template.key },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

