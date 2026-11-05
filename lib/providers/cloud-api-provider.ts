import crypto from "crypto";
import { MessageProvider, SendMessageParams, SendMessageResult } from "./types";
import { prisma } from "../prisma";
import { logAuditEvent } from "../audit";

export interface CloudApiConfig {
  phoneNumberId?: string;
  accessToken?: string;
  appSecret?: string;
  verifyToken?: string;
  graphApiVersion?: string;
  fetchFn?: typeof fetch;
}

export class CloudApiProvider implements MessageProvider {
  name = "whatsapp_cloud";

  private phoneNumberId: string;
  private accessToken: string;
  private appSecret: string;
  private verifyToken: string;
  private graphApiVersion: string;
  private fetchFn: typeof fetch;

  constructor(config: CloudApiConfig = {}) {
    this.phoneNumberId = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    this.accessToken = config.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || "";
    this.appSecret = config.appSecret || process.env.WHATSAPP_APP_SECRET || "";
    this.verifyToken = config.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || "";
    this.graphApiVersion = config.graphApiVersion || "v21.0";
    this.fetchFn = config.fetchFn || fetch;
  }

  /**
   * Normalises an E.164 phone number to digits only for WhatsApp Cloud API.
   */
  static cleanPhone(phone: string): string {
    return phone.replace(/[^\d]/g, "");
  }

  /**
   * Sends a message via Meta WhatsApp Cloud API.
   */
  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const { phone, templateKey, language = "en", body } = params;
    const cleanTo = CloudApiProvider.cleanPhone(phone);

    if (!cleanTo) {
      return {
        success: false,
        status: "failed",
        errorMessage: "Invalid or empty phone number",
        retryable: false,
      };
    }

    if (!this.phoneNumberId || !this.accessToken) {
      return {
        success: false,
        status: "failed",
        errorMessage: "WhatsApp Cloud API credentials not configured (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN missing)",
        retryable: false,
      };
    }

    const endpoint = `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}/messages`;

    // Construct payload: if templateKey is provided, send as template message; otherwise send text
    let payload: Record<string, unknown>;

