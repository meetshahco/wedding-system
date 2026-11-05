import { renderTemplate, TemplateVariables } from "../template-renderer";

/**
 * ManualLinkProvider generates clickable wa.me WhatsApp links
 * for senders to dispatch invitations and reminders manually.
 */
export class ManualLinkProvider {
  /**
   * Normalises an E.164 or local phone number to digits only for wa.me URLs.
   */
  static cleanPhoneForWaMe(phone: string): string {
    return phone.replace(/[^\d]/g, "");
  }

  /**
   * Generates a fully encoded wa.me URL.
   * Handles Unicode text (Devanagari, Gujarati, Arabic, emojis, newlines) safely.
   */
  static generateWhatsAppUrl(phone: string, text: string): string {
    const cleanPhone = this.cleanPhoneForWaMe(phone);
    const encodedText = encodeURIComponent(text);
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }

  /**
   * Renders the message text for a guest, using a sender's custom override if provided.
   */
  static renderMessage(
    defaultBody: string,
    variables: TemplateVariables,
    senderOverride?: string | null
  ): string {
    const templateToUse = senderOverride?.trim() ? senderOverride.trim() : defaultBody;
    return renderTemplate(templateToUse, variables);
  }
}

