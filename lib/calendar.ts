/**
 * RFC 5545 iCalendar (.ics) generation for wedding events.
 */

interface CalendarEventParams {
  id: string;
  name: string;
  date: Date;
  startTime: string;
  venue: string;
  address: string;
  description?: string;
  durationHours?: number;
}

/**
 * Parses time string (e.g. "7:00 PM", "10:30 AM", "19:00") into hours and minutes.
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes("PM");
  const isAM = clean.includes("AM");

  const numbersOnly = clean.replace(/[^\d:]/g, "");
  const parts = numbersOnly.split(":");
  let hours = parseInt(parts[0] || "0", 10);
  const minutes = parseInt(parts[1] || "0", 10);

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return { hours, minutes };
}

/**
 * Formats a JavaScript Date to UTC iCalendar format: YYYYMMDDTHHmmssZ
 */
function formatIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hours = pad(d.getUTCHours());
  const minutes = pad(d.getUTCMinutes());
  const seconds = pad(d.getUTCSeconds());

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escapes text for iCalendar format.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Generates valid iCalendar (.ics) string.
 */
export function generateIcs(params: CalendarEventParams): string {
  const { id, name, date, startTime, venue, address, description = "", durationHours = 3 } = params;

  const { hours, minutes } = parseTimeString(startTime);

  // Build Start Date
  const startDate = new Date(date);
  startDate.setHours(hours, minutes, 0, 0);

  // Build End Date
  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

  const now = new Date();
  const uid = `${id}-${startDate.getTime()}@wedding.events`;
  const location = [venue, address].filter(Boolean).join(", ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wedding Manager//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${escapeIcsText(name)}`,
    `LOCATION:${escapeIcsText(location)}`,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : null,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n") + "\r\n";
}

