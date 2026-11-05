import { prisma } from "./prisma";

export interface TemplateVariables {
  guest_name?: string;
  couple_names?: string;
  wedding_date?: string;
  pax?: number | string;
  code?: string;
  invite_url?: string;
  access_level?: string;
  [key: string]: string | number | undefined;
}

/**
 * Replaces {{variable}} placeholders in template text with their values.
 * Fully supports Unicode (Devanagari, Gujarati, Arabic, accented characters, emojis).
 */
export function renderTemplate(templateBody: string, variables: TemplateVariables): string {
  if (!templateBody) return "";

  return templateBody.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
    const val = variables[key];
    if (val !== undefined && val !== null) {
      return String(val);
    }
    return match; // Keep placeholder if variable is not provided
  });
}

/**
 * Standard default templates in multiple languages (English, Hindi, Gujarati).
 */
export const DEFAULT_TEMPLATES = [
  // English Invitation
  {
    key: "invitation",
    language: "en",
    category: "Utility",
    body: `Dear {{guest_name}},\n\nWe are joyful to invite you to celebrate our wedding!\n\nCouple: {{couple_names}}\nDate: {{wedding_date}}\nReserved Seats: {{pax}}\nAccess Tier: {{access_level}}\n\nPlease view your personalized invitation and celebration schedule using your code {{code}} here:\n{{invite_url}}\n\nWith love,\n{{couple_names}}`,
    buttons: JSON.stringify([{ type: "url", text: "View Invitation", url: "{{invite_url}}" }]),
    sampleValues: JSON.stringify({
      guest_name: "Aarav Sharma",
      couple_names: "Priya & Rohan",
      wedding_date: "April 15, 2027",
      pax: 2,
      access_level: "All Events",
      code: "1234",
      invite_url: "https://weddings.test/i/demo123",
    }),
  },
  // Hindi Invitation
  {
    key: "invitation",
    language: "hi",
    category: "Utility",
    body: `नमस्ते {{guest_name}},\n\nहम आपको अपने विवाह समारोह में सादर आमंत्रित करते हैं।\n\nवर-वधु: {{couple_names}}\nदिनांक: {{wedding_date}}\nआरक्षित स्थान: {{pax}}\n\nकृपया अपने कोड {{code}} का उपयोग करके अपना निमंत्रण देखें:\n{{invite_url}}\n\nस्नेह सहित,\n{{couple_names}}`,
    buttons: JSON.stringify([{ type: "url", text: "निमंत्रण देखें", url: "{{invite_url}}" }]),
    sampleValues: JSON.stringify({
      guest_name: "अमित कुमार",
      couple_names: "प्रिया और रोहन",
      wedding_date: "15 अप्रैल, 2027",
      pax: 2,
      access_level: "सभी कार्यक्रम",
      code: "1234",
      invite_url: "https://weddings.test/i/demo123",
    }),
  },
  // Gujarati Invitation
  {
    key: "invitation",
    language: "gu",
    category: "Utility",
    body: `સ્નેહી {{guest_name}},\n\nઅમારા લગ્ન ઉત્સવ પ્રસંગે આપને સહપરિવાર ભાવભર્યું આમંત્રણ છે!\n\nદંપતી: {{couple_names}}\nતારીખ: {{wedding_date}}\nઆમંત્રિત સભ્યો: {{pax}}\n\nઆપનું ડિજિટલ આમંત્રણ કાર્ડ જોવા માટે અહીં ક્લિક કરો (કોડ: {{code}}):\n{{invite_url}}\n\nલિ. સ્નેહાધીન,\n{{couple_names}}`,
    buttons: JSON.stringify([{ type: "url", text: "આમંત્રણ જુઓ", url: "{{invite_url}}" }]),
    sampleValues: JSON.stringify({
      guest_name: "પ્રિયાંક શાહ",
      couple_names: "પ્રિયા અને રોહન",
      wedding_date: "૧૫ એપ્રિલ, ૨૦૨૭",
      pax: 2,
      access_level: "તમામ પ્રસંગો",
      code: "1234",
      invite_url: "https://weddings.test/i/demo123",
    }),
  },
  // English Reminder
  {
    key: "reminder_1",
    language: "en",
    category: "Utility",
    body: `Hi {{guest_name}},\n\nOur wedding celebration is just around the corner! We can't wait to celebrate with you.\n\nDate: {{wedding_date}}\nCelebration Schedule: {{invite_url}}\n\nWith love,\n{{couple_names}}`,
    buttons: JSON.stringify([{ type: "url", text: "Celebration Details", url: "{{invite_url}}" }]),
    sampleValues: JSON.stringify({
      guest_name: "Aarav Sharma",
      couple_names: "Priya & Rohan",
      wedding_date: "April 15, 2027",
      invite_url: "https://weddings.test/i/demo123",
    }),
  },
];

/**
 * Resolves the appropriate template for a guest based on language preference.
 * Falls back to "en" if the requested language is not available.
 */
export async function resolveTemplateForGuest(
  weddingId: string,
  templateKey: string,
  guestLanguage = "en"
) {
  // Try exact match on language
  let template = await prisma.messageTemplate.findUnique({
    where: {
      weddingId_key_language: {
        weddingId,
        key: templateKey,
        language: guestLanguage,
      },
    },
  });

  // Fallback to "en" if not found
  if (!template && guestLanguage !== "en") {
    template = await prisma.messageTemplate.findUnique({
      where: {
        weddingId_key_language: {
          weddingId,
          key: templateKey,
          language: "en",
        },
      },
    });
  }

  // Fallback to any language available for this key
  if (!template) {
    template = await prisma.messageTemplate.findFirst({
      where: {
        weddingId,
        key: templateKey,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  return template;
}
