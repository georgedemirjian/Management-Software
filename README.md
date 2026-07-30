# Property Manager

Production-grade property management application. Initially operated by a
single landlord managing ~80 tenants across multiple properties held in
multiple LLCs; architected so it can evolve into a multi-tenant SaaS platform
without a rewrite.

**Current phase: foundation + auth + domain model (Phases 1–3).** The
project skeleton, the authentication/authorization layer, and the complete
database layer (organizations, LLCs, properties, units, tenants, leases,
charges, payments, documents) are in place. There are **no CRUD pages or
business workflows yet** — Phase 3 is schema, migrations, validation, and
seed data only.

## Tech stack

| Layer             | Choice                                   |
| ----------------- | ---------------------------------------- |
| Framework         | Next.js 16 (App Router, Turbopack)       |
| Language          | TypeScript (strict + extra safety flags) |
| Styling           | Tailwind CSS v4 + shadcn/ui (Base UI)    |
| Data              | Prisma 7 + PostgreSQL                    |
| Auth              | Better Auth (email/password + roles)     |
| Client data       | TanStack Query v5                        |
| Forms             | React Hook Form + Zod v4                 |
| Documents (later) | Cloudflare R2                            |
| Payments (later)  | Stripe                                   |

## Getting started

Requirements: Node.js ≥ 20.9 and a PostgreSQL 17 instance.

```bash
# 1. Install dependencies (also runs `prisma generate` via postinstall)
npm install

# 2. Configure environment
cp .env.example .env        # then fill in values (see comments in the file)

# 3. Start Postgres — pick one:
npm run db:up               #   a) Docker (uses docker-compose.yml)
                            #   b) hosted Postgres (Neon, Supabase, …) —
                            #      put its URL in DATABASE_URL (hosted DBs
                            #      also need SHADOW_DATABASE_URL for
                            #      `migrate dev`)

# 4. Apply migrations
npm run db:migrate

# 5. Seed: LANDLORD account + demo portfolio (reads SEED_* from .env)
npm run db:seed

# 6. Run the app and sign in at /login
npm run dev                 # http://localhost:3000
```

There is **no public registration**: the seed script creates the first
LANDLORD; every other account will be provisioned by a landlord through the
admin APIs in a later phase.

The seed also creates a realistic demo portfolio (2 LLCs, 5 properties,
11 units, 10 tenants, 10 leases across every lifecycle state, and a
financially consistent charge/payment ledger). Two demo tenants have portal
accounts: `alice.tenant@example.com` / `marcus.tenant@example.com`, password
`tenant-dev-password-123`. The domain seed is skipped if the organization
already exists; `npx prisma migrate reset` wipes and re-seeds everything.

## Scripts

| Script                            | Purpose                                       |
| --------------------------------- | --------------------------------------------- |
| `npm run dev`                     | Dev server (Turbopack)                        |
| `npm run build`                   | Production build                              |
| `npm run start`                   | Serve the production build                    |
| `npm run check`                   | Typecheck + lint + format check (CI entry)    |
| `npm run typecheck`               | `tsc --noEmit`                                |
| `npm run lint` / `lint:fix`       | ESLint                                        |
| `npm run format` / `format:check` | Prettier                                      |
| `npm run db:up` / `db:down`       | Start/stop the Docker Postgres                |
| `npm run db:migrate`              | Create + apply a dev migration                |
| `npm run db:seed`                 | Seed LANDLORD + demo portfolio (idempotent)   |
| `npm run db:deploy`               | Apply committed migrations (prod/CI)          |
| `npm run db:push`                 | Push schema without a migration (prototyping) |
| `npm run db:generate`             | Regenerate the Prisma client                  |
| `npm run db:studio`               | Prisma Studio data browser                    |

## Project structure

