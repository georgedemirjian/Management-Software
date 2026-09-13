import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { processStripeEvent } from "@/features/payments/server/stripe-webhook";
import { env } from "@/lib/env";
import { getStripe, isStripeConfigured } from "@/services/stripe";

// Stripe signature verification needs the Node crypto runtime and the raw
// request body (never a parsed one).
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    // Bad signature → 400 so Stripe does not retry a forged/misconfigured call.
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await processStripeEvent(event);
  } catch (error) {
    // 500 so Stripe retries a transient failure (DB blip, etc.).
    console.error(
      `[stripe] failed to process ${event.type} (${event.id}):`,
      error,
    );
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
