import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth, type Session } from "@/server/auth";
import { isUserRole, type UserRole } from "@/types/auth";

/**
 * Request-scoped authentication & authorization helpers — the single place
 * authorization decisions are made. Route files must use these instead of
 * calling `auth.api` or comparing roles themselves.
 *
 * Two flavors exist on purpose:
 *  - `require*` here REDIRECTS — for pages, layouts, and Server Actions.
 *  - `requireApi*` in src/server/api.ts throws typed 401/403 errors — for
 *    route handlers that must answer JSON.
 *
 * Defense in depth: src/proxy.ts only does optimistic cookie redirects.
 * Every protected page/layout/action/handler must call one of these — a
 * layout check alone does not protect sibling pages on client navigation.
 */

/** Better Auth user with `role` narrowed from `string` to our enum. */
export type SessionUser = Omit<Session["user"], "role"> & { role: UserRole };

export type AuthContext = {
  /** The session record (token metadata, expiry, IP, …). */
  session: Session["session"];
  user: SessionUser;
};

export function toSessionUser(user: Session["user"]): SessionUser {
  const { role } = user;
  if (!isUserRole(role)) {
    // Unreachable while the DB column is the UserRole enum; fail loudly if
    // config and schema ever drift.
    throw new Error(`Unknown user role: ${String(role)}`);
  }
  return { ...user, role };
}

/**
 * The raw Better Auth session payload, or null. Cached per request render
 * pass, so calling it from layout + page costs one lookup (usually served
 * from the session cookie cache without touching Postgres).
 */
export const getCurrentSession = cache(async (): Promise<Session | null> => {
  return auth.api.getSession({ headers: await headers() });
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getCurrentSession();
  return session ? toSessionUser(session.user) : null;
}

/** Session or redirect to /login. For pages, layouts, and Server Actions. */
export async function requireAuth(): Promise<AuthContext> {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  return { session: session.session, user: toSessionUser(session.user) };
}

/**
 * Session with the given role, or redirect: unauthenticated → /login,
 * wrong role → /dashboard (neutral landing, no information leak).
 */
export async function requireRole(role: UserRole): Promise<AuthContext> {
  const context = await requireAuth();
  if (context.user.role !== role) {
    redirect("/dashboard");
  }
  return context;
}

export type OrgContext = AuthContext & { organizationId: string };

/**
 * Session plus the active organization id — the scoping key every domain
 * query must filter by. Staff sessions get it set at sign-in (session
 * databaseHook in src/server/auth.ts); tenant users have no membership and
 * are bounced to the dashboard.
 */
export async function requireOrg(): Promise<OrgContext> {
  const context = await requireAuth();
  const organizationId = context.session.activeOrganizationId ?? null;
  if (!organizationId) {
    redirect("/dashboard");
  }
  return { ...context, organizationId };
}

export function requireLandlord(): Promise<AuthContext> {
  return requireRole("LANDLORD");
}

export function requireTenant(): Promise<AuthContext> {
  return requireRole("TENANT");
}
