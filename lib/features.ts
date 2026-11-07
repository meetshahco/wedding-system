/**
 * Feature flag configuration.
 *
 * ENABLE_WHATSAPP_API:
 * - default: false
 * - When false: WhatsApp Business API features are visible but locked as "Coming soon".
 * - When true: All WhatsApp Cloud API features are unlocked and active.
 */

export function isWhatsAppApiEnabled(): boolean {
  return process.env.ENABLE_WHATSAPP_API === "true";
}

