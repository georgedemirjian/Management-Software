import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";

import { env } from "@/lib/env";
import { ac, rolePermissions } from "@/lib/permissions";
import { db } from "@/server/db";

/**
 * Better Auth server instance.
 *
 * Account model: there is NO public registration (`disableSignUp`). Accounts
 * are provisioned server-side — the initial LANDLORD via `npm run db:seed`,
 * tenant accounts later via the admin plugin's `auth.api.createUser`.
 *
 * Email verification and password reset are deliberately absent until an
 * email provider lands in src/services: with self-registration disabled
 * there is no unverified-signup threat, and both flows are useless without
 * outbound email. Revisit when tenant invitations are built.
 *
 * Tenancy model (Phase 3): a Better Auth organization is the MANAGEMENT
 * BUSINESS (the SaaS isolation boundary) — NOT an LLC. LLCs are plain domain
 * rows under the organization (see prisma/schema.prisma). Organization
 * members are staff only (landlord, future property managers); tenant users
 * are never members — they reach their own data through Tenant.userId.
 */
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
  },
  session: {
    // Signed cookie snapshot of the session: most requests skip the DB
    // round-trip. Trade-off: bans/revocations can take up to `maxAge`
    // (5 min) to propagate to already-issued cookies.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  rateLimit: {
    // Default in-memory storage does not survive restarts and is not shared
    // between serverless instances; the database store is.
    storage: "database",
  },
  databaseHooks: {
    session: {
      create: {
        // Staff sessions start with their organization active; tenant users
        // have no membership, so theirs stays null.
        before: async (session) => {
          const membership = await db.member.findFirst({
            where: { userId: session.userId },
            select: { organizationId: true },
          });
          return {
            data: {
              ...session,
              activeOrganizationId: membership?.organizationId ?? null,
            },
          };
        },
      },
    },
  },
  plugins: [
    admin({
      ac,
      roles: rolePermissions,
      defaultRole: "TENANT",
      adminRoles: ["LANDLORD"],
    }),
    organization({
      // Organizations are provisioned (seed today, SaaS onboarding later),
      // never self-created from the app.
      allowUserToCreateOrganization: false,
    }),
    // Applies Set-Cookie headers inside Next.js Server Actions. Keep last.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
