# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something seems sideways, STOP — re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review at session start for relevant patterns

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## IMPORTANT: Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## IMPORTANT: Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## IMPORTANT: Project rules (carried over from the e-commerce project)

- **Phase by phase.** The build follows `BUILD_PLAN.md` and `architect/phase-NN-*.md`. Never pull code from a later phase in to make the current one compile — leave a `// Phase NN (topic): …` comment where the later code goes. Check which phase is current in `tasks/todo.md` before writing code.
- **Copy verbatim means verbatim.** `copy.md` lists every file taken from `~/Code/e-commerce`, its destination, its phase and the exact lines that change. Copy unchanged first, get it compiling, then adapt only what `copy.md` lists. Keep file names and exported function names identical — no renames for style.
- **The database enforces invariants.** Uniqueness, foreign keys and "only one winner" updates are constraints or single conditional statements. Never "read, check in JS, then write". Map Postgres errors to HTTP: `23505` → 409 (`withDuplicateGuard`), `23503` → 409/404 (`isForeignKeyError`), malformed uuid → 400 (`isUuid`) — all in `apps/server/src/utils/db/pgErrors.ts`.
- **Every query is scoped by `workspaceId`.** It comes from `req.workspaceId` (agents), the visitor token (visitors) or `socket.data.workspaceId` (sockets) — never from a request body or query string. A valid id from another workspace is **404**, never 403.
- **Class names inline.** Write CSS/Tailwind class strings directly in `className`; never extract them into constants. Use `cn(...)` from `@/lib/utils` for conditional composition.
- **Unused backend code gets a caller, not a deletion.** If a backend capability has no UI yet, propose building the UI rather than deleting the backend code.

## IMPORTANT: The e-commerce repo is the reference — for every phase, every command

`~/Code/e-commerce` is the **reference implementation** for RelayDesk. It is the same author's
previous project, built with the same layering, conventions and infrastructure, and most of
RelayDesk's foundation is copied from it (`copy.md`). Treat it as ground truth for *how* things are
done here.

**Before every task, in every phase, for every command:**

1. **Look in e-commerce first.** Find the equivalent file or pattern there (the table below lists
   where to look per phase) and read it before writing anything. If it exists, follow its structure,
   naming, comments style and error handling — do not invent a different approach.
2. **Check `copy.md`.** If the file is listed as ✅ Verbatim or 🟡 Adapt, copy it from e-commerce
   (in that phase, not earlier) and change only the lines `copy.md` lists.
3. **Match the conventions** even for brand-new files: route → controller → service, `catchError`
   wrappers, `appAssert` with an http status and message, `ok(...)` envelope, Zod schemas in
   `@repo/types`, one TanStack Query hook per operation, utility folders re-exported via `index.ts`,
   the same comment style (explain *why*, in full sentences, above the code it explains).
4. **Read e-commerce, never write to it.** RelayDesk work must not modify any file under
   `~/Code/e-commerce`.
5. **If RelayDesk needs something e-commerce doesn't have** (Socket.IO, the widget, tests), say so,
   follow the phase file in `architect/`, and still apply the conventions from step 3.
6. **When e-commerce and this file disagree, this file wins** — only for the deliberate differences
   listed below.

**Deliberate differences from e-commerce (do not "fix" these back):**

| e-commerce | RelayDesk | Why |
| --- | --- | --- |
| MongoDB / Mongoose (`apps/backends/mongo`) | PostgreSQL / Prisma 8 — follow `apps/backends/postgres` for anything touching the DB | Relational data, constraints enforce the hard rules |
| Zustand (`apps/client/src/store`) | Redux Toolkit (`apps/web/src/store`) | Author's choice for this project |
| React Router SPA (`apps/client/src/router.tsx`) | Next.js App Router with route groups | — |
| bcrypt (`utils/auth/bcrypt.ts`) | argon2 (`utils/auth/password.ts`, same exports) | Product spec |
| Resend (`utils/email/send-mail.ts`) | Gmail API with an OAuth2 refresh token (`utils/email/sendMail.ts`, same `sendMail` contract) | No domain to verify; Resend's sandbox only reaches the account owner. Setup: `docs/EMAIL.md` |
| Users + storefront | Workspaces (multi-tenant) + members + visitors | Every query scoped by `workspaceId` |
| Visitor cookie (`middleware/visitorId.ts`) | Visitor JWT in the iframe's `localStorage` | Third-party cookies are blocked in iframes |
| No automated tests | Jest + Supertest + Playwright + Artillery | Product spec |

