import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isLoggedIn: boolean;
}

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET ?? "fallback-dev-secret-change-in-prod",
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

export async function requireAuth(): Promise<void> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    // This will be caught by middleware or route handlers
    throw new Error("UNAUTHORIZED");
  }
}

