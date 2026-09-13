import "server-only";

import Stripe from "stripe";

import { env, isStripeConfigured } from "@/lib/env";

export { isStripeConfigured };

/**
 * Lazily-constructed Stripe client. Kept out of module scope so the app boots
 * (and builds) without Stripe configured — call sites first check
 * `isStripeConfigured()` and only reach for the client when a payment feature
 * actually runs.
 *
 * Uses Checkout (hosted redirect), so only the secret key is needed here; no
 * publishable key ships to the browser.
 */
let cached: Stripe | undefined;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe is not configured (STRIPE_SECRET_KEY is unset). Guard with isStripeConfigured().",
    );
  }
  // apiVersion omitted → the SDK uses the API version it was built against,
  // keeping request/response types and behaviour in sync.
  cached ??= new Stripe(env.STRIPE_SECRET_KEY, {
    typescript: true,
    appInfo: { name: "property-manager" },
  });
  return cached;
}
