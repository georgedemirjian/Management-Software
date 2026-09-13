import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * The settlement primitive: the transactional rules that keep `Charge.status`
 * consistent with allocation sums. Shared by the manual payment actions
 * (`recordPayment`/`voidPayment`) and the Stripe webhook so both paths behave
 * identically. Every function takes a transaction client and MUST be called
 * inside `db.$transaction`.
 */

export type AllocationInput = { chargeId: string; amountCents: number };

/**
 * Recompute one charge's status from the sum of its remaining allocations.
 * WAIVED/VOIDED charges are terminal and left untouched.
 */
export async function recomputeChargeStatus(
  tx: Prisma.TransactionClient,
  chargeId: string,
): Promise<void> {
  const charge = await tx.charge.findUnique({
    where: { id: chargeId },
    select: {
      amountCents: true,
      status: true,
      allocations: { select: { amountCents: true } },
    },
  });
  if (!charge || charge.status === "VOIDED" || charge.status === "WAIVED") {
    return;
  }
  const allocated = charge.allocations.reduce((a, x) => a + x.amountCents, 0);
  const status =
    allocated <= 0
      ? "PENDING"
      : allocated >= charge.amountCents
        ? "PAID"
        : "PARTIALLY_PAID";
  await tx.charge.update({ where: { id: chargeId }, data: { status } });
}

/** Create allocations for a payment and recompute each touched charge. */
export async function allocatePayment(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: string;
    paymentId: string;
    allocations: AllocationInput[];
  },
): Promise<void> {
  for (const alloc of args.allocations) {
    await tx.paymentAllocation.create({
      data: {
        organizationId: args.organizationId,
        paymentId: args.paymentId,
        chargeId: alloc.chargeId,
        amountCents: alloc.amountCents,
      },
    });
    await recomputeChargeStatus(tx, alloc.chargeId);
  }
}

/**
 * Reverse a payment's allocations (a void or refund): delete the allocation
 * links and reopen the affected charges. The Payment/Charge rows themselves
 * are never deleted — the caller sets the payment's status separately.
 */
export async function reversePaymentAllocations(
  tx: Prisma.TransactionClient,
  paymentId: string,
): Promise<void> {
  const allocations = await tx.paymentAllocation.findMany({
    where: { paymentId },
    select: { chargeId: true },
  });
  const chargeIds = [...new Set(allocations.map((a) => a.chargeId))];
  await tx.paymentAllocation.deleteMany({ where: { paymentId } });
  for (const chargeId of chargeIds) {
    await recomputeChargeStatus(tx, chargeId);
  }
}
