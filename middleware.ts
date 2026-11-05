import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/auth";

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET ?? "fallback-dev-secret-change-in-prod",
  cookieName: "wedding_admin_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  },
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public auth endpoints (/api/admin/auth/login, etc.)
  if (pathname.startsWith("/api/admin/auth")) {
    return NextResponse.next();
  }

  // Protect /admin pages and /api/admin routes
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  // Auth check: read session from cookie
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    SESSION_OPTIONS
  );

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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

