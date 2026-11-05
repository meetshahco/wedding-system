/**
 * Centralised invite link builder.
 * All domain and URL construction for guests must route through this function.
 */

export interface LinkGuest {
  token: string;
}

export interface LinkWedding {
  slug?: string;
  primaryDomain?: string | null;
}

/**
 * Builds the canonical public invitation URL for a guest.
 *
 * @param guest   The guest object containing their unique token
 * @param wedding Optional wedding context (for custom domains or future slug-prefixed routes)
 * @param baseUrl Optional override for base URL (defaults to NEXT_PUBLIC_BASE_URL or window.location.origin)
 */
export function getInviteUrl(
  guest: LinkGuest,
  wedding?: LinkWedding,
  baseUrl?: string
): string {
  // If a wedding has a custom primary domain attached, use that domain directly
  if (wedding?.primaryDomain) {
    const protocol = wedding.primaryDomain.includes("localhost") ? "http" : "https";
    const cleanDomain = wedding.primaryDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `${protocol}://${cleanDomain}/i/${guest.token}`;
  }

  // Resolve base URL
  let base = baseUrl;
  if (!base) {
    if (typeof window !== "undefined" && window.location?.origin) {
      base = window.location.origin;
    } else {
      base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    }
  }

  const cleanBase = base.replace(/\/$/, "");
  return `${cleanBase}/i/${guest.token}`;
}

/**
 * Builds the public wedding landing/code-entry page URL.
 */
export function getWeddingLandingUrl(
  wedding: { slug: string; primaryDomain?: string | null },
  baseUrl?: string
): string {
  if (wedding.primaryDomain) {
    const protocol = wedding.primaryDomain.includes("localhost") ? "http" : "https";
    const cleanDomain = wedding.primaryDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `${protocol}://${cleanDomain}`;
  }

  let base = baseUrl;
  if (!base) {
    if (typeof window !== "undefined" && window.location?.origin) {
      base = window.location.origin;
    } else {
      base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    }
  }

  const cleanBase = base.replace(/\/$/, "");
  return `${cleanBase}/w/${wedding.slug}`;
}

