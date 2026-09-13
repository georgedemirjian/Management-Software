"use server";

import { env } from "@/lib/env";
import { getCurrentUser } from "@/server/auth-helpers";
import { db } from "@/server/db";
import { getStripe, isStripeConfigured } from "@/services/stripe";
import type { ActionResult } from "@/server/action";

const typeLabel = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

/**
 * Start a hosted Stripe Checkout for a tenant to pay their lease's open
 * charges. Authorization is tenant-portal style: the signed-in user must be
 * linked (via `Tenant.userId`) to a tenant on the lease — tenants have no
 * organization membership.
 *
 * Records a PENDING Payment up front and stashes the intended allocations in
 * the session metadata; the webhook is what settles it (never the browser).
 */
export async function createLeaseCheckoutSession(
  leaseId: string,
): Promise<ActionResult<{ url: string }>> {
  if (!isStripeConfigured()) {
    return { ok: false, error: "Online payments are not enabled." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in and try again." };

  const tenant = await db.tenant.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, organizationId: true, email: true },
  });
  if (!tenant) {
    return { ok: false, error: "No tenant profile is linked to your account." };
  }

  const lease = await db.lease.findFirst({
    where: {
      id: leaseId,
      organizationId: tenant.organizationId,
      deletedAt: null,
      tenants: { some: { tenantId: tenant.id } },
    },
    select: {
      id: true,
      organizationId: true,
      charges: {
        where: { status: { in: ["PENDING", "PARTIALLY_PAID"] } },
        select: {
          id: true,
          type: true,
          description: true,
          amountCents: true,
          allocations: { select: { amountCents: true } },
        },
      },
    },
  });
  if (!lease) return { ok: false, error: "Lease not found." };

  const open = lease.charges
    .map((c) => ({
      id: c.id,
      type: c.type,
      description: c.description,
      balanceCents:
        c.amountCents - c.allocations.reduce((a, x) => a + x.amountCents, 0),
    }))
    .filter((c) => c.balanceCents > 0);

  if (open.length === 0) {
    return { ok: false, error: "There is nothing due on this lease." };
  }

  const total = open.reduce((sum, c) => sum + c.balanceCents, 0);

  // Record the pending payment first so the webhook has a row to settle.
  const payment = await db.payment.create({
    data: {
      organizationId: lease.organizationId,
      leaseId: lease.id,
      tenantId: tenant.id,
      method: "CARD",
      status: "PENDING",
      amountCents: total,
      receivedAt: new Date(),
    },
    select: { id: true },
  });

  const allocationPlan = open.map((c) => ({ c: c.id, a: c.balanceCents }));

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: tenant.email ?? undefined,
      line_items: open.map((c) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: c.balanceCents,
          product_data: {
            name: c.description
              ? `${typeLabel(c.type)} — ${c.description}`
              : typeLabel(c.type),
          },
        },
      })),
      success_url: `${env.BETTER_AUTH_URL}/dashboard?payment=success`,
      cancel_url: `${env.BETTER_AUTH_URL}/dashboard?payment=canceled`,
      client_reference_id: payment.id,
      metadata: {
        paymentId: payment.id,
        organizationId: lease.organizationId,
        leaseId: lease.id,
        allocations: JSON.stringify(allocationPlan),
      },
      payment_intent_data: { metadata: { paymentId: payment.id } },
    });

    await db.payment.update({
      where: { id: payment.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    if (!session.url) {
      return {
        ok: false,
        error: "Could not start checkout. Please try again.",
      };
    }
    return { ok: true, data: { url: session.url } };
  } catch (error) {
    // Roll the pending payment back to FAILED so it doesn't linger.
    await db.payment
      .update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason: "Checkout session not created",
        },
      })
      .catch(() => {});
    console.error("[stripe] checkout session creation failed:", error);
    return { ok: false, error: "Could not start checkout. Please try again." };
  }
}
