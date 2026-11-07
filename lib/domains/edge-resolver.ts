/**
 * Edge-compatible host resolution utilities.
 * Pure string parsing with zero Node.js/database dependencies, safe for Next.js Middleware.
 */

export function cleanHost(hostHeader: string | null | undefined): string {
  if (!hostHeader) return "localhost";
  return hostHeader.split(":")[0].toLowerCase().trim();
}

export function isPlatformHost(hostHeader: string | null | undefined): boolean {
  const host = cleanHost(hostHeader);
  const platformDomain = (process.env.PLATFORM_DOMAIN || "weddings.test").toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === platformDomain ||
    host === `www.${platformDomain}`
  );
}

export function getSubdomainSlug(hostHeader: string | null | undefined): string | null {
  const host = cleanHost(hostHeader);
  const platformDomain = (process.env.PLATFORM_DOMAIN || "weddings.test").toLowerCase();
  if (host.endsWith(`.${platformDomain}`)) {
    return host.replace(`.${platformDomain}`, "");
  }
  return null;
}

