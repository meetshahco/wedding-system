import { NextRequest, NextResponse } from "next/server";
import { cloudApiProvider } from "@/lib/providers/cloud-api-provider";
import { isWhatsAppApiEnabled } from "@/lib/features";

/**
 * GET /api/webhooks/whatsapp
 * Webhook Verification Handshake from Meta.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifiedChallenge = cloudApiProvider.verifyHandshake(mode, token, challenge);

  if (verifiedChallenge) {
    return new NextResponse(verifiedChallenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 * Webhook Event Notification from Meta (Delivery statuses & Inbound messages).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    // Cryptographic signature check
    const isValid = cloudApiProvider.verifySignature(rawBody, signature);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!isWhatsAppApiEnabled()) {
      return NextResponse.json(
        { success: true, message: "WhatsApp API is disabled. Event acknowledged." },
        { status: 200 }
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const result = await cloudApiProvider.processWebhookEvent(payload);

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Return 200 to acknowledge receipt to Meta to prevent retry storm on unexpected payload formats
    return NextResponse.json({ error: "Internal processing error" }, { status: 200 });
  }
}