```
prisma/                 Prisma schema + migrations + seed.ts (landlord/org)
                        + seed-domain.ts (demo portfolio + ledger)
prisma.config.ts        Prisma 7 CLI config (loads .env, wires seed)
docker-compose.yml      Local Postgres 17
src/
  proxy.ts              Optimistic route guarding (see Authorization model)
  app/                  Routes, layouts, route handlers. Thin: composes
                        feature code, contains no business logic itself.
    (marketing)/        Public pages with the marketing navbar (/)
    (auth)/login/       Sign-in page (public)
    dashboard/          Protected app shell: sidebar + topbar + pages
    api/auth/[...all]/  Better Auth HTTP handler
    api/me/             Example protected JSON endpoint
    providers.tsx       Client providers (TanStack Query, next-themes)
  components/
    ui/                 shadcn/ui primitives (owned source, edit freely)
    layout/             App chrome: navbar, sidebar, topbar menus
  features/             Domain modules — see src/features/README.md
    auth/               Login form + its validation schema
  hooks/                Shared cross-domain React hooks
  lib/                  Shared utilities usable everywhere:
                        env.ts (validated env), utils.ts (cn),
                        query-client.ts, auth-client.ts (browser auth),
                        permissions.ts (Better Auth access control)
  server/               Server-only code — never import from Client
                        Components: db.ts (Prisma), auth.ts (Better Auth),
                        auth-helpers.ts (page guards), api.ts (API guards)
  services/             Clients for external systems (Stripe, R2, email —
                        added in later phases)
  types/                Global/shared TypeScript types (auth roles, API
                        wire shapes)
  validation/           Shared Zod schemas + helpers (domain-specific
                        schemas live inside their feature)
  generated/            Prisma client output (gitignored, rebuilt by
                        `postinstall`)
```

**Import boundaries** (top may import from bottom, never the reverse):

```
app  →  features  →  server / services  →  lib
```

Features must not import from other features' internals; shared code gets
promoted to `components`, `lib`, `server`, or `services`.

## Architecture decisions

### Next.js 16 App Router, server-first

The spec named Next.js 15, but a greenfield project should start on the
current major (16) — the App Router surface is unchanged and this avoids an
immediate ecosystem migration. Data access happens in Server Components and
server functions; TanStack Query handles client-side interactivity where it
is genuinely needed. _Alternative:_ a separate SPA + API (e.g. Vite + Fastify)
gives cleaner separation at the cost of duplicated types, auth plumbing, and
deployment complexity — not justified at this scale.

### Environment validation (`src/lib/env.ts`)

All configuration flows through a Zod schema that fails at boot, treats empty
strings as unset, and refuses to load in the browser. Reading `process.env`
directly anywhere else is a code smell. `SKIP_ENV_VALIDATION=1` exists for
image builds/CI. _Alternative:_ `@t3-oss/env-nextjs` adds a maintained
client/server split on top of the same idea — worth adopting the day we need
`NEXT_PUBLIC_*` variables.

### Prisma 7 + driver adapter

Prisma 7 is Rust-free and requires an explicit driver adapter — we use
`@prisma/adapter-pg` (node-postgres) configured from `DATABASE_URL`. The
generated client lives in `src/generated/prisma` (Prisma 7's model), is
gitignored, and is rebuilt by `postinstall`, so CI/Vercel builds work from a
clean checkout. `src/server/db.ts` exports a singleton cached on `globalThis`
so dev hot-reload doesn't leak connection pools. _Alternative:_ Drizzle is
lighter and closer to SQL; Prisma was chosen per spec and for its migration
story and schema readability.

### Better Auth (production email/password, no public registration)

`src/server/auth.ts` configures Better Auth with the Prisma adapter; its
handler is mounted at `/api/auth/[...all]`; `src/lib/auth-client.ts` is the
browser client. Decisions, in rough order of importance:

- **`disableSignUp: true`** — accounts exist only by provisioning: the seed
  script creates the first LANDLORD, and later phases create tenants via the
  admin plugin's `createUser` (server-side calls without request headers are
  its sanctioned provisioning path — Better Auth's own password hashing, no
  raw inserts).
- **`admin` plugin** — supplies the `role` column, ban semantics, and the
  user-management API the landlord will use to create tenant accounts.
  Custom role names require an access-control definition, which lives in
  `src/lib/permissions.ts` (client-importable by design); domain resources
  (e.g. `property: ["create", …]`) get added to its `statement` in later
  phases. Configured with `defaultRole: "TENANT"`, `adminRoles: ["LANDLORD"]`.
- **Roles are a Postgres enum** (`UserRole`), not the generated `String?` —
  the DB rejects junk. Mirrored by `src/types/auth.ts`; rerunning the Better
  Auth CLI generator will try to revert this field — review that diff.
- **Session `cookieCache` (5 min)** — most session checks are served from a
  signed cookie without touching Postgres. Trade-off: bans/revocations can
  take up to 5 minutes to reach already-issued cookies.
- **Rate limiting stored in the database** — the default in-memory store
  neither survives restarts nor is shared across serverless instances.
