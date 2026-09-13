# Phase 5 — Online Payments (Stripe)

> **Status: implemented.** Delivered: schema (`Organization.stripeAccountId`/
> `stripeChargesEnabled`, `Tenant.stripeCustomerId`, `Payment.stripe*`/
> `failureReason`, `webhook_event`), lazy Stripe service, shared settlement
> engine, `createLeaseCheckoutSession` (hosted Checkout), signature-verified
> idempotent webhook (`/api/webhooks/stripe`), and the tenant portal. Verified
> by an integration test over `processStripeEvent`.
> **Deferred:** Connect onboarding UI, ACH/`us_bank_account`, Stripe fee
> capture, saved payment methods, `@t3-oss/env-nextjs`. What still needs live
> keys to exercise: the Checkout redirect and signature verification.

Goal: let tenants pay rent online and have those payments flow into the
existing ledger automatically, without changing how the ledger works. The
Phase 3 schema already anticipated this (`Payment.stripePaymentIntentId`,
`PaymentStatus.PENDING/FAILED/REFUNDED`), and the Phase 4 payment engine
(`recordPayment` / `recomputeChargeStatus`) is the settlement primitive Stripe
webhooks will reuse. **No schema rewrite is expected** — this is integration.

## Guiding principle

Stripe is a _source of payments_, not a second ledger. A Stripe charge
becomes a `Payment` row; a successful webhook allocates it to open charges
via the same transaction the manual flow uses. The database, not Stripe, is
the system of record.

## Architectural decisions to make first

1. **Stripe Connect vs. single account.** Recommendation: **Stripe Connect
   (Express)** per organization from day one. Even though there is one
   landlord today, funds must settle to the landlord's (later: each org's)
   bank account, not the platform's. Model it as `Organization` →
   `stripeAccountId`. Retrofitting Connect later is painful; adding the column
   now is cheap. (Alternative: single platform account — simpler, but wrong
   for the multi-LLC/SaaS goal and commingles funds.)
2. **Payment method.** ACH (via Stripe Financial Connections / `us_bank_account`)
   should be the default for rent — card fees (~2.9%) are punitive on
   $1,500 rent. Support cards as a fallback. Decide who eats the fee
   (surcharge vs. absorb) — store it on the payment if surcharging.
3. **Webhooks are the source of truth, not the client.** Never mark a payment
   COMPLETED from the browser success callback; only the
   `payment_intent.succeeded` webhook does. This is the single most common
   Stripe integration bug.
4. **Idempotency.** Every webhook handler must be idempotent (Stripe retries).
   Key on `stripePaymentIntentId` (already `@unique`) and ignore duplicates.

## Schema additions (one migration)

- `Organization.stripeAccountId String? @unique` — Connect account.
- `Organization.stripeChargesEnabled Boolean @default(false)` — onboarding gate.
- Optional `Payment.stripeFeeCents Int?` and `Payment.failureReason String?`.
- Optional `WebhookEvent` table (`id` = Stripe event id, `type`, `processedAt`)
  for idempotency + audit, if we don't want to rely solely on the intent id.
- A tenant → Stripe customer link if we save payment methods
  (`Tenant.stripeCustomerId String? @unique`).

## Build order

1. **Service layer** — `src/services/stripe/` (client singleton from
   `STRIPE_SECRET_KEY`, typed wrappers). Add env vars to `src/lib/env.ts`
   (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_
PUBLISHABLE_KEY`). This is the first `NEXT_PUBLIC_*` var — good moment to
   adopt `@t3-oss/env-nextjs` (flagged since Phase 1) for the client/server
   split.
2. **Connect onboarding** — a landlord settings page that creates an Express
   account and renders an onboarding link; store `stripeAccountId`, flip
   `stripeChargesEnabled` on `account.updated`.
3. **Create-intent server action** — `createRentPaymentIntent(leaseId, chargeIds)`:
   `requireOrg`/portal auth, compute amount from the selected open charges,
   create a PaymentIntent `on_behalf_of` the org's Connect account with
   metadata `{ organizationId, leaseId, chargeIds }`, and insert a `Payment`
   row `status: PENDING` with the `stripePaymentIntentId`. Reuses the Phase 4
   ownership checks.
4. **Webhook route** — `POST /api/webhooks/stripe` (a real route handler, not
   a Server Action; uses the existing `apiHandler`). Verify the signature with
   `STRIPE_WEBHOOK_SECRET`, then:
   - `payment_intent.succeeded` → set the `Payment` to COMPLETED and run the
     **existing allocation transaction** (allocate to the intent's charges,
     `recomputeChargeStatus`) — idempotent on the intent id.
   - `payment_intent.payment_failed` → `Payment.status = FAILED` (no allocations).
   - `charge.refunded` → `Payment.status = REFUNDED`, reverse allocations
     (same reversal path as `voidPayment`).
     Exclude `/api/webhooks/*` from the auth proxy matcher (Stripe is unauthenticated
     but signature-verified).
5. **Tenant-facing pay flow** — the first real tenant-portal surface: a tenant
   signs in (Phase 2 role), sees their lease's open charges, and pays with
   Stripe Elements (`NEXT_PUBLIC_*` publishable key). Confirms client-side,
   but status only updates when the webhook lands.
6. **Landlord visibility** — the existing ledger already renders
   PENDING/FAILED/REFUNDED (Phase 4 handled those badges); add a "paid online"
   indicator and the Stripe fee if surcharging.

## Testing (Stripe specifics)

- Use the Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`)
  to replay events locally; test cards/bank numbers for success, failure, and
  dispute.
- Assert idempotency: replaying `payment_intent.succeeded` twice creates one
  allocation set, not two.
- Reuse the Phase 4 integration-test style: drive a PENDING → COMPLETED
  webhook and assert `Charge.status` transitions exactly as the manual path.

## Explicitly deferred

- Payouts/statements UI, late-fee automation (a cron that reads `dueDay`/
  `graceDays` and issues `LATE_FEE` charges — a good Phase 6 companion), and
  multi-currency (still USD-only).

## Prerequisite

Stand up a **persistent database** before starting (Docker `npm run db:up` or
hosted). Phase 5 involves external webhooks and multi-step async flows that
are miserable to develop against an ephemeral DB.
