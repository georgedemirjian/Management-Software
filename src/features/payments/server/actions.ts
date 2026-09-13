"use server";

import { revalidatePath } from "next/cache";

import { createChargeSchema } from "@/features/payments/validation/charge";
import { createPaymentSchema } from "@/features/payments/validation/payment";
import {
  allocatePayment,
  reversePaymentAllocations,
} from "@/features/payments/server/settlement";
import { ActionError, runOrgAction, type ActionResult } from "@/server/action";
import { db } from "@/server/db";
import type { ChargeStatus } from "@/generated/prisma/enums";

const TERMINAL_CHARGE_STATUSES: ChargeStatus[] = ["VOIDED", "WAIVED"];

async function assertLeaseInOrg(organizationId: string, leaseId: string) {
  const lease = await db.lease.findFirst({
    where: { id: leaseId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!lease) throw new ActionError("That lease could not be found.");
}

/** Add a charge (money owed) to a lease. */
export async function createCharge(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(createChargeSchema, input, async ({ data, ctx }) => {
    await assertLeaseInOrg(ctx.organizationId, data.leaseId);
    const charge = await db.charge.create({
      data: {
        organizationId: ctx.organizationId,
        createdById: ctx.user.id,
        leaseId: data.leaseId,
        type: data.type,
        amountCents: data.amountCents,
        description: data.description ?? null,
        dueDate: new Date(data.dueDate),
        periodStart: data.periodStart ? new Date(data.periodStart) : null,
        periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
      },
      select: { id: true },
    });
    revalidatePath(`/dashboard/leases/${data.leaseId}`);
    revalidatePath("/dashboard/payments");
    return { id: charge.id };
  });
}

/**
 * Record a received payment and (optionally) allocate it across open
 * charges, updating each charge's status — all in one transaction.
 */
export async function recordPayment(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(createPaymentSchema, input, async ({ data, ctx }) => {
    const org = ctx.organizationId;
    await assertLeaseInOrg(org, data.leaseId);

    if (data.tenantId) {
      const tenant = await db.tenant.findFirst({
        where: { id: data.tenantId, organizationId: org, deletedAt: null },
        select: { id: true },
      });
      if (!tenant) throw new ActionError("That tenant could not be found.");
    }

    const allocations = data.allocations ?? [];

    // Validate every allocation target: same lease + org, still open, and the
    // requested amount does not exceed the charge's remaining balance.
    if (allocations.length > 0) {
      const chargeIds = allocations.map((a) => a.chargeId);
      const charges = await db.charge.findMany({
        where: {
          id: { in: chargeIds },
          leaseId: data.leaseId,
          organizationId: org,
          status: { notIn: TERMINAL_CHARGE_STATUSES },
        },
        select: {
          id: true,
          amountCents: true,
          allocations: { select: { amountCents: true } },
        },
      });
      const byId = new Map(charges.map((c) => [c.id, c]));
      for (const alloc of allocations) {
        const charge = byId.get(alloc.chargeId);
        if (!charge) {
          throw new ActionError("A selected charge is not open on this lease.");
        }
        const already = charge.allocations.reduce(
          (a, x) => a + x.amountCents,
          0,
        );
        if (alloc.amountCents > charge.amountCents - already) {
          throw new ActionError(
            "An allocation exceeds the charge's remaining balance.",
          );
        }
      }
    }

    const paymentId = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organizationId: org,
          createdById: ctx.user.id,
          leaseId: data.leaseId,
          tenantId: data.tenantId ?? null,
          method: data.method,
          status: "COMPLETED",
          amountCents: data.amountCents,
          receivedAt: data.receivedAt,
          reference: data.reference ?? null,
          memo: data.memo ?? null,
        },
        select: { id: true },
      });

      await allocatePayment(tx, {
        organizationId: org,
        paymentId: payment.id,
        allocations,
      });

      return payment.id;
    });

    revalidatePath(`/dashboard/leases/${data.leaseId}`);
    revalidatePath("/dashboard/payments");
    return { id: paymentId };
  });
}

async function loadChargeForStatusChange(
  organizationId: string,
  chargeId: string,
) {
  const charge = await db.charge.findFirst({
    where: { id: chargeId, organizationId },
    select: {
      id: true,
      leaseId: true,
      status: true,
      allocations: { select: { id: true } },
    },
  });
  if (!charge) throw new ActionError("That charge could not be found.");
  return charge;
}

/** Forgive an unpaid charge (kept for history). */
export async function waiveCharge(
  chargeId: string,
): Promise<ActionResult<null>> {
  return runOrgAction(createChargeSchema.partial(), {}, async ({ ctx }) => {
    const charge = await loadChargeForStatusChange(
      ctx.organizationId,
      chargeId,
    );
    if (charge.allocations.length > 0) {
      throw new ActionError(
        "This charge has payments applied and cannot be waived.",
      );
    }
    if (charge.status !== "PENDING") {
      throw new ActionError("Only pending charges can be waived.");
    }
    await db.charge.update({
      where: { id: chargeId },
      data: { status: "WAIVED" },
    });
    revalidatePath(`/dashboard/leases/${charge.leaseId}`);
    return null;
  });
}

/** Mark a charge entered in error as void (kept for history). */
export async function voidCharge(
  chargeId: string,
): Promise<ActionResult<null>> {
  return runOrgAction(createChargeSchema.partial(), {}, async ({ ctx }) => {
    const charge = await loadChargeForStatusChange(
      ctx.organizationId,
      chargeId,
    );
    if (charge.allocations.length > 0) {
      throw new ActionError(
        "This charge has payments applied and cannot be voided.",
      );
    }
    if (charge.status !== "PENDING") {
      throw new ActionError("Only pending charges can be voided.");
    }
    await db.charge.update({
      where: { id: chargeId },
      data: { status: "VOIDED" },
    });
    revalidatePath(`/dashboard/leases/${charge.leaseId}`);
    return null;
  });
}

/**
 * Void a completed payment (e.g. a bounced check). The payment ROW is kept
 * (status VOIDED, audit trail preserved), its allocations are reversed, and
 * the affected charges are recomputed back toward open — all atomically.
 */
export async function voidPayment(
  paymentId: string,
): Promise<ActionResult<null>> {
  return runOrgAction(createPaymentSchema.partial(), {}, async ({ ctx }) => {
    const payment = await db.payment.findFirst({
      where: { id: paymentId, organizationId: ctx.organizationId },
      select: { id: true, leaseId: true, status: true },
    });
    if (!payment) throw new ActionError("That payment could not be found.");
    if (payment.status !== "COMPLETED") {
      throw new ActionError("Only completed payments can be voided.");
    }

    await db.$transaction(async (tx) => {
      await reversePaymentAllocations(tx, paymentId);
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: "VOIDED" },
      });
    });

    revalidatePath(`/dashboard/leases/${payment.leaseId}`);
    revalidatePath("/dashboard/payments");
    return null;
  });
}