- **No email verification / password reset yet, deliberately** — both are
  useless without an email provider (`src/services/email` doesn't exist),
  and with registration disabled there's no unverified-signup threat. They
  arrive with tenant invitations.
- **`organization` plugin (adopted in Phase 3)** — configured with
  `allowUserToCreateOrganization: false` (organizations are provisioned by
  seed/onboarding, never self-created) and a session `databaseHook` that
  sets `activeOrganizationId` at sign-in from the user's membership.
  Members are **staff only**; tenant users are never members (they reach
  their own data through `Tenant.userId`).

_Alternatives:_ NextAuth/Auth.js (weaker typed server API), Clerk (fastest
to ship, but vendor-holds your user table, which conflicts with the SaaS
goal).

### Authorization model

Three layers, from cosmetic to authoritative:

1. **`src/proxy.ts`** — _optimistic only._ Checks session-cookie presence
   (not validity — cookies can be forged) to bounce signed-out visitors off
   `/dashboard/*` (with a `redirectTo` return path) and signed-in users off
   `/login`. Never treat it as security.
2. **Pages, layouts, Server Actions** — `requireAuth()` / `requireRole()` /
   `requireLandlord()` / `requireTenant()` / `requireOrg()` from
   `src/server/auth-helpers.ts` redirect unauthenticated users to `/login`
   and wrong-role users to `/dashboard`. `getCurrentSession()` is
   request-cached, so layout + page both calling it costs one lookup.
   **Every protected page calls a guard itself** — a layout check alone does
   not cover client-side navigation to sibling pages.
3. **API route handlers** — `requireApiAuth()` / `requireApiRole()` /
   `requireApiOrg()` from `src/server/api.ts` throw typed errors; the
   `apiHandler` wrapper converts them to the standardized JSON shape in
   `src/types/api.ts` (`401 UNAUTHORIZED`, `403 FORBIDDEN`) and converts
   unexpected errors to an opaque 500. See `src/app/api/me/route.ts` for the
   canonical pattern.
4. **Data access (from Phase 4 on)** — every domain query filters by the
   `organizationId` returned from `requireOrg()`/`requireApiOrg()`. Client
   input never contains organization ids.

Public routes: `/`, `/login`, `/api/auth/*`. Protected: `/dashboard/*` and
all future API routes except the auth handler.

### Ownership hierarchy & tenancy (Phase 3 — supersedes earlier notes)

```
Organization (Better Auth — the management business, the SaaS boundary)
  └─ Llc (legal entity holding title — an accounting grouping, NOT an
     │    access boundary; properties can move between LLCs freely)
     └─ Property ─ Unit ─ Lease ─┬─ LeaseTenant ─ Tenant (person record,
                                 │                optional userId link)
                                 ├─ Charge ─┐
                                 ├─ Payment ┴─ PaymentAllocation
                                 └─ Document
```

**Correction of an earlier decision:** Phases 1–2 said "LLC = organization."
That was wrong, and Phase 3 reverses it. LLCs are mutable legal fixtures —
landlords restructure them routinely — so making them the isolation boundary
would turn every restructure into a cross-tenant migration, force staff into
per-LLC memberships, and put consolidated reporting at war with the
isolation model. The Better Auth organization is the management _business_;
LLC is a plain domain table under it.

Multi-tenancy is single-database, shared-table, **row-level scoping**: every
domain table carries `organizationId` — including derivable children
(`Unit`, `LeaseTenant`, `PaymentAllocation`) — so org-scoped queries never
need joins and Postgres RLS can be layered on later. The invariant: a
child's `organizationId` always equals its parent's (seed-verified; server
functions enforce it by construction because the org id only ever comes
from `requireOrg()`, never from the client). _Alternatives:_ schema- or
database-per-tenant isolate harder but explode operational cost; composite
FKs (`[id, organizationId]` references) would make mismatches impossible at
the DB level and remain an available hardening step, deferred for the
relation-plumbing noise they add.

### Domain model & financial records (Phase 3)

- **Tenant ≠ User.** A `Tenant` is an org-scoped person record; most never
  log in. `Tenant.userId` is linked only when portal access is provisioned.
  `Lease ↔ Tenant` is many-to-many (`LeaseTenant`) for co-signers and
  renewals; `isPrimary` marks the primary contact.
- **Ledger:** `Charge` = money owed, `Payment` = money received,
  `PaymentAllocation` = which payment settled which charge. Partial payments
  and one payment covering several charges (Stripe's webhook reality) fall
  out naturally. `Charge.status` is stored for queryability but derivable
  from allocation sums — payment-application logic must update both in one
  transaction.
- **Append-only financial rows.** `Charge`/`Payment`/`PaymentAllocation`
  have no `deletedAt` by design: corrections are status changes (`VOIDED`,
  `WAIVED`, `REFUNDED`), and `Restrict` FKs make deleting an allocated
  payment or charge fail at the database. Structural rows (`Llc`,
  `Property`, `Unit`, `Tenant`, `Lease`, `Document`) soft-delete via
  `deletedAt` — queries must filter `deletedAt: null`.
- **Money:** integer cents (`*Cents` columns), USD assumed portfolio-wide; a
  currency column is deliberately deferred until a non-US requirement
  exists. Civil dates (lease terms, due dates) are `@db.Date` — no timezone
  drift on "the 1st of the month."
- **Lifecycle:** leases are created `DRAFT`; `PENDING` (signed, future),
  `ACTIVE`, `ENDED` (natural), `TERMINATED` (early, with `moveOutDate`).
  Renewals create a NEW lease linked via `renewedFromId` — history is never
  mutated. Lifecycle transitions will be dedicated workflows, not free-form
  status edits.
- **Documents** carry metadata + a unique `storageKey` (Cloudflare R2
  later). At most one parent (`propertyId`/`unitId`/`leaseId`/`tenantId`,
  Zod-enforced); none = organization-level document.
- **Audit prep:** `createdById` is a plain column with **no FK** — an FK
  with `SET NULL` would erase authorship exactly when it matters (user
  deletion). `updatedBy` is deferred to a real audit-log table rather than
  shipping a column nothing reliably maintains.
- **Validation:** shared primitives in `src/validation/common.ts`
  (`centsSchema`, `isoDateSchema`, `dueDaySchema` capped at 28 so the
  billing day exists in every month); per-entity `z.strictObject` input
  schemas in `src/features/<domain>/validation/`. Input schemas never
  accept `organizationId`, ids, or timestamps.

### shadcn/ui on Base UI

`shadcn init` (CLI v4) now defaults to Base UI primitives with the
`base-nova` style — components are copied into `src/components/ui` as owned
source, not installed as a dependency. Note that Base UI composes via a
`render` prop instead of Radix's `asChild`. Base color: neutral; theming via
CSS variables; dark mode via `next-themes` (class strategy) with a
light/dark/system toggle in the navbar.

### TanStack Query wiring

`src/lib/query-client.ts` implements the documented App Router pattern — a
fresh `QueryClient` per server render, a singleton in the browser, non-zero
`staleTime` so hydrated data isn't instantly refetched. Providers mount once
in `src/app/providers.tsx`, keeping the root layout a Server Component.

### TypeScript, linting, formatting

Beyond `strict`: `noUncheckedIndexedAccess` (indexing returns `T | undefined`),
`verbatimModuleSyntax` (explicit `import type`), `noImplicitOverride`,
`noFallthroughCasesInSwitch`. ESLint (flat config) handles correctness,
Prettier handles style (with Tailwind class sorting); `eslint-config-prettier`
keeps them from fighting. `npm run check` is the single CI gate.

### Conventions that keep the SaaS door open

- All money values are stored as **integer cents**, never floats.
- Domain writes go through feature `server/` functions validated with Zod —
  never raw Prisma calls from route files.
- Financial records are append-only, structural records soft-delete — see
  "Domain model & financial records" above for the enforced split.

## Environment variables

Documented and validated in [`src/lib/env.ts`](src/lib/env.ts); template in
[`.env.example`](.env.example). App runtime: `DATABASE_URL`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Tooling-only: `SHADOW_DATABASE_URL`
(hosted Postgres + `migrate dev`). Seed-only (never read by the app):
`SEED_LANDLORD_EMAIL`, `SEED_LANDLORD_PASSWORD`, `SEED_LANDLORD_NAME`.

## Roadmap

1. ~~**Auth foundation**~~ — done (Phase 2): sign-in/out, roles, guards,
   route protection, protected dashboard shell, seeded LANDLORD.
2. ~~**Organizations + domain model**~~ — done (Phase 3): organization
   plugin, full schema (LLCs → properties → units → leases → tenants +
   append-only ledger + documents), migrations, Zod schemas, realistic seed.
3. **CRUD + workflows (next)** — feature server functions (org-scoped via
   `requireOrg`), property/tenant/lease management UI, payment application
   logic (allocations + `Charge.status` in one transaction), lease lifecycle
   workflows (activate, renew, terminate/move-out), tenant portal surface.
   Tenant invitations arrive here with the email service.
4. **Online payments** — Stripe integration (`src/services/stripe`): intents
   land as `Payment` rows via `stripePaymentIntentId`, webhooks drive
   `PENDING → COMPLETED/FAILED`.
5. **Documents** — Cloudflare R2 (`src/services/storage`) behind the
   existing `Document.storageKey` seam.
6. **Hardening** — Vitest + Playwright, GitHub Actions CI, error monitoring.
