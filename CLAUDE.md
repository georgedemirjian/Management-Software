@AGENTS.md

# Property Manager

Property management app: one landlord, ~80 tenants, multiple properties across
multiple LLCs. Must be able to evolve into multi-tenant SaaS without a
rewrite. Prioritize clean architecture, maintainability, and type safety over
speed of delivery. Full architecture rationale lives in README.md.

**Current phase: Phases 1–5 complete.** Foundation, auth, full schema, all
domain CRUD + workflows (properties, tenants, leases + lifecycle, payment
engine, dashboard), and **Stripe online payments** (tenant portal → hosted
Checkout → webhook settlement). Next is Phase 6 (documents / R2). There is NO
public registration: the first LANDLORD comes from `npm run db:seed`; tenant
accounts are provisioned via the Better Auth admin plugin. When copying a
domain, **properties** is the cleanest reference; **leases + payments** show
the transactional/lifecycle patterns.

## Stripe / online payments (Phase 5)

- Stripe is OPTIONAL: gate every Stripe surface on `isStripeConfigured()`
  (`@/lib/env`). The app must build and run with no Stripe env vars.
- The client (`@/services/stripe`) is lazy — call `getStripe()` only after the
  `isStripeConfigured()` check. Uses hosted **Checkout** (server redirect), so
  there is NO publishable key / client Stripe.js; only `STRIPE_SECRET_KEY` +
  `STRIPE_WEBHOOK_SECRET` (both optional).
- **The webhook settles payments, never the browser.** Checkout records a
  PENDING Payment; `POST /api/webhooks/stripe` (signature-verified) flips it
  COMPLETED. Webhook logic lives in `stripe-webhook.ts` (`processStripeEvent`,
  idempotent via the `webhook_event` table) and reuses the shared settlement
  engine — do NOT re-implement allocation there.
- Tenant-portal auth: tenants have no org; reach their data only via
  `Tenant.userId`, and verify lease membership before any tenant action
  (see `createLeaseCheckoutSession`). `requireOrg` does NOT apply to tenants.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind v4 ·
shadcn/ui on **Base UI** (`base-nova` style) · Prisma 7 + PostgreSQL ·
Better Auth · TanStack Query v5 · React Hook Form · Zod v4.
Planned later: Cloudflare R2 (documents), Stripe (payments).

## Commands

- `npm run check` — typecheck + lint + format check; run before finishing work
- `npm run dev` / `npm run build`
- `npm run db:migrate -- --name <name>` — needs a running Postgres
  (`npm run db:up` for Docker, or any Postgres at `DATABASE_URL`)
- `npm run db:generate` — after every schema edit
- `npm run db:seed` — creates the initial LANDLORD from `SEED_LANDLORD_*`
  env vars (idempotent)

## Data access & mutations (Phase 4 — copy the properties feature)

- **Reads:** Server Components call `features/<domain>/server/queries.ts`.
  Every query takes `organizationId` (from `requireOrg()`), filters
  `deletedAt: null`, starts with `import "server-only"`, and converts Prisma
  `Decimal` → `number` before returning.
- **Writes:** Server Actions in `features/<domain>/server/actions.ts` — file
  starts with `"use server"`, every export is a literal
  `export async function` delegating to `runOrgAction(schema, input, handler)`
  (`@/server/action`). Never export a non-async binding from that file.
- In a handler, RE-VERIFY every client-supplied id against `ctx.organizationId`
  before use (see `assertLlcInOrg`), throw `ActionError` for clean failures,
  and call `revalidatePath(...)` after writing.
- Structural deletes are soft (`deletedAt`, cascade to children, block on
  active lease). NEVER delete Charge or Payment rows — corrections are status
  changes (VOIDED/WAIVED/REFUNDED).
- **Payment engine invariant:** `Charge.status` is derived from allocation
  sums. NEVER write `PaymentAllocation` directly — use the shared settlement
  engine `@/features/payments/server/settlement.ts` (`allocatePayment` /
  `reversePaymentAllocations`, which recompute charge status) inside a
  `db.$transaction`. Both the manual `recordPayment`/`voidPayment` and the
  Stripe webhook go through it. Voiding/refunding a payment reverses its
  allocations + reopens charges but keeps the payment row (VOIDED/REFUNDED).
- **Money in forms:** the complex forms (lease create, renew, charge,
  payment) use controlled `useState` (not RHF) and convert dollars→cents with
  `dollarsToCents` on submit; the server action re-validates and returns
  `fieldErrors`. Mount dialog bodies only while open (or conditionally render
  the dialog) so state re-initializes from fresh props after `router.refresh`
  — do NOT reset via `useEffect` (the `set-state-in-effect` lint rule).
- **Forms** (client dialogs): RHF + `standardSchemaResolver(zodSchema)`,
  shared `Field` (`@/components/form/field`), `applyFieldErrors` for a
  Server Action's `fieldErrors`, `numericField` register option for numbers,
  `Controller` for the Base UI `Select`. Dialogs are controlled
  (`open`/`onOpenChange`), not trigger-nested. Destructive confirms use
  `@/components/confirm-dialog`. Money via `@/lib/money`, dates via
  `@/lib/format`. There is NO shadcn `form` component on Base UI.
- Enable a sidebar nav item (`@/components/layout/app-sidebar`) when its
  domain ships.

## Architecture rules

- `src/app` is thin routing; business logic lives in `src/features/<domain>`
  (layout inside each feature: `components/`, `hooks/`, `server/`,
  `validation/` — see src/features/README.md).
- Import direction: `app → features → server|services → lib`. Features never
  import another feature's internals.
- `src/server/**` is server-only (Prisma, Better Auth); never import it from
  Client Components. Browser auth goes through `src/lib/auth-client.ts`.
