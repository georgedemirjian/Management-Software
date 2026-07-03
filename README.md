# Property Manager

Production-grade property management application. Initially operated by a
single landlord managing ~80 tenants across multiple properties held in
multiple LLCs; architected so it can evolve into a multi-tenant SaaS platform
without a rewrite.

**Current phase: foundation only.** No business features are implemented yet —
this repo contains the project skeleton, tooling, and infrastructure wiring.

## Tech stack

| Layer             | Choice                                   |
| ----------------- | ---------------------------------------- |
| Framework         | Next.js 16 (App Router, Turbopack)       |
| Language          | TypeScript (strict + extra safety flags) |
| Styling           | Tailwind CSS v4 + shadcn/ui (Base UI)    |
| Data              | Prisma 7 + PostgreSQL                    |
| Auth              | Better Auth (placeholder wiring)         |
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
npx prisma dev              #   b) Prisma local dev server (no Docker needed)
                            #   c) hosted Postgres (Neon, Prisma Postgres, …)
                            #      — put its URL in DATABASE_URL

# 4. Create the database schema
npm run db:migrate -- --name init

# 5. Run the app
npm run dev                 # http://localhost:3000
```

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
| `npm run db:deploy`               | Apply committed migrations (prod/CI)          |
| `npm run db:push`                 | Push schema without a migration (prototyping) |
| `npm run db:generate`             | Regenerate the Prisma client                  |
| `npm run db:studio`               | Prisma Studio data browser                    |

## Project structure

```
prisma/                 Prisma schema + migrations
prisma.config.ts        Prisma 7 CLI config (loads .env)
docker-compose.yml      Local Postgres 17
src/
  app/                  Routes, layouts, route handlers. Thin: composes
                        feature code, contains no business logic itself.
    api/auth/[...all]/  Better Auth HTTP handler
    providers.tsx       Client providers (TanStack Query, next-themes)
  components/
    ui/                 shadcn/ui primitives (owned source, edit freely)
    layout/             App chrome: navbar, theme toggle
  features/             Domain modules (properties, tenants, leases, …) —
                        see src/features/README.md for the internal layout
  hooks/                Shared cross-domain React hooks
  lib/                  Shared utilities usable everywhere:
                        env.ts (validated env), utils.ts (cn),
                        query-client.ts, auth-client.ts (browser auth)
  server/               Server-only code — never import from Client
                        Components: db.ts (Prisma), auth.ts (Better Auth)
  services/             Clients for external systems (Stripe, R2, email —
                        added in later phases)
  types/                Global/shared TypeScript types
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

### Better Auth (placeholder wiring)

`src/server/auth.ts` configures Better Auth with the Prisma adapter; its
handler is mounted at `/api/auth/[...all]`; `src/lib/auth-client.ts` is the
browser client. Its four tables (`user`, `session`, `account`, `verification`)
were generated by the Better Auth CLI. There is deliberately no sign-in UI
yet. **Multi-LLC plan:** when organizations become a feature, add Better
Auth's `organization` plugin and model each LLC as an organization — that is
also the SaaS tenancy seam. _Alternatives:_ NextAuth/Auth.js (weaker typed
server API), Clerk (fastest to ship, but vendor-holds your user table, which
conflicts with the SaaS goal).

### Multi-tenancy strategy (decided now, implemented later)

Single database, shared tables, **row-level scoping**: every domain table will
carry an `organizationId` (LLC) foreign key from the day it is created, and
every query goes through a scoped helper. This is the one decision that is
prohibitively expensive to retrofit — writing unscoped tables "for now" is the
rewrite we are avoiding. _Alternatives:_ schema-per-tenant or database-per-
tenant isolate harder but explode operational cost at SaaS scale; Postgres RLS
can be layered onto this design later as defense in depth.

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
- Financial records (rent ledgers, payments) will be append-only/soft-deleted
  for auditability.

## Environment variables

Documented and validated in [`src/lib/env.ts`](src/lib/env.ts); template in
[`.env.example`](.env.example). Currently: `DATABASE_URL`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.

## Roadmap

1. **Auth UI + organizations** — sign-in pages, Better Auth `organization`
   plugin, LLCs as organizations, route protection.
2. **Core domain** — properties, units, tenants, leases (org-scoped from the
   first migration).
3. **Rent & payments** — ledgers, Stripe integration (`src/services/stripe`).
4. **Documents** — Cloudflare R2 (`src/services/storage`).
5. **Hardening** — Vitest + Playwright, GitHub Actions CI, error monitoring.
