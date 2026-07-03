import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Application-wide Prisma client.
 *
 * - Prisma 7 requires a driver adapter; `PrismaPg` wraps a node-postgres
 *   pool created from `DATABASE_URL`.
 * - The instance is cached on `globalThis` because Next.js hot reload
 *   re-evaluates modules in development — without the cache, every reload
 *   would leak a connection pool and eventually exhaust Postgres.
 */
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log:
      env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
