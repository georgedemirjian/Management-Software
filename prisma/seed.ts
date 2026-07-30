import "dotenv/config";

import { env } from "@/lib/env";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

import { seedDomain } from "./seed-domain";

/**
 * Seeds the initial LANDLORD account, the organization, and a realistic
 * demo portfolio (LLCs → properties → units → leases → tenants → ledger).
 *
 * Idempotent at the top level: if the organization already exists the
 * domain seed is skipped entirely. Run with `npm run db:seed`; also runs
 * automatically after `prisma migrate reset`.
 */

const ORG_SLUG = "demirjian-properties";
const ORG_NAME = "Demirjian Properties";

async function ensureLandlord() {
  const { SEED_LANDLORD_EMAIL, SEED_LANDLORD_PASSWORD, SEED_LANDLORD_NAME } =
    env;

  if (!SEED_LANDLORD_EMAIL || !SEED_LANDLORD_PASSWORD) {
    console.log(
      "[seed] SEED_LANDLORD_EMAIL / SEED_LANDLORD_PASSWORD are not set — nothing seeded.",
    );
    console.log(
      "[seed] Set them in .env (see .env.example), then rerun: npm run db:seed",
    );
    return null;
  }

  const email = SEED_LANDLORD_EMAIL.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== "LANDLORD") {
      await db.user.update({
        where: { id: existing.id },
        data: { role: "LANDLORD" },
      });
      console.log(`[seed] ${email} promoted to LANDLORD.`);
    } else {
      console.log(`[seed] LANDLORD ${email} already exists.`);
    }
    return existing;
  }

  const { user } = await auth.api.createUser({
    body: {
      email,
      password: SEED_LANDLORD_PASSWORD,
      name: SEED_LANDLORD_NAME ?? "Landlord",
      role: "LANDLORD",
    },
  });

  console.log(`[seed] Created LANDLORD ${user.email} (id: ${user.id}).`);
  return user;
}

async function main() {
  const landlord = await ensureLandlord();
  if (!landlord) return;

  const existingOrg = await db.organization.findUnique({
    where: { slug: ORG_SLUG },
  });
  if (existingOrg) {
    console.log(
      `[seed] Organization "${ORG_SLUG}" already exists — domain seed skipped.`,
    );
    return;
  }

  const org = await db.organization.create({
    data: {
      id: crypto.randomUUID(),
      name: ORG_NAME,
      slug: ORG_SLUG,
      createdAt: new Date(),
    },
  });
  await db.member.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: org.id,
      userId: landlord.id,
      role: "owner",
      createdAt: new Date(),
    },
  });
  console.log(
    `[seed] Created organization "${ORG_NAME}" (owner: ${landlord.email}).`,
  );

  await seedDomain({ organizationId: org.id, landlordId: landlord.id });

  const [
    llcs,
    properties,
    units,
    tenants,
    leases,
    charges,
    payments,
    allocations,
    documents,
  ] = await Promise.all([
    db.llc.count(),
    db.property.count(),
    db.unit.count(),
    db.tenant.count(),
    db.lease.count(),
    db.charge.count(),
    db.payment.count(),
    db.paymentAllocation.count(),
    db.document.count(),
  ]);

  console.log("[seed] Done:");
  console.table({
    llcs,
    properties,
    units,
    tenants,
    leases,
    charges,
    payments,
    allocations,
    documents,
  });
}

main()
  .catch((error: unknown) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