    if (templateKey) {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "template",
        template: {
          name: templateKey,
          language: { code: language },
        },
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: { body },
      };
    }

    try {
      const res = await this.fetchFn(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorInfo = data?.error;
        const errorCode = errorInfo?.code;
        const errorMessage = errorInfo?.message || `HTTP ${res.status} from WhatsApp Cloud API`;

        // Rate limits (code 130429 or 80007) and temporary server errors (5xx) are retryable
        const isRetryable = res.status >= 500 || errorCode === 130429 || errorCode === 80007;

        return {
          success: false,
          status: "failed",
          errorMessage: `[Code ${errorCode || res.status}] ${errorMessage}`,
          retryable: isRetryable,
        };
      }

      const externalMessageId = data?.messages?.[0]?.id;

      return {
        success: true,
        status: "sent",
        externalMessageId,
      };
    } catch (err: unknown) {
      return {
        success: false,
        status: "failed",
        errorMessage: (err as Error).message || "Network error sending to WhatsApp Cloud API",
        retryable: true,
      };
    }
  }

  /**
   * Verifies the x-hub-signature-256 header sent by Meta using HMAC SHA-256.
   */
  verifySignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader || !this.appSecret) {
      return false;
    }

    const [scheme, signature] = signatureHeader.split("=");
    if (scheme !== "sha256" || !signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.appSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature.length !== signature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(signature, "utf8")
    );
  }

  /**
   * Verifies the webhook verification handshake challenge.
   */
  verifyHandshake(mode: string | null, token: string | null, challenge: string | null): string | null {
    if (mode === "subscribe" && token === this.verifyToken && challenge) {
      return challenge;
    }
    return null;
  }

  /**
   * Processes a verified webhook event payload from WhatsApp Cloud API.
   * Handles delivery status updates and inbound messages (including STOP opt-out).
   */
  async processWebhookEvent(payload: Record<string, unknown>): Promise<{
    processedStatuses: number;
    processedInbounds: number;
    optOuts: number;
  }> {
    let processedStatuses = 0;
    let processedInbounds = 0;
    let optOuts = 0;

    const entry = Array.isArray(payload?.entry) ? payload.entry : [];

    for (const item of entry) {
      const changes = Array.isArray(item?.changes) ? item.changes : [];

      for (const change of changes) {
        const val = change?.value as Record<string, unknown>;
        if (!val || val.messaging_product !== "whatsapp") continue;

        // 1. Process delivery statuses
        if (Array.isArray(val.statuses)) {
          for (const st of val.statuses as Record<string, unknown>[]) {
            const externalMessageId = st.id as string;
            const statusString = st.status as string; // sent | delivered | read | failed
            const timestampSeconds = parseInt(String(st.timestamp || "0"), 10);
            const eventTime = timestampSeconds > 0 ? new Date(timestampSeconds * 1000) : new Date();

            if (!externalMessageId) continue;

            const existingLog = await prisma.messageLog.findFirst({
              where: { externalMessageId },
              include: { guest: true },
            });

            if (!existingLog) continue;

            let newStatus: "sent" | "delivered" | "read" | "failed" | undefined;
            const updateData: Record<string, unknown> = {};

            if (statusString === "sent") {
              newStatus = "sent";
              updateData.status = "sent";
              updateData.sentAt = eventTime;
            } else if (statusString === "delivered") {
              newStatus = "delivered";
              updateData.status = "delivered";
              updateData.deliveredAt = eventTime;
            } else if (statusString === "read") {
              newStatus = "read";
              updateData.status = "read";
              updateData.readAt = eventTime;
            } else if (statusString === "failed") {
              newStatus = "failed";
              updateData.status = "failed";
              const errors = Array.isArray(st.errors) ? st.errors : [];
              const firstErr = errors[0] as Record<string, unknown>;
              updateData.errorMessage =
                firstErr?.title || firstErr?.message || "Delivery failed according to WhatsApp webhook";
            }

            if (newStatus) {
              await prisma.messageLog.update({
                where: { id: existingLog.id },
                data: updateData,
              });

              // If this was an invitation template, also update the Guest's inviteStatus
              if (existingLog.templateKey === "invitation") {
                await prisma.guest.update({
                  where: { id: existingLog.guestId },
                  data: { inviteStatus: newStatus },
                });
              }

              processedStatuses++;
            }
          }
        }

        // 2. Process inbound messages (STOP opt-out & lastInboundAt)
        if (Array.isArray(val.messages)) {
          for (const msg of val.messages as Record<string, unknown>[]) {
            const fromPhone = String(msg.from || "");
            const cleanFrom = CloudApiProvider.cleanPhone(fromPhone);
            const msgText = (msg.text as Record<string, unknown>)?.body as string || "";
            const trimmedText = msgText.trim().toUpperCase();
            const timestampSeconds = parseInt(String(msg.timestamp || "0"), 10);
            const eventTime = timestampSeconds > 0 ? new Date(timestampSeconds * 1000) : new Date();

            if (!cleanFrom) continue;

            // Find matching guest by clean phone (check with and without country code)
            const matchedGuests = await prisma.guest.findMany({
              where: {
                phone: { contains: cleanFrom.slice(-10) },
              },
            });

            for (const guest of matchedGuests) {
              // Update lastInboundAt
              await prisma.guest.update({
                where: { id: guest.id },
                data: { lastInboundAt: eventTime },
              });

              // Check for STOP / OPT-OUT keywords
              if (["STOP", "UNSUBSCRIBE", "CANCEL", "OPT-OUT", "OPTOUT"].includes(trimmedText)) {
                await prisma.guest.update({
                  where: { id: guest.id },
                  data: { optedOut: true },
                });

                await logAuditEvent({
                  weddingId: guest.weddingId,
                  action: "guest.opted_out",
                  details: {
                    guestId: guest.id,
                    phone: guest.phone,
                    inboundText: msgText,
                  },
                });

                optOuts++;
              } else if (["START", "UNSTOP", "RESUME"].includes(trimmedText)) {
                await prisma.guest.update({
                  where: { id: guest.id },
                  data: { optedOut: false },
                });

                await logAuditEvent({
                  weddingId: guest.weddingId,
                  action: "guest.opted_in",
                  details: {
                    guestId: guest.id,
                    phone: guest.phone,
                    inboundText: msgText,
                  },
                });
              }

              // Record inbound message log
              await prisma.messageLog.create({
                data: {
                  weddingId: guest.weddingId,
                  guestId: guest.id,
                  kind: "inbound",
                  provider: "whatsapp_cloud",
                  status: "read",
                  sentAt: eventTime,
                  errorMessage: msgText.slice(0, 500),
                },
              });

              processedInbounds++;
            }
          }
        }
      }
    }

    return { processedStatuses, processedInbounds, optOuts };
  }
}

export const cloudApiProvider = new CloudApiProvider();
