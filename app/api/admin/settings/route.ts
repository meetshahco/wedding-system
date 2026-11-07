import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { getSendingMethod, setSendingMethod, getWeddingDailyCap } from "@/lib/sending-settings";
import { getGoLiveChecklist } from "@/lib/dashboard-service";
import { logAuditEvent } from "@/lib/audit";
import { SendingMethod } from "@/lib/providers/types";
import { isWhatsAppApiEnabled } from "@/lib/features";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const [sendingMethod, dailyCap, checklist] = await Promise.all([
      getSendingMethod(wedding.id),
      getWeddingDailyCap(wedding.id),
      getGoLiveChecklist(wedding.id),
    ]);

    return NextResponse.json({
      wedding: {
        id: wedding.id,
        slug: wedding.slug,
        coupleName1: wedding.coupleName1,
        coupleName2: wedding.coupleName2,
        weddingDate: wedding.weddingDate,
        accentColor: wedding.accentColor,
        forwardGreetingRule: wedding.forwardGreetingRule,
      },
      sendingMethod,
      dailyCap,
      checklist,
      enableWhatsAppApi: isWhatsAppApiEnabled(),
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const coupleName1 = typeof body.coupleName1 === "string" ? body.coupleName1.trim() : wedding.coupleName1;
    const coupleName2 = typeof body.coupleName2 === "string" ? body.coupleName2.trim() : wedding.coupleName2;
    const weddingDate = body.weddingDate ? new Date(body.weddingDate) : wedding.weddingDate;
    const accentColor = typeof body.accentColor === "string" && body.accentColor.trim() ? body.accentColor.trim() : wedding.accentColor;
    const forwardGreetingRule = ["FIRST_NAME", "FAMILY", "NONE"].includes(body.forwardGreetingRule)
      ? body.forwardGreetingRule
      : wedding.forwardGreetingRule;
    const sendingMethod = body.sendingMethod as SendingMethod | undefined;
    const dailyCap = typeof body.dailyCap === "number" || typeof body.dailyCap === "string" ? parseInt(String(body.dailyCap), 10) : undefined;

    // Enforce server-side WhatsApp API lock
    if (sendingMethod && sendingMethod === "whatsapp_cloud" && !isWhatsAppApiEnabled()) {
      return NextResponse.json(
        { error: "WhatsApp API sending is coming soon" },
        { status: 403 }
      );
    }
    if (sendingMethod && sendingMethod === "mock" && process.env.NODE_ENV !== "development" && !isWhatsAppApiEnabled()) {
      return NextResponse.json(
        { error: "Mock engine is available in development only" },
        { status: 403 }
      );
    }

    // Update wedding record
    const updatedWedding = await prisma.wedding.update({
      where: { id: wedding.id },
      data: {
        coupleName1,
        coupleName2,
        weddingDate,
        accentColor,
        forwardGreetingRule,
      },
    });

    // Update sending method if supplied
    if (sendingMethod && ["mock", "whatsapp_cloud", "manual"].includes(sendingMethod)) {
      await setSendingMethod(wedding.id, sendingMethod);
    }

    // Update daily send cap if supplied
    if (dailyCap !== undefined && !isNaN(dailyCap) && dailyCap > 0) {
      await prisma.setting.upsert({
        where: { weddingId_key: { weddingId: wedding.id, key: "daily_send_cap" } },
        create: { weddingId: wedding.id, key: "daily_send_cap", value: String(dailyCap) },
        update: { value: String(dailyCap) },
      });
    }

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "wedding.update_settings",
      details: {
        coupleName1,
        coupleName2,
        sendingMethod,
        dailyCap,
      },
    });

    return NextResponse.json({ success: true, wedding: updatedWedding });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

