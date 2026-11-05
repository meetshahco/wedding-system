import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { seedDefaultTemplates } from "@/lib/template-renderer";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    // Ensure default templates are present
    await seedDefaultTemplates(wedding.id);

    const templates = await prisma.messageTemplate.findMany({
      where: { weddingId: wedding.id },
      orderBy: [{ key: "asc" }, { language: "asc" }],
    });

    return NextResponse.json({ templates });
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
    const key = typeof body?.key === "string" ? body.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_") : "";
    const language = typeof body?.language === "string" ? body.language.trim().toLowerCase() : "en";
    const category = typeof body?.category === "string" ? body.category.trim() : "Utility";
    const bodyText = typeof body?.body === "string" ? body.body.trim() : "";
    const buttons = typeof body?.buttons === "string" ? body.buttons : "[]";
    const sampleValues = typeof body?.sampleValues === "string" ? body.sampleValues : "{}";

    if (!key) {
      return NextResponse.json({ error: "Template key is required" }, { status: 400 });
    }
    if (!bodyText) {
      return NextResponse.json({ error: "Template body text is required" }, { status: 400 });
    }

    const existing = await prisma.messageTemplate.findUnique({
      where: {
        weddingId_key_language: {
          weddingId: wedding.id,
          key,
          language,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A template with key '${key}' and language '${language}' already exists.` },
        { status: 400 }
      );
    }

    const template = await prisma.messageTemplate.create({
      data: {
        weddingId: wedding.id,
        key,
        language,
        category,
        body: bodyText,
        buttons,
        sampleValues,
      },
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "templates.create",
      details: { templateId: template.id, key, language },
    });

    return NextResponse.json({ success: true, template });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
