import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";

const DEFAULT_COUNTRY: CountryCode = "IN"; // +91

/**
 * Parse and normalise a phone number string to E.164 format.
 * Returns null if the number is invalid.
 */
export function normalisePhone(raw: string): string | null {
  if (!raw) return null;
  const phone = parsePhoneNumberFromString(raw.trim(), DEFAULT_COUNTRY);
  if (!phone || !phone.isValid()) return null;
  return phone.format("E.164");
}

/**
 * Returns true if the string is already a valid E.164 number.
 */
export function isE164(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value);
}

/**
 * Strip the leading '+' for providers that require it (e.g. Meta Graph API).
 */
export function toMetaFormat(e164: string): string {
  return e164.replace(/^\+/, "");
}

