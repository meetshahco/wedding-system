import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/auth";
import { resolveHost, getPrimaryDomainRedirect } from "@/lib/domains/domain-resolver";

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET ?? "fallback-dev-secret-change-in-prod-at-least-32-chars",
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

  // 3. Platform Host behavior:
  // Rule: Redirect from /i/[token] on the platform host to the wedding's primary domain
  if (resolution.type === "platform" && pathname.startsWith("/i/")) {
    const token = pathname.replace(/^\/i\//, "").split("/")[0];
    if (token) {
      const redirectUrl = await getPrimaryDomainRedirect(host, token);
      if (redirectUrl) {
        return NextResponse.redirect(new URL(redirectUrl));
      }
    }
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
