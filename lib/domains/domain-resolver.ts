import { prisma } from "../prisma";
import { Wedding, WeddingDomain } from "@prisma/client";

export interface HostResolution {
  type: "platform" | "wedding_subdomain" | "wedding_custom_domain" | "unknown";
  wedding?: Wedding;
  domain?: WeddingDomain;
  isWeddingHost: boolean;
}

/**
 * Normalises an incoming hostname by lowercasing and stripping port numbers.
 */
export function cleanHost(hostHeader: string | null | undefined): string {
  if (!hostHeader) return "localhost";
  return hostHeader.split(":")[0].toLowerCase().trim();
}

/**
 * Resolves the incoming hostname to determine if it is the platform host,
 * a wedding subdomain, an active custom domain, or an unknown host.
 */
export async function resolveHost(hostHeader: string | null | undefined): Promise<HostResolution> {
  const host = cleanHost(hostHeader);
  const platformDomain = (process.env.PLATFORM_DOMAIN || "weddings.test").toLowerCase();

  // 1. Root platform host (e.g. localhost, 127.0.0.1, weddings.test, app.weddings.com)
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === platformDomain ||
    host === `www.${platformDomain}`
  ) {
    return {
      type: "platform",
      isWeddingHost: false,
    };
  }

  try {
    // 2. Platform Subdomain (e.g. arjun.weddings.test)
    if (host.endsWith(`.${platformDomain}`)) {
      const slug = host.replace(`.${platformDomain}`, "");
      const wedding = await prisma.wedding.findUnique({
        where: { slug },
      });

      if (wedding) {
        return {
          type: "wedding_subdomain",
          wedding,
          isWeddingHost: true,
        };
      }
    }

    // 3. Custom Domain Lookup in WeddingDomain table (e.g. arjunandmeera.com)
    const domainRecord = await prisma.weddingDomain.findFirst({
      where: {
        domain: host,
        status: "active",
      },
      include: {
        wedding: true,
      },
    });

    if (domainRecord) {
      return {
        type: "wedding_custom_domain",
        wedding: domainRecord.wedding,
        domain: domainRecord,
        isWeddingHost: true,
      };
    }

    // Also check without www if www was supplied
    if (host.startsWith("www.")) {
      const nonWww = host.replace(/^www\./, "");
      const nonWwwRecord = await prisma.weddingDomain.findFirst({
        where: {
          domain: nonWww,
          status: "active",
        },
        include: {
          wedding: true,
        },
      });

      if (nonWwwRecord) {
        return {
          type: "wedding_custom_domain",
          wedding: nonWwwRecord.wedding,
          domain: nonWwwRecord,
          isWeddingHost: true,
        };
      }
    }
  } catch {
    // In Edge runtime where Prisma is unsupported, fallback safely
  }

  return {
    type: "unknown",
    isWeddingHost: false,
  };
}

/**
 * Checks if a guest invitation request on the platform host should be redirected
 * to the wedding's primary custom domain.
 */
export async function getPrimaryDomainRedirect(
  currentHost: string,
  guestToken: string
): Promise<string | null> {
  const host = cleanHost(currentHost);
  const platformDomain = (process.env.PLATFORM_DOMAIN || "weddings.test").toLowerCase();

  const isPlatform =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === platformDomain ||
    host === `www.${platformDomain}`;

  // Only redirect if accessed on platform host
  if (!isPlatform) return null;

  const guest = await prisma.guest.findUnique({
    where: { token: guestToken },
    include: {
      wedding: {
        include: {
          domains: {
            where: { isPrimary: true, status: "active" },
          },
        },
      },
    },
  });

  const primaryDomain = guest?.wedding?.domains?.[0]?.domain;
  if (!primaryDomain) return null;

  const protocol = primaryDomain.includes("localhost") ? "http" : "https";
  return `${protocol}://${primaryDomain}/i/${guestToken}`;
}