**Where to look in e-commerce, phase by phase.** Abbreviations: `E` = `~/Code/e-commerce`,
`M` = `E/apps/backends/mongo/src`, `P` = `E/apps/backends/postgres` (`P/src/...` for code),
`C` = `E/apps/client/src`, `T` = `E/packages/types/src`.

| Phase | Read these in e-commerce first |
| --- | --- |
| 00 Setup | `E/{turbo.json,pnpm-workspace.yaml,package.json,.npmrc,.gitignore,docker-compose.yml,CLAUDE.md,.mcp.json,skills-lock.json}`, `E/.agents/skills/`, `E/.claude/skills/`, `E/packages/{typescript-config,eslint-config,ui,types}`, `M/index.ts`, `M/utils/{errors,api}/`, `P/src/middleware/{errorHandler,notFound}.ts` |
| 01 Database | `P/{prisma.config.ts,prisma-8.md,README.md,migrations/}`, `P/src/prisma/{contract.prisma,db.ts}`, `P/src/scripts/write-migration-sql.ts`, `M/models/{user,session,verificationLink}.model.ts` (fields only) |
| 02 Auth | `P/src/services/auth.service.ts`, `P/src/middleware/{authenticate,requireAdmin}.ts`, `P/src/utils/auth/*`, `P/src/controllers/{auth,session}.controller.ts`, `P/src/routes/{auth,session}.route.ts`, `P/src/types/{auth.types,express.d}.ts`, `M/constants/env.ts`, `C/lib/{api,queryClient,utils}.ts`, `C/store/auth.store.ts` (shape only — rewrite as a Redux slice), `C/components/auth/*`, `C/api/auth.ts`, `C/hooks/auth/*`, `T/{user,cookie}.ts` |
| 03 Redis | `M/config/{redis,rateLimiter}.ts`, `M/utils/rateLimiter/*`, `M/middleware/{rateLimiter,authenticate}.ts` (session cache), `M/constants/rateLimiter.constant.ts`, `M/utils/cache/*`, `E/docker-compose.yml`, `E/architecture_images/redis_ratelimiter_*.png` |
| 04 Jobs & email | `M/jobs/**`, `M/worker.ts`, `M/constants/queue.ts`, `M/utils/email/*`, the `import "./worker"` line in `M/index.ts` |
| 05 Team | `P/src/services/auth.service.ts` (`revokeSessions`, the atomic find-and-consume in `verifyEmail` / `resetPassword`), `P/src/utils/auth/verificationToken.ts`, `P/src/services/catalog.service.ts` (`withDuplicateGuard`), `C/components/admin/` + `C/pages/admin/` (table + dialog screens), `C/components/admin/AdminPager.tsx` |
| 06 Conversations | `P/src/services/product.service.ts` (`listProductsService`: parameterised SQL, paging, `meta.hasMore`; transactions), `P/src/services/catalog.service.ts` (Postgres error guards, `isUuid`), `M/services/checkout.service.ts` (`fulfillPaidOrder`: idempotent transaction that re-reads state), `T/product.ts` (`paginationQuerySchema`), the storefront's `useInfiniteQuery` usage in `C/` |
| 07 Real time | No Socket.IO in e-commerce. Reuse: `M/middleware/authenticate.ts` (handshake = same checks), `M/utils/rateLimiter/redisStore.ts` (call the store directly), `M/utils/cache` (session cache), `M/jobs/redis/connection.ts` (Redis connection config), `C/lib/api.ts` (queue-and-replay idea → the client outbox) |
| 08 Widget | `M/middleware/visitorId.ts` (anonymous identity; the `SameSite` comments explain why cookies fail cross-site), `M/utils/rateLimiter/ipExtractor.ts`, `C/App.css` (`@layer components` styling convention) |
| 09 Inbox | `P/src/services/{catalog,product}.service.ts` (conditional updates, transactions, `withReferenceGuard`), `C/components/admin/` (tables, dialogs, pagers), `C/lib/queryClient.ts` + mutation hooks (cache seeding / invalidation), `M/jobs/producers/email.producer.ts` |
| 10 Admin & dashboard | `M/services/{dashboard,setting}.service.ts`, `M/controllers/{dashboard,setting}.controller.ts`, `M/routes/{dashboard,setting}.route.ts`, `C/pages/admin/{AdminDashboard,AdminSettings}.tsx`, `C/components/admin/dashboard/`, `C/components/layout/RoleGuardLayout.tsx`, `M/services/product.service.ts` (`invalidateProductDetails` — per-entity cache invalidation) |
| 11 Demo | `M/jobs/**` (repeatable job setup), `M/utils/cache` (counters), the homepage and loading/"waking up the server" patterns in `C/pages/` |
| 12 Testing | No tests in e-commerce — follow `architect/phase-12-testing.md`; reuse its seed/fixture ideas from `P/src/scripts/` |
| 13 Ship | `M/index.ts` (env-gated `/debug-ip`, `trust proxy`), `E/apps/backends/mongo/.env.example` (`TRUSTED_PROXY_CIDRS` guidance for Render), `E/architecture_images/` (diagram style for the README), `E/README.md`; lesson: commit `pnpm-lock.yaml` with every `package.json` change |

