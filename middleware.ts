import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/auth";
import { resolveHost, getPrimaryDomainRedirect } from "@/lib/domains/domain-resolver";

function getMiddlewareSessionPassword(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL SECURITY ERROR: SESSION_SECRET is missing in production.");
  }
  return "dev-only-fallback-secret-at-least-32-chars-long";
}

const SESSION_OPTIONS = {
  get password() {
    return getMiddlewareSessionPassword();
  },
  cookieName: "wedding_admin_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  },
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // CSRF Protection: Verify Origin matches Host on state-changing requests to /api/admin/*
  if (
    pathname.startsWith("/api/admin") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (host && originHost !== host) {
          return NextResponse.json({ error: "Forbidden: Cross-site request rejected" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Forbidden: Invalid origin header" }, { status: 403 });
      }
    }
  }

  // 1. Resolve host
  const resolution = await resolveHost(host);

  // If host is unknown (not platform, not valid subdomain, not recognized active custom domain)
  if (resolution.type === "unknown") {
    return new NextResponse("Unknown Domain or Wedding Not Found", { status: 404 });
  }

  // 2. If accessing via a wedding host (subdomain or custom domain):
  if (resolution.isWeddingHost) {
    // Rule: Admin routes and login are strictly BLOCKED on wedding hosts
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/login")
    ) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Root path rewrite on wedding host: rewrite "/" to "/w/[slug]"
    if (pathname === "/" && resolution.wedding?.slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/w/${resolution.wedding.slug}`;
      const response = NextResponse.rewrite(url);
      response.headers.set("x-wedding-id", resolution.wedding.id);
      response.headers.set("x-wedding-slug", resolution.wedding.slug);
      return response;
    }

    // Pass wedding context in headers
    const response = NextResponse.next();
    if (resolution.wedding) {
      response.headers.set("x-wedding-id", resolution.wedding.id);
      response.headers.set("x-wedding-slug", resolution.wedding.slug);
    }
    return response;
  }

  // Allow public auth endpoints
  if (pathname.startsWith("/api/admin/auth")) {
    return NextResponse.next();
  }

  // Protect /admin and /api/admin
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  // Session check
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, SESSION_OPTIONS);

  if (!session.isLoggedIn) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (robots.txt, images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\..*).*)",
  ],
};
