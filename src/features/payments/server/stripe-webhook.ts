import "server-only";

import type Stripe from "stripe";

import {
  allocatePayment,
  reversePaymentAllocations,
  type AllocationInput,
} from "@/features/payments/server/settlement";
import { db } from "@/server/db";

/**
 * Stripe webhook processing. Kept separate from the HTTP route so it can be
 * unit-tested with synthetic events (bypassing signature verification).
 *
 * Two invariants:
 *  - Idempotent: every event id is recorded in `webhook_event`; a replay is a
 *    no-op (Stripe retries deliveries).
 *  - The DB is the source of truth: settlement reuses the same
 *    allocate/reverse primitives as the manual payment path, so an online
 *    payment lands in the ledger identically to a recorded one.
 */

type AllocationPlan = { c: string; a: number }[];

function parseAllocationPlan(raw: string | undefined): AllocationPlan {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((x) =>
      x &&
      typeof x === "object" &&
      typeof (x as { c?: unknown }).c === "string" &&
      typeof (x as { a?: unknown }).a === "number"
        ? [{ c: (x as { c: string }).c, a: (x as { a: number }).a }]
        : [],
    );
  } catch {
    return [];
  }
}

function intentId(
  value: string | Stripe.PaymentIntent | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Dispatch a verified event. Safe to call more than once per event id. */
export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  const already = await db.webhookEvent.findUnique({ where: { id: event.id } });
  if (already) return;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await settleCheckout(event.data.object);
      break;
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await failCheckout(event.data.object);
      break;
    case "charge.refunded":
      await refundCharge(event.data.object);
      break;
    default:
      break;
  }

  await db.webhookEvent.create({ data: { id: event.id, type: event.type } });
}

async function settleCheckout(session: Stripe.Checkout.Session): Promise<void> {
  // Only settle once Stripe reports the money as captured (async methods like
  // ACH fire `completed` while still `unpaid`, then `async_payment_succeeded`).
  if (session.payment_status !== "paid") return;

  const paymentId = session.metadata?.paymentId;
  if (!paymentId) return;

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, organizationId: true },
  });
  if (!payment || payment.status !== "PENDING") return; // already handled / unknown

  const plan = parseAllocationPlan(session.metadata?.allocations);

  await db.$transaction(async (tx) => {
    // Re-validate each planned allocation against the charge's CURRENT
    // remaining balance (it may have moved since checkout began) and clamp,
    // so an online payment can never over-allocate.
    const allocations: AllocationInput[] = [];
    for (const item of plan) {
      const charge = await tx.charge.findFirst({
        where: {
          id: item.c,
          organizationId: payment.organizationId,
          status: { notIn: ["VOIDED", "WAIVED"] },
        },
        select: {
          amountCents: true,
          allocations: { select: { amountCents: true } },
        },
      });
      if (!charge) continue;
      const already = charge.allocations.reduce((a, x) => a + x.amountCents, 0);
      const remaining = charge.amountCents - already;
      const amount = Math.min(item.a, remaining);
      if (amount > 0)
        allocations.push({ chargeId: item.c, amountCents: amount });
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        stripePaymentIntentId: intentId(session.payment_intent),
        receivedAt: new Date(),
      },
    });
    await allocatePayment(tx, {
      organizationId: payment.organizationId,
      paymentId: payment.id,
      allocations,
    });
  });
}

async function failCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const paymentId = session.metadata?.paymentId;
  if (!paymentId) return;
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true },
  });
  if (!payment || payment.status !== "PENDING") return;
  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: "FAILED",
      failureReason: `Checkout ${session.status ?? "not completed"}`,
    },
  });
}

async function refundCharge(charge: Stripe.Charge): Promise<void> {
  const pi = intentId(charge.payment_intent);
  if (!pi) return;
  const payment = await db.payment.findFirst({
    where: { stripePaymentIntentId: pi },
    select: { id: true, status: true },
  });
  if (!payment || payment.status !== "COMPLETED") return;
  await db.$transaction(async (tx) => {
    await reversePaymentAllocations(tx, payment.id);
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });
  });
}