## Project status

**Phases 00–12 built, reviewed and fixed (00–05 on 2026-10-04, 06–12 on 2026-10-05); phase 13 is built and verified locally; deploying needs the owner (`docs/SHIP.md`).** Open items that need the owner are in `KNOWN_ISSUES.md`. The monorepo skeleton exists: `apps/{server,web,widget,test-site,e2e}` and `packages/{types,ui,typescript-config,eslint-config}`, every package installed, Docker Compose, skills and MCP servers. The server has the phase-00 foundation (`/health` with a DB check, envelope, errors, `notFound`/`errorHandler`) and the phase-01 database: the full Prisma 8 contract (9 tables) migrated to Neon, plus `seed.ts` (two sample workspaces). Every reference column is a tenant-consistent foreign key (`(parentId, workspaceId)`), member references are deferred to commit, and `pnpm --filter server db:check` proves the rules in a rolled-back transaction. The web app has the design tokens from `docs/DESIGN_SYSTEM.md`. The folders below that don't exist yet arrive in their phases. Treat a missing folder's description here as the target, and check `tasks/todo.md` for the current phase.

Database: development uses **Neon** directly (`DATABASE_URL` in `apps/server/.env`); the docker `postgres` service is commented out. Connections need the IPv4 pin from the copied `config/db.ts` / `prisma.config.ts` (see `tasks/todo.md`).

Pinned on purpose: TypeScript `5.9.2` everywhere (typescript-eslint needs `<6.1`, Prisma 8 needs `>=5.9`), ESLint 9 (the shared config), React `19.3.0` via root `pnpm.overrides` (one React for web, widget and `@repo/ui`), and ioredis 5 / bullmq 5 / bull-board 8 / `@prisma/cli-engine` 0.4 — the majors the copied e-commerce code runs on.

## Documents