- Read config via `import { env } from "@/lib/env"` — never `process.env`
  directly. New env vars: add to the Zod schema in `src/lib/env.ts` AND
  `.env.example`.
- Database access only via `import { db } from "@/server/db"`.
- Validate all external input (forms, route handlers, server actions) with
  Zod schemas.

## Authorization (Phase 2 — use these, never inline auth logic)

- Pages/layouts/Server Actions: `requireAuth()`, `requireRole(role)`,
  `requireLandlord()`, `requireTenant()`, `requireOrg()`,
  `getCurrentUser()`, `getCurrentSession()` from `@/server/auth-helpers`
  (they redirect).
- API route handlers: wrap in `apiHandler(...)` and use `requireApiAuth()` /
  `requireApiRole(role)` / `requireApiOrg()` from `@/server/api` (they throw
  typed 401/403 → standardized JSON from `@/types/api`). `/api/me` is the
  canonical example.
- EVERY domain query filters by the `organizationId` from
  `requireOrg()`/`requireApiOrg()`. Organization ids never come from client
  input — input schemas exclude them by design.
- **Every protected page/action/handler calls a guard itself.** The
  dashboard layout's `requireAuth()` and `src/proxy.ts` (cookie-presence
  check only, not security) are not sufficient alone.
- Roles are the `UserRole` union from `@/types/auth` (LANDLORD | TENANT) —
  persona-level only. Per-LLC authority comes with the `organization`
  plugin in Phase 3; extend `statement` in `src/lib/permissions.ts` for new
  resources instead of ad-hoc role checks.
- Route groups: `(marketing)` public + navbar, `(auth)/login` public,
  `dashboard/` protected shell (sidebar + topbar).

## Multi-tenancy (the one non-negotiable)

The Better Auth organization = the MANAGEMENT BUSINESS (SaaS boundary).
An LLC is a plain domain row under it — NOT an access boundary (this
corrects the Phase 1–2 note that said "LLC = organization"). Every domain
table carries `organizationId` — including derivable children — and a
child's `organizationId` must equal its parent's. Never create an unscoped
domain table. Organization members are STAFF ONLY; tenant users are never
members (they reach their data via `Tenant.userId`).

## Domain model rules (Phase 3)

- Hierarchy: Organization → Llc → Property → Unit → Lease →
  {LeaseTenant→Tenant, Charge, Payment→PaymentAllocation, Document}.
- Money: integer cents in `*Cents` columns; USD assumed. Never floats.
- Civil dates (lease terms, dueDate) are `@db.Date` — construct with
  `new Date(Date.UTC(y, m-1, d))` to avoid TZ drift.
- FINANCIAL ROWS ARE APPEND-ONLY: never delete or mutate amounts on
  Charge/Payment/PaymentAllocation. Corrections = status changes (VOIDED /
  WAIVED / REFUNDED). Restrict FKs enforce this at the DB.
- Structural rows (Llc/Property/Unit/Tenant/Lease/Document) soft-delete via
  `deletedAt` — every read must filter `deletedAt: null`.
- `Charge.status` is derivable from allocations; update it in the SAME
  transaction that writes PaymentAllocation rows.
- Lease lifecycle: DRAFT → PENDING → ACTIVE → ENDED/TERMINATED. Renewals
  create a NEW lease with `renewedFromId`; move-out sets `moveOutDate`.
  Transitions are dedicated workflows, never free-form status edits.
- Tenant ≠ User: Tenant is the person record; `userId` optional link.
- Zod: shared primitives in `@/validation/common`; per-entity
  `z.strictObject` create/update schemas in `features/<domain>/validation/`.
  Inputs never include organizationId/ids/timestamps.

## Gotchas

- **Prisma 7**: client is generated to `src/generated/prisma` (gitignored;
  `postinstall` regenerates). Import types from
  `@/generated/prisma/client`. Runtime needs the `@prisma/adapter-pg` driver
  adapter — already wired in `src/server/db.ts`. CLI config is
  `prisma.config.ts` (loads `.env` via dotenv), not schema-embedded env().
- **shadcn on Base UI**: compose triggers with the `render` prop
  (`<DropdownMenuTrigger render={<Button />}>…`), NOT Radix's `asChild` —
  it does not exist here. Components in `src/components/ui` are owned
  source; edit them directly. Add new ones: `npx shadcn@latest add <name>`.
- **Better Auth schema changes** (e.g. adding plugins): regenerate models
  with `npx @better-auth/cli@latest generate --config src/server/auth.ts
--output prisma/schema.prisma --yes`, then migrate. Review the diff: the
  generator may revert `User.role` to `String?` (keep the `UserRole` enum)
  and may drop the domain back-relations on `Organization`/`User` (restore
  them — they're marked with comments in the schema).
- **activeOrganizationId** is set on session CREATE by a databaseHook in
  `src/server/auth.ts` (first membership wins). Org switching later needs
  Better Auth's `setActive` API + hook revision.
- **Local dev DB**: `npm run db:up` (Docker) or any Postgres at
  DATABASE_URL. Hosted Postgres needs SHADOW_DATABASE_URL for
  `migrate dev`. Avoid `npx prisma dev` — its multi-database emulation
  proved unreliable in testing (Phase 3).
- **Session cookieCache is 5 min**: bans/revocations may take up to 5
  minutes to propagate to issued cookies. Rate limiting persists in the
  `rateLimit` table (works across serverless instances).
- **Zod v4** syntax: `z.url()`, `z.treeifyError()` — not the v3 forms.
- Money is always integer cents; never floats.
- `tsconfig` has `noUncheckedIndexedAccess` (indexing returns
  `T | undefined`) and `verbatimModuleSyntax` (use `import type`).
