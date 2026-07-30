import type { Charge, Lease, Tenant } from "@/generated/prisma/client";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

/**
 * Builds the demo portfolio. Everything is org-scoped, financially
 * consistent (Charge.status always matches its allocation sums), and
 * exercises every relationship: LLCs, multi-unit properties, co-tenants,
 * renewal chains, terminated/pending/draft leases, partial payments, one
 * payment settling multiple charges, waived/voided rows, and documents at
 * every attachment level.
 */

type Ctx = { organizationId: string; landlordId: string };

/** Civil date in UTC — matches Prisma @db.Date columns without TZ drift. */
const day = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0));

const DEMO_TENANT_PASSWORD = "tenant-dev-password-123";

export async function seedDomain(ctx: Ctx): Promise<void> {
  const { organizationId, landlordId } = ctx;
  const audit = { organizationId, createdById: landlordId };

  // ── LLCs ────────────────────────────────────────────────────────────────
  const maple = await db.llc.create({
    data: {
      ...audit,
      name: "Maple Street Holdings",
      legalName: "Maple Street Holdings LLC",
      ein: "82-1111111",
    },
  });
  const realty = await db.llc.create({
    data: {
      ...audit,
      name: "Demirjian Realty",
      legalName: "Demirjian Realty LLC",
      ein: "83-2222222",
    },
  });

  // ── Properties + units ──────────────────────────────────────────────────
  const fourplex = await db.property.create({
    data: {
      ...audit,
      llcId: maple.id,
      name: "Maple Fourplex",
      addressLine1: "412 Maple St",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      units: {
        create: [1, 2, 3, 4].map((n) => ({
          ...audit,
          label: `Unit ${n}`,
          bedrooms: n <= 2 ? 2 : 1,
          bathrooms: 1,
          sqft: n <= 2 ? 850 : 640,
        })),
      },
    },
    include: { units: true },
  });
  const duplex = await db.property.create({
    data: {
      ...audit,
      llcId: maple.id,
      name: "Oak Duplex",
      addressLine1: "88 Oak Ave",
      city: "Springfield",
      state: "IL",
      postalCode: "62702",
      units: {
        create: ["A", "B"].map((label) => ({
          ...audit,
          label,
          bedrooms: 2,
          bathrooms: 1.5,
          sqft: 980,
        })),
      },
    },
    include: { units: true },
  });
  const birch = await db.property.create({
    data: {
      ...audit,
      llcId: maple.id,
      name: "Birch House",
      addressLine1: "17 Birch Ln",
      city: "Chatham",
      state: "IL",
      postalCode: "62629",
      units: {
        create: [
          { ...audit, label: "Main", bedrooms: 3, bathrooms: 2, sqft: 1650 },
        ],
      },
    },
    include: { units: true },
  });
  const cedar = await db.property.create({
    data: {
      ...audit,
      llcId: realty.id,
      name: "Cedar Triplex",
      addressLine1: "230 Cedar Rd",
      city: "Springfield",
      state: "IL",
      postalCode: "62703",
      units: {
        create: [1, 2, 3].map((n) => ({
          ...audit,
          label: `Unit ${n}`,
          bedrooms: 2,
          bathrooms: 1,
          sqft: 900,
        })),
      },
    },
    include: { units: true },
  });
  const willow = await db.property.create({
    data: {
      ...audit,
      llcId: realty.id,
      name: "Willow Cottage",
      addressLine1: "5 Willow Ct",
      city: "Rochester",
      state: "IL",
      postalCode: "62563",
      units: {
        create: [
          { ...audit, label: "Main", bedrooms: 2, bathrooms: 1, sqft: 1100 },
        ],
      },
    },
    include: { units: true },
  });

  const unit = (
    p: { units: { id: string; label: string }[] },
    label: string,
  ) => {
    const u = p.units.find((x) => x.label === label);
    if (!u) throw new Error(`seed: unit ${label} missing`);
    return u;
  };

  // ── Tenants (two with portal accounts) ──────────────────────────────────
  const tenantUser = async (name: string, email: string) => {
    const { user } = await auth.api.createUser({
      body: { email, password: DEMO_TENANT_PASSWORD, name, role: "TENANT" },
    });
    return user.id;
  };

  const person = (
    firstName: string,
    lastName: string,
    extra: Partial<{ email: string; phone: string; userId: string }> = {},
  ) => db.tenant.create({ data: { ...audit, firstName, lastName, ...extra } });

  const alice = await person("Alice", "Nguyen", {
    email: "alice.tenant@example.com",
    phone: "+1 217 555 0101",
    userId: await tenantUser("Alice Nguyen", "alice.tenant@example.com"),
  });
  const marcus = await person("Marcus", "Webb", {
    email: "marcus.tenant@example.com",
    phone: "+1 217 555 0102",
    userId: await tenantUser("Marcus Webb", "marcus.tenant@example.com"),
  });
  const sofia = await person("Sofia", "Ramos", { email: "sofia@example.com" });
  const james = await person("James", "Okafor", { phone: "+1 217 555 0104" });
  const priya = await person("Priya", "Patel", { email: "priya@example.com" });
  const daniel = await person("Daniel", "Kim", { email: "daniel@example.com" });
  const emily = await person("Emily", "Carter", {});
  const robert = await person("Robert", "Hale", { phone: "+1 217 555 0108" });
  const nina = await person("Nina", "Alvarez", { email: "nina@example.com" });
  const tom = await person("Tom", "Brooks", {});

  // ── Leases ──────────────────────────────────────────────────────────────
  type LeaseSpec = {
    unitId: string;
    tenants: { tenant: Tenant; primary?: boolean }[];
    status: "DRAFT" | "PENDING" | "ACTIVE" | "ENDED" | "TERMINATED";
    start: Date;
    end?: Date;
    moveOut?: Date;
    rentCents: number;
    depositCents?: number;
    lateFeeCents?: number;
    graceDays?: number;
    renewedFromId?: string;
    notes?: string;
  };

  const createLease = (s: LeaseSpec) =>
    db.lease.create({
      data: {
        ...audit,
        unitId: s.unitId,
        status: s.status,
        startDate: s.start,
        endDate: s.end ?? null,
        moveOutDate: s.moveOut ?? null,
        rentCents: s.rentCents,
        depositCents: s.depositCents ?? 0,
        dueDay: 1,
        graceDays: s.graceDays ?? 3,
        lateFeeCents: s.lateFeeCents ?? 7500,
        renewedFromId: s.renewedFromId ?? null,
        notes: s.notes ?? null,
        tenants: {
          create: s.tenants.map((t, i) => ({
            organizationId,
            tenantId: t.tenant.id,
            isPrimary: t.primary ?? i === 0,
          })),
        },
      },
    });

  // Alice: ended 2024–25 lease renewed into the current active one.
  const alicePrior = await createLease({
    unitId: unit(fourplex, "Unit 1").id,
    tenants: [{ tenant: alice }],
    status: "ENDED",
    start: day(2024, 8, 1),
    end: day(2025, 7, 31),
    rentCents: 139500,
    depositCents: 139500,
  });
  const aliceLease = await createLease({
    unitId: unit(fourplex, "Unit 1").id,
    tenants: [{ tenant: alice }],
    status: "ACTIVE",
    start: day(2025, 8, 1),
    end: day(2026, 7, 31),
    rentCents: 145000,
    depositCents: 139500,
    renewedFromId: alicePrior.id,
    notes: "Renewal; rent +$55.",
  });

  const marcusLease = await createLease({
    unitId: unit(fourplex, "Unit 2").id,
    tenants: [{ tenant: marcus }],
    status: "ACTIVE",
    start: day(2025, 3, 1), // month-to-month: no end date
    rentCents: 139500,
    depositCents: 139500,
  });

  const sofiaLease = await createLease({
    unitId: unit(duplex, "A").id,
    tenants: [{ tenant: sofia }],
    status: "ACTIVE",
    start: day(2026, 1, 1),
    end: day(2026, 12, 31),
    rentCents: 165000,
    depositCents: 165000,
  });

  const ninaTomLease = await createLease({
    unitId: unit(birch, "Main").id,
    tenants: [{ tenant: nina, primary: true }, { tenant: tom }],
    status: "ACTIVE",
    start: day(2025, 11, 1),
    end: day(2026, 10, 31),
    rentCents: 210000,
    depositCents: 210000,
    notes: "Co-tenants; Nina is primary contact.",
  });

  const jamesLease = await createLease({
    unitId: unit(cedar, "Unit 1").id,
    tenants: [{ tenant: james }],
    status: "ACTIVE",
    start: day(2026, 2, 1),
    end: day(2027, 1, 31),
    rentCents: 125000,
    depositCents: 125000,
  });

  const priyaLease = await createLease({
    unitId: unit(cedar, "Unit 2").id,
    tenants: [{ tenant: priya }],
    status: "ACTIVE",
    start: day(2024, 6, 1), // long-running month-to-month
    rentCents: 118000,
    depositCents: 118000,
  });

  const robertLease = await createLease({
    unitId: unit(duplex, "B").id,
    tenants: [{ tenant: robert }],
    status: "TERMINATED",
    start: day(2025, 5, 1),
    end: day(2026, 4, 30),
    moveOut: day(2026, 2, 15),
    rentCents: 162500,
    depositCents: 162500,
    notes: "Early termination by mutual agreement; moved out 2026-02-15.",
  });

  await createLease({
    unitId: unit(willow, "Main").id,
    tenants: [{ tenant: daniel }],
    status: "PENDING",
    start: day(2026, 8, 1),
    end: day(2027, 7, 31),
    rentCents: 175000,
    depositCents: 175000,
    notes: "Signed; move-in scheduled for August 1.",
  });

  await createLease({
    unitId: unit(cedar, "Unit 3").id,
    tenants: [{ tenant: emily }],
    status: "DRAFT",
    start: day(2026, 8, 15),
    rentCents: 121000,
    notes: "Terms under negotiation.",
  });
  // Fourplex units 3 & 4 stay vacant on purpose.

  // ── Ledger helpers (keep Charge.status consistent with allocations) ─────
  const rentCharge = (lease: Lease, y: number, m: number) =>
    db.charge.create({
      data: {
        ...audit,
        leaseId: lease.id,
        type: "RENT",
        amountCents: lease.rentCents,
        description: `Rent ${y}-${String(m).padStart(2, "0")}`,
        dueDate: day(y, m, lease.dueDay),
        periodStart: day(y, m, 1),
        periodEnd: lastDayOfMonth(y, m),
      },
    });

  const pay = async (
    charges: Charge[],
    opts: {
      method: "ACH" | "CARD" | "CASH" | "CHECK" | "MONEY_ORDER" | "OTHER";
      tenantId: string;
      receivedAt: Date;
      amountCents?: number; // defaults to sum of charges (full settlement)
      reference?: string;
    },
  ) => {
    const total = charges.reduce((s, c) => s + c.amountCents, 0);
    const amount = opts.amountCents ?? total;
    const first = charges[0];
    if (!first) throw new Error("seed: pay() needs at least one charge");

    const payment = await db.payment.create({
      data: {
        ...audit,
        leaseId: first.leaseId,
        tenantId: opts.tenantId,
        method: opts.method,
        status: "COMPLETED",
        amountCents: amount,
        receivedAt: opts.receivedAt,
        reference: opts.reference ?? null,
      },
    });

    // Allocate in order until the payment is exhausted.
    let remaining = amount;
    for (const charge of charges) {
      const slice = Math.min(remaining, charge.amountCents);
      if (slice <= 0) break;
      await db.paymentAllocation.create({
        data: {
          organizationId,
          paymentId: payment.id,
          chargeId: charge.id,
          amountCents: slice,
        },
      });
      await db.charge.update({
        where: { id: charge.id },
        data: {
          status: slice === charge.amountCents ? "PAID" : "PARTIALLY_PAID",
        },
      });
      remaining -= slice;
    }
    return payment;
  };

  const depositCharge = async (
    lease: Lease,
    dueOn: Date,
    settle?: { tenantId: string; method: "CHECK" | "ACH" | "CASH"; on: Date },
  ) => {
    const charge = await db.charge.create({
      data: {
        ...audit,
        leaseId: lease.id,
        type: "DEPOSIT",
        amountCents: lease.depositCents,
        description: "Security deposit",
        dueDate: dueOn,
      },
    });
    if (settle) {
      await pay([charge], {
        method: settle.method,
        tenantId: settle.tenantId,
        receivedAt: settle.on,
        reference:
          settle.method === "CHECK" ? `chk-${lease.id.slice(-4)}` : undefined,
      });
    }
    return charge;
  };

  // ── Fill the ledgers ────────────────────────────────────────────────────
  // Deposits for the active leases (all settled), pending lease unsettled.
  await depositCharge(aliceLease, day(2025, 8, 1), {
    tenantId: alice.id,
    method: "CHECK",
    on: day(2025, 7, 28),
  });
  await depositCharge(marcusLease, day(2025, 3, 1), {
    tenantId: marcus.id,
    method: "ACH",
    on: day(2025, 3, 1),
  });
  await depositCharge(sofiaLease, day(2026, 1, 1), {
    tenantId: sofia.id,
    method: "CHECK",
    on: day(2025, 12, 27),
  });
  await depositCharge(ninaTomLease, day(2025, 11, 1), {
    tenantId: nina.id,
    method: "ACH",
    on: day(2025, 10, 30),
  });
  await depositCharge(jamesLease, day(2026, 2, 1), {
    tenantId: james.id,
    method: "CHECK",
    on: day(2026, 1, 29),
  });
  const pendingLease = await db.lease.findFirstOrThrow({
    where: { status: "PENDING" },
  });
  await depositCharge(pendingLease, day(2026, 7, 25)); // due soon, unpaid

  // 2026 rent history, January → July (current month), per active lease.
  const activeRosters: {
    lease: Lease;
    payer: Tenant;
    method: "ACH" | "CHECK" | "CASH" | "CARD";
    from: number; // first 2026 month the lease is active
  }[] = [
    { lease: aliceLease, payer: alice, method: "ACH", from: 1 },
    { lease: marcusLease, payer: marcus, method: "CARD", from: 1 },
    { lease: sofiaLease, payer: sofia, method: "CHECK", from: 1 },
    { lease: ninaTomLease, payer: nina, method: "ACH", from: 1 },
    { lease: jamesLease, payer: james, method: "ACH", from: 2 },
    { lease: priyaLease, payer: priya, method: "CASH", from: 1 },
  ];

  for (const { lease, payer, method, from } of activeRosters) {
    for (let m = from; m <= 7; m++) {
      const charge = await rentCharge(lease, 2026, m);
      const isCurrentMonth = m === 7;
      // Marcus's June stays open here — settled below by one combined
      // payment together with his late fee.
      const isMarcusLateJune = lease.id === marcusLease.id && m === 6;
      if (!isCurrentMonth && !isMarcusLateJune) {
        await pay([charge], {
          method,
          tenantId: payer.id,
          receivedAt: day(2026, m, 1 + (m % 3)), // on time-ish
        });
      } else if (isCurrentMonth && lease.id === aliceLease.id) {
        // July: Alice paid part of the rent so far.
        await pay([charge], {
          method: "ACH",
          tenantId: alice.id,
          receivedAt: day(2026, 7, 2),
          amountCents: 100000,
        });
      }
      // Everyone else's July charge stays PENDING.
    }
  }

  // Marcus was late in June: late fee + one payment covering rent AND fee.
  const marcusJuneRent = await db.charge.findFirstOrThrow({
    where: { leaseId: marcusLease.id, description: "Rent 2026-06" },
  });
  const marcusLateFee = await db.charge.create({
    data: {
      ...audit,
      leaseId: marcusLease.id,
      type: "LATE_FEE",
      amountCents: 7500,
      description: "Late fee — June rent",
      dueDate: day(2026, 6, 8),
    },
  });
  await pay([marcusJuneRent, marcusLateFee], {
    method: "CARD",
    tenantId: marcus.id,
    receivedAt: day(2026, 6, 12),
    reference: "combined june + fee",
  });

  // Priya's May late fee was waived.
  await db.charge.create({
    data: {
      ...audit,
      leaseId: priyaLease.id,
      type: "LATE_FEE",
      amountCents: 7500,
      status: "WAIVED",
      description: "Late fee — May rent (waived, long-term tenant)",
      dueDate: day(2026, 5, 8),
    },
  });

  // Sofia: a failed card attempt for July (no allocations).
  await db.payment.create({
    data: {
      ...audit,
      leaseId: sofiaLease.id,
      tenantId: sofia.id,
      method: "CARD",
      status: "FAILED",
      amountCents: 165000,
      receivedAt: day(2026, 7, 1),
      memo: "Card declined",
    },
  });

  // Robert (terminated): Dec–Feb history, plus a data-entry error kept as VOIDED.
  for (const m of [12] as const) {
    const c = await rentCharge(robertLease, 2025, m);
    await pay([c], {
      method: "CHECK",
      tenantId: robert.id,
      receivedAt: day(2025, m, 3),
    });
  }
  for (const m of [1, 2] as const) {
    const c = await rentCharge(robertLease, 2026, m);
    await pay([c], {
      method: "CHECK",
      tenantId: robert.id,
      receivedAt: day(2026, m, 3),
    });
  }
  await db.payment.create({
    data: {
      ...audit,
      leaseId: robertLease.id,
      tenantId: robert.id,
      method: "CHECK",
      status: "VOIDED",
      amountCents: 162500,
      receivedAt: day(2026, 1, 3),
      memo: "Duplicate entry — voided",
    },
  });

  // Alice's prior (ENDED) lease: sample history from mid-2025.
  for (const m of [5, 6, 7] as const) {
    const c = await rentCharge(alicePrior, 2025, m);
    await pay([c], {
      method: "ACH",
      tenantId: alice.id,
      receivedAt: day(2025, m, 2),
    });
  }

  // ── Documents at every attachment level ─────────────────────────────────
  const doc = (
    name: string,
    storageKey: string,
    parent: Partial<{
      propertyId: string;
      unitId: string;
      leaseId: string;
      tenantId: string;
    }> = {},
  ) =>
    db.document.create({
      data: {
        organizationId,
        name,
        storageKey,
        mimeType: "application/pdf",
        sizeBytes: 120_000 + name.length * 1000,
        uploadedById: landlordId,
        ...parent,
      },
    });

  await doc(
    "2026 Umbrella Insurance Policy.pdf",
    "seed/org/insurance-2026.pdf",
  );
  await doc("Maple Fourplex — Deed.pdf", "seed/properties/maple-deed.pdf", {
    propertyId: fourplex.id,
  });
  await doc(
    "Unit 3 Inspection Report.pdf",
    "seed/units/fourplex-3-inspection.pdf",
    {
      unitId: unit(fourplex, "Unit 3").id,
    },
  );
  await doc(
    "Alice Nguyen — Lease 2025-2026.pdf",
    "seed/leases/alice-2025.pdf",
    {
      leaseId: aliceLease.id,
    },
  );
  await doc("Marcus Webb — ID.pdf", "seed/tenants/marcus-id.pdf", {
    tenantId: marcus.id,
  });

  console.log("[seed] Domain portfolio created.");
}