| File | What it is |
| --- | --- |
| `docs/PRODUCT_GUIDE.md` | The product spec — *what* to build: users, screens, the 13-step conversation, the 13 tricky situations |
| `BUILD_PLAN.md` | The engineering plan — architecture, stack, phase table, how each hard rule is guaranteed |
| `architect/phase-NN-*.md` | One file per phase: files, steps, checkpoint, pitfalls, "Done when" |
| `architect/REUSE_MAP.md` | Reuse overview across backend, web and repo scaffolding |
| `copy.md` | File-by-file list of everything copied from the e-commerce backend, with `cp` commands per phase |
| `docs/DESIGN_SYSTEM.md` | The UI decisions — colours, type, radii, components, motion, and **which UI to use in which phase** (§11). Read before building any screen |
| `docs/design-references/` | The eleven brand style references the design system was derived from — index and known errors in its `README.md` |

## Repository layout

This is a pnpm + Turborepo monorepo, laid out like `~/Code/e-commerce`:

- `apps/server` — the Express + Socket.IO backend (the RelayDesk counterpart of e-commerce's `apps/backends/mongo`). It covers auth, workspaces, team, visitors, conversations, messages, notes, saved replies, dashboard and the demo, plus the BullMQ workers. One codebase, two entrypoints: `src/index.ts` (HTTP + sockets) and `src/worker.ts` (jobs).
- `apps/web` — the Next.js app (App Router). It contains **all** human-facing screens except the widget: the public homepage demo, sign-up/login/accept-invitation (`src/app/(public)`), the agent inbox and account (`src/app/(app)/inbox`, `/account`), and the admin area (`src/app/(app)/admin`). One app, route groups instead of separate apps — the same idea as e-commerce's single client holding storefront + admin.
- `apps/widget` — the embeddable widget, built with Vite into two outputs: `loader.js` (vanilla, no dependencies — the script tag a business pastes) and `frame.html` (the React chat window that runs inside an iframe).
- `apps/test-site` — a plain static "bakery" website used to prove the widget works on a site we don't control.
- `apps/e2e` — Playwright browser tests and Artillery load scenarios.
- `packages/types` (`@repo/types`) — shared Zod schemas and inferred types for **every REST body and every socket event**, used by server, web and widget.
- `packages/ui` (`@repo/ui`) — shared shadcn primitives (used by web and by the widget's live preview); `packages/typescript-config`, `packages/eslint-config` — shared bases copied from e-commerce.

## Commands

Run from the repo root (Turborepo fans these out per-package):

```bash
pnpm install          # install all workspace deps
pnpm dev              # run dev servers for all apps (turbo run dev)
pnpm build            # build all apps/packages
pnpm lint             # eslint across the workspace
pnpm typecheck        # tsc --noEmit across the workspace
pnpm test             # Jest suites (server)
pnpm test:e2e         # Playwright (apps/e2e)
pnpm format           # prettier --write on ts/tsx/md/json
docker compose up -d  # redis (queue) + redis-cache (local postgres is commented out — DATABASE_URL is Neon)
```

Scope to a single workspace with `--filter`, e.g. `pnpm --filter web dev`.

### Server (`apps/server`)

```bash
pnpm --filter server dev        # tsx watch src/index.ts (API + Socket.IO; also starts workers via `import "./worker"` in dev)
pnpm --filter server worker     # tsx watch src/worker.ts (standalone worker process)
pnpm --filter server build      # tsc
pnpm --filter server typecheck
pnpm --filter server test       # Jest + Supertest + socket.io-client against Docker Postgres/Redis
pnpm --filter server db:plan <name>   # emit contract + plan a migration
pnpm --filter server db:apply         # write migration.sql, apply, sign
pnpm --filter server db:seed          # two sample workspaces
pnpm --filter server db:check         # prove the database rejects each broken rule (rolled back)
```

`db:plan` plans from the `db` ref (`--from db`) and `db:apply` advances it (`--advance-ref db`) — the hand-written self-edge migration otherwise makes planning fail with "history contains cycles". After changing `packages/types`, it rebuilds through `pnpm dev` (`tsc --watch`); outside dev run `pnpm --filter @repo/types build`.

Migrations follow the Prisma 8 workflow copied from the e-commerce Postgres port (`apps/server/prisma-8.md`, `apps/server/README.md`): plan → `prisma migration show <name>` → apply → `prisma db verify`. **Never plan two migrations in a row without applying the first.**

Requires PostgreSQL and Redis. Postgres is Neon (`DATABASE_URL`); `docker-compose.yml` keeps a local `postgres` service commented out, and provides `redis` (`localhost:6381`, `noeviction`) for BullMQ, the rate limiter, the Socket.IO adapter and presence, and `redis-cache` (`localhost:6382`, `volatile-lru`, no persistence) for the response cache. Keep the two Redis instances separate — the cache must evict, and the queue instance must never. Copy `apps/server/.env.example` to `.env`; `src/constants/env.ts` throws at startup on any missing env var (no defaults except where explicitly given).

In development, Bull Board is mounted at `http://localhost:<PORT>/admin/queues` (disabled in production unless `ENABLE_QUEUE_DASHBOARD` with basic auth).

### Web (`apps/web`) and widget (`apps/widget`)

```bash
pnpm --filter web dev          # next dev
pnpm --filter web build
pnpm --filter widget dev       # vite (frame) — loader is built by `pnpm --filter widget build`
pnpm --filter widget build     # outputs dist/loader.js + dist/frame.html
```

Copy each app's `.env.example` to `.env` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WIDGET_ORIGIN` / `VITE_API_URL`, `VITE_FRAME_ORIGIN`).

## Backend architecture (`apps/server`)

Layering is strict, exactly as in e-commerce: **route → controller → service → ORM**. Controllers never touch the response envelope shape directly except via helpers, and never query the database (that is a service's job); services never touch `req`/`res`.

```
apps/server/src/
├── index.ts            Express app + Socket.IO attach, middleware order, health check, graceful shutdown
├── worker.ts           standalone BullMQ worker entrypoint
├── config/             db.ts, redis.ts, rateLimiter.ts (limit table)
├── constants/          env.ts, http.ts, appErrorCode.ts, queue.ts, rateLimiter.constant.ts
├── controllers/        *.controller.ts — parse, call one service, respond
├── routes/             *.route.ts — URL + verb + middleware → controller
├── services/           *.service.ts — business logic + Prisma queries
├── middleware/         authenticate, authenticateVisitor, requireRole, rateLimiter, errorHandler, notFound
├── realtime/           socket server, handshake auth, rooms, handlers/ (message, typing, presence, seen, sync)
├── jobs/               redis/connection, queues/, producers/, processors/, workers/, interfaces/, dashboard/bull-board
├── prisma/             contract.prisma, contract.json/.d.ts (emitted), db.ts
├── data/               sampleBakery.ts (the sample conversations every demo workspace starts with)
├── scripts/            write-migration-sql.ts, seed.ts
├── types/              express.d.ts, socket.d.ts, auth.types.ts, rateLimiter.types.ts
└── utils/              errors/, api/, auth/, cache/, email/, rateLimiter/, date/, db/ — each re-exports through index.ts
```

- **Routes** (`src/routes/*.route.ts`) wire URL + HTTP verb + middleware to a controller. Routers are mounted in `src/index.ts`; each route file owns its own path prefixes (`/auth`, `/session`, `/team`, `/widget`, `/conversations`, `/saved-replies`, `/workspace`, `/dashboard`, `/demo`).
- **Controllers** (`src/controllers/*.controller.ts`) are always wrapped in `catchError(...)` (`src/utils/errors/catchError.ts`), which forwards thrown errors to `next(error)`. A controller validates `req.body`/`req.params`/`req.query` with a Zod schema from `@repo/types`, calls one service, and returns via `ok(...)`.
- **Services** (`src/services/*.service.ts`) hold business logic and Prisma 8 queries (`orm.<Model>` from `src/prisma/db.ts`; raw SQL through the shared `pool` only when the ORM can't express it — always with `$1` parameters, never string-built values). They fail fast with `appAssert(condition, httpStatusCode, message, appErrorCode?)`.
- **ORM** (`src/prisma/`): Prisma 8 — `contract.prisma` is the schema; `db.ts` exports `pool`, `db` (with `db.transaction(async (tx) => …)`) and `orm = db.orm.public`. Conventions copied from the e-commerce port: `Uuid` ids, `TimestamptzString` timestamps, enums with `@@type("pg/text@1")`, expression indexes such as `lower(name)` for case-insensitive uniqueness. Postgres doesn't update `updatedAt` on its own — set it in every update.
- **Response envelope**: every JSON response follows `ApiEnvelope<T>` from `src/utils/api/apiEnvelope.ts` — `{ status: 'success'|'error', data, meta?, errors? }`. Use `ok(data, meta?)` / `fail(message, code)`.
- **Errors**: `errorHandler` (mounted last) handles `ZodError` (→ 400 with field errors), `AppError` (→ its own status), and everything else (→ 500). It clears auth cookies when an error occurs on the refresh-token path.
- **Multi-tenancy**: every table has `workspaceId`, and every query scopes by it (see Project rules). Ids from the URL are always combined with the workspace: `where({ id, workspaceId })`.
- **Auth (team)**: JWT access + refresh tokens as httpOnly cookies (`src/utils/auth/cookies.ts`, `jwt.ts`), refresh cookie scoped to `Path=/auth/refresh`, `Secure` + `SameSite=None` in production. Sessions live in Postgres and are looked up by the `sessionId` in the token; refresh rotates the token with reuse detection and a 30 s grace window (`refreshUserAccessToken`). `authenticate` checks the live session (cached 60 s) and populates `req.memberId`, `req.workspaceId`, `req.role`, `req.sessionId` (typed in `src/types/express.d.ts`). Passwords use argon2 (`src/utils/auth/password.ts`, same exports as e-commerce's `bcrypt.ts`).
- **Email verification**: `signUpService` creates the admin with `emailVerified: false` and returns no session; the link is a row in `emailVerification` (SHA-256 token hash, 24 h, one per member), mailed by the `send_verification` job and redeemed by `POST /auth/verify-email` (one transaction: delete the row, set `emailVerified`, open a session). `loginUser` answers `403 EMAIL_NOT_VERIFIED` for an unverified password account. Google sign-in, accepted invitations, demo workspaces and seed members insert `emailVerified: true`.
- **Auth (visitors)**: no cookies (third-party cookies are blocked in iframes). `POST /widget/session` issues a visitor JWT (own secret, `aud: "visitor"`, payload `{ visitorId, workspaceId }`) that the widget keeps in its own `localStorage` and sends as `Authorization: Bearer`. `authenticateVisitor` sets `req.visitorId` and `req.workspaceId`.
- **Session revocation** must go through `revokeSessions` in `auth.service.ts`, never a direct session delete — `authenticate` caches active sessions for 60 s and `revokeSessions` clears that cache. Removing an agent also disconnects their sockets (`io.in("member:<id>").disconnectSockets()`).
- **Messages — ordering and idempotency**: every message is written by `sendMessage` (`message.service.ts`) in one transaction: idempotency check on `(conversationId, clientMessageId)`, then `UPDATE conversation SET "lastSeq" = "lastSeq" + 1 … RETURNING` (row lock → gap-free order), then insert with that `seq`. Never order by `createdAt`. Internal notes live in their own `note` table and are never read by a visitor route or emitted to a visitor room.
- **Assignment**: one conditional update — `where({ id, workspaceId, status: "unassigned" }).update(...)`; `null` means someone else won → 409 with their name.
- **Real time** (`src/realtime/`): Socket.IO with `@socket.io/redis-adapter` on the queue Redis. Postgres decides, sockets deliver: emit only after the transaction commits. Every incoming event is validated with a schema from `@repo/types/socket` and scoped by `socket.data.workspaceId`. Rooms: `ws:<workspaceId>` (agents), `conv:<conversationId>`, `visitor:<visitorId>` (all of a visitor's tabs), `member:<memberId>`. Reconnecting clients send `sync` with their last `seq` per conversation and get everything newer from Postgres. Presence and typing live in Redis only; presence never changes assignment.
- **Background jobs**: BullMQ queues/producers/processors/workers under `src/jobs/`, one subfolder per concern, plus `redis/connection.ts` and `dashboard/bull-board.ts` — the e-commerce structure. Queues: `email` (`send_invitation`, `send_offline_reply`) and `maintenance` (`sweep_expired`, `delete_demo_workspaces`, both repeatable). Producers are called from services **after** the database write commits; processors re-read state from Postgres. Workers run in the API process in dev (`index.ts` does `import "./worker"`) and as a separate Render worker in production.
- **Caching**: `src/utils/cache` (`cache.getOrSet`, `cache.versionedKey`, `cache.bump`) — cache-aside that never throws (Redis failures read as misses, behind the shared circuit breaker). Per-entity keys for things that can be enumerated (`cache:widget:<publicKey>` — invalidate on widget-settings update; `cache:saved-replies:<workspaceId>`), versioned keys with short TTLs for the rest (dashboard numbers, 30 s). A cached fetcher that throws caches nothing, so "not found" is never remembered.
- **Rate limiting**: the copied Redis limiter with in-memory fallback and circuit breaker under `src/utils/rateLimiter/` (`redisStore.ts`, `memoryStore.ts`, `circuitBreaker.ts`, `luaScript.ts`, `ipExtractor.ts`), wired in as `src/middleware/rateLimiter.ts`; the limit table lives in `src/config/rateLimiter.ts`. The socket `message:send` handler calls the store directly. Client IPs come from `extractClientIp` (trusts `CF-Connecting-IP` only from `TRUSTED_PROXY_CIDRS` — `127.0.0.1/32` on Render).
- **Pagination**: list endpoints return rows in `data` and `{ page, limit, total, hasMore }` in `meta` (`paginationQuerySchema` in `@repo/types`, max 100). The inbox lists use it with `useInfiniteQuery`.
- Utility folders (`src/utils/auth`, `src/utils/email`, `src/utils/errors`, `src/utils/api`, `src/utils/date`, `src/utils/rateLimiter`, `src/utils/cache`, `src/utils/db`) each re-export through an `index.ts` — import from the folder, not the individual file, when both exist.

## Web architecture (`apps/web`)

The same client conventions as e-commerce's `apps/client`, on Next.js:

- **Routing** (`src/app/`): App Router with route groups — `(public)` for `/`, `/login`, `/signup`, `/invite/[token]`; `(app)` for `/inbox`, `/account`, `/admin/*`. Auth gating is composed in layouts, not per page: the `(app)` layout renders `AuthLoader` (resolves `GET /auth/me` before children render) and redirects to `/login` when there is no session; the `admin` layout redirects non-admins to `/inbox` (the e-commerce `RoleGuardLayout` pattern). **Auth is client-side**: the API's cookies belong to the API's domain, so Next middleware and server components cannot read them.
- **State**: Redux Toolkit in `src/store/` — `store.ts` (`makeStore()` + `RootState` / `AppDispatch` types), `hooks.ts` (typed `useAppDispatch` / `useAppSelector`; never use the untyped `useDispatch` / `useSelector`), and one slice per concern under `src/store/slices/` (`authSlice.ts` — the logged-in member, workspace and `isBootstrapped`, actions `setUser` / `clearAuth`; later UI-only slices such as `inboxUiSlice.ts` for the selected list and open conversation). The store is created once per browser tab inside `src/app/StoreProvider.tsx` (a `"use client"` component holding it in a `useRef`), rendered in the root layout above the TanStack `QueryClientProvider`. Server data is not duplicated into Redux — that's TanStack Query's job.
- **Server data**: TanStack Query. One hook per operation under `src/hooks/<domain>/useXxx.ts` (e.g. `useLogin`, `useAssignConversation`), each wrapping a `useQuery`/`useMutation` around a function from `src/api/<domain>.ts`. Mutation hooks handle their own side effects (Redux dispatches, cache seeding/invalidation via `src/lib/queryClient.ts`, navigation).
- **Real time**: one socket per tab from `src/lib/socket.ts` (`withCredentials: true`). Socket events patch the TanStack Query cache with `queryClient.setQueryData` instead of refetching; hooks live in `src/hooks/realtime/`.
- **HTTP client** (`src/lib/api.ts`, copied from e-commerce): one Axios instance with `withCredentials: true` and the silent refresh on 401 — one `/auth/refresh` in flight, concurrent failures queued and replayed, `clearAuth()` dispatched to the Redux store on refresh failure, `AUTH_ROUTES` exempt. Errors are normalised to `{ status, message, code, errors }` — read `error.message` / `error.code`, not the raw Axios error.
- **Path alias**: `@/*` maps to `src/*`, used instead of `../` imports (a `./sibling` import is fine).
- **Shared types/validation**: import Zod schemas and inferred types from `@repo/types` for anything that must match the server's validation (forms use react-hook-form + `zodResolver` with the shared schema).
- **Design system**: every screen follows `docs/DESIGN_SYSTEM.md` ("ink and signal"): tokens live in `src/app/globals.css` — use the semantic utilities (`bg-signal-soft`, `bg-note`, `text-status-mine`, `shadow-float`, `animate-arrival`, …), never ad-hoc hex values; signal blue only for live states; one primary (ink) button per view; sentence case, no all-caps labels; honour `prefers-reduced-motion`. Each phase file's *UI* section says which parts apply.
- **UI primitives**: shadcn-style components (Radix + `class-variance-authority` + `tailwind-merge`) from `@repo/ui`; compose them rather than styling raw elements for controls, dialogs, dropdowns, etc. Class strings go inline in `className` (Project rules).

## Widget architecture (`apps/widget`)

- **`src/loader/`** → `dist/loader.js`: vanilla TypeScript, no dependencies, IIFE build. Reads `data-key` from its own script tag, waits for `window.load`, inserts one fixed-position iframe, resizes it on `postMessage` requests, and forwards the host page URL/title (including SPA navigations). Everything is wrapped in `try/catch` — it must never throw into the host page.
- **`src/frame/`** → `dist/frame.html`: the React chat window (bubble, header, greeting, messages, marks, typing, text box, name/email prompt, offline form). Starts with `POST /widget/session`, keeps the visitor token and the unsent-message outbox in `localStorage`, connects the socket with `auth: { token }`, runs `sync` on every (re)connect.
- **postMessage protocol**: messages are namespaced `rd:*` (`rd:resize`, `rd:context`, `rd:unread`); both sides check `event.origin` and never post data to `"*"`.
- **Theming**: the workspace colour becomes the CSS variable `--rd-brand`; the admin live preview renders the same components with draft settings.

## Shared packages

- **`@repo/types`** (`packages/types/src/`): one file per domain — `auth`, `team`, `widget`, `conversation`, `message`, `note`, `socket`, `savedReply`, `workspace`, `pagination`, `color`, `cookie`. `socket.ts` holds a schema for every client→server and server→client event; the server validates incoming events with it, and the clients type their handlers from it.
- **`@repo/ui`**: shadcn primitives + `cn()`. Next.js needs `transpilePackages: ["@repo/ui", "@repo/types"]`.
