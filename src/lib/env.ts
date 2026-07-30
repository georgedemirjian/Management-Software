import { z } from "zod";

/**
 * Environment variable validation — the single source of truth for every
 * value this app reads from `process.env`.
 *
 * Import `env` instead of touching `process.env` directly: a missing or
 * malformed variable fails loudly at boot instead of surfacing as a runtime
 * bug deep inside a request.
 *
 * Adding a variable:
 *   1. Add it to the schema below.
 *   2. Document it in `.env.example`.
 */

// Server-only guard: secrets must never be bundled into client code. This is
// a runtime check (instead of the `server-only` package) so that non-Next
// tooling — the Better Auth CLI, Prisma scripts — can still import this file.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/env.ts is server-only and must not be imported from Client Components.",
  );
}

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** PostgreSQL connection string used by Prisma. */
  DATABASE_URL: z.url(),

  /** CLI-only: shadow DB for `prisma migrate dev` when the DB user cannot
   *  CREATE DATABASE. Read by prisma.config.ts, never by the app. */
  SHADOW_DATABASE_URL: z.url().optional(),

  /** Session/token signing secret for Better Auth: `openssl rand -hex 32`. */
  BETTER_AUTH_SECRET: z.string().min(32),

  /** Canonical base URL the app is served from, without a trailing slash. */
  BETTER_AUTH_URL: z.url(),

  /**
   * Seed-only (`npm run db:seed`): credentials for the initial LANDLORD
   * account. Never read by the running app. Password length must satisfy
   * `minPasswordLength` in src/server/auth.ts.
   */
  SEED_LANDLORD_EMAIL: z.email().optional(),
  SEED_LANDLORD_PASSWORD: z.string().min(12).optional(),
  SEED_LANDLORD_NAME: z.string().min(1).optional(),
});

// Treat empty strings as unset — `KEY=""` in a .env file is almost always a
// mistake and should fail validation the same way a missing key does.
const raw = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== ""),
);

function loadEnv(): z.infer<typeof schema> {
  // Escape hatch for builds where runtime secrets are injected later
  // (CI pipelines, Docker image builds). Never set this when serving traffic.
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return raw as z.infer<typeof schema>;
  }

  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:",
      z.treeifyError(parsed.error).properties,
    );
    throw new Error(
      "Invalid environment variables — see output above and .env.example.",
    );
  }

  return parsed.data;
}

export const env = loadEnv();
