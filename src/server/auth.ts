import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { env } from "@/lib/env";
import { db } from "@/server/db";

/**
 * Better Auth server instance — placeholder wiring only for now.
 *
 * The HTTP handler is mounted at /api/auth/[...all]; there is no sign-in UI
 * yet. When auth becomes a real feature, add pages that call `authClient`
 * (src/lib/auth-client.ts) and protect server code by reading
 * `auth.api.getSession({ headers })`.
 *
 * Multi-LLC note: when organizations become a feature, add the
 * `organization` plugin from "better-auth/plugins/organization" and model
 * each LLC as an organization — that is the seam this app will use for
 * multi-tenancy.
 */
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    // Applies Set-Cookie headers inside Next.js Server Actions. Keep last.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
