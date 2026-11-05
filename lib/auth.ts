import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  globalRole: "OWNER" | "MANAGER" | "USER";
  activeWeddingId?: string;
  isLoggedIn: boolean;
}

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET ?? "fallback-dev-secret-change-in-prod-at-least-32-chars",
  cookieName: "wedding_admin_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

/**
 * Returns the current authenticated session or throws 401 UNAUTHORIZED.
 */
export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    throw new Error("UNAUTHORIZED");
  }

  // Also verify user is still active in database
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isActive: true, globalRole: true },
  });

  if (!user || !user.isActive) {
    session.destroy();
    throw new Error("UNAUTHORIZED");
  }

  return session;
}

/**
 * Requires OWNER role or throws 403 FORBIDDEN.
 */
export async function requireOwner(): Promise<SessionData> {
  const session = await requireAuth();
  if (session.globalRole !== "OWNER") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

/**
 * Verifies that the current user has access to the specified wedding.
 * - OWNER has full access to all weddings.
 * - Global MANAGER has manager access to all weddings.
 * - Otherwise checks WeddingAccess table for specific assignment.
 * Throws 403 FORBIDDEN or 404 NOT_FOUND.
 */
export async function requireWeddingAccess(
  weddingId: string,
  minRole: "VIEWER" | "MANAGER" = "VIEWER"
): Promise<{ session: SessionData; role: "OWNER" | "MANAGER" | "VIEWER" }> {
  const session = await requireAuth();

  // OWNER has universal access
  if (session.globalRole === "OWNER") {
    return { session, role: "OWNER" };
  }

  // Global MANAGER has manager access across all weddings
  if (session.globalRole === "MANAGER") {
    return { session, role: "MANAGER" };
  }

  // Specific per-wedding access check
  const access = await prisma.weddingAccess.findUnique({
    where: {
      userId_weddingId: {
        userId: session.userId,
        weddingId,
      },
    },
  });

  if (!access) {
    throw new Error("FORBIDDEN");
  }

  if (minRole === "MANAGER" && access.role !== "MANAGER") {
    throw new Error("FORBIDDEN");
  }

  return { session, role: access.role };
}
