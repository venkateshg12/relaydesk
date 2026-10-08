# RelayDesk — Live Chat Helpdesk

A multi-tenant live-chat helpdesk, end to end: a chat widget that a business adds to its website with one `<script>` tag, a real-time shared inbox for its support team, an admin area, and an Express + Socket.IO API on PostgreSQL with Redis caching, Redis-backed rate limiting, BullMQ background jobs and email through the Gmail API.

It is a pnpm + Turborepo TypeScript monorepo: a Next.js app that holds the demo homepage, sign-in, the agent inbox and the admin area; a Vite widget (a ~2 kB loader plus a React chat window that runs in an iframe); a Node API; and a shared Zod schema package that all of them validate against. The interesting parts are the ones that are easy to get wrong in a chat product: one message order for everyone, exactly-once delivery across dropped connections, two agents grabbing the same chat, one business seeing another's data, and a widget that must never break the site it is embedded in.

> **Try it.** The homepage (`/`) *is* the product: type in the widget on the left, answer in the inbox on the right, inside a private demo workspace that deletes itself after 24 hours. No sign-up.

> **What runs where?** Three processes: `apps/server` (API + WebSockets, port 4000), `apps/web` (Next.js, port 3000) and `apps/widget` (loader + chat frame, port 5173). `pnpm dev` starts all three.

## ✨ Highlights

- **One order for everyone, enforced by the database.** Each message gets a gap-free per-conversation sequence number from `UPDATE conversation SET "lastSeq" = "lastSeq" + 1 … RETURNING` inside the insert transaction; clients sort by `seq`, never by time — [details](#-key-flows)
- **Exactly-once delivery.** The client invents a `clientMessageId`; a unique index on `(conversationId, clientMessageId)` makes retries, replays and double clicks return the first message. After a reconnect the client asks `sync` for everything newer than its last `seq`, then replays an outbox kept in `localStorage` — [details](#-key-flows)
- **Atomic assignment.** "Assign to me" is one conditional `UPDATE … WHERE status = 'unassigned'`: the first click wins, the second gets a `409` naming the winner — [details](#-key-flows)
- **Tenant isolation by constraint, not convention.** Every table carries `workspaceId` and every foreign key is `(parentId, workspaceId)`, so a row physically cannot point into another business; another business's id is a `404`, never a `403` — [details](#-database)
- **Real time on WebSockets** with the Socket.IO Redis adapter, so any number of API instances deliver to every client; presence and typing live in Redis only, and events are emitted only after the transaction commits — [details](#-real-time)
- **Access/refresh JWT sessions in httpOnly cookies** for the team, with single-use refresh rotation, reuse detection and a server-side session checked on every request; anonymous visitors get their own signed token because cookies don't work inside third-party iframes — [details](#-authentication--authorization)
- **Custom Redis rate limiter**: sliding-window log executed atomically in Lua, punitive lockout and dual-bucket variants, a circuit breaker, and an in-memory fallback when Redis is down — [details](#-rate-limiting)
- **Cache-aside layer** on a separate evicting Redis instance with version-stamped keys — [details](#-redis--caching)
- **BullMQ workers** for email and maintenance, with retries, backoff, idempotent processors that re-read Postgres, and a basic-auth-protected Bull Board — [details](#-background-jobs--queues)
- **Email through the Gmail API** (OAuth2 refresh token, no domain needed) with one shared HTML layout, a dark-mode variant and header-injection-safe MIME building — [details](#-email-gmail-api)
- **A widget that cannot hurt the host site.** A dependency-free ~1.9 kB loader waits for `window.load`, wraps everything in `try/catch` and puts the UI in an iframe on its own origin; the `postMessage` protocol is pinned to origins in both directions — [details](#-the-widget)
- **One validation source**: Zod schemas in `packages/types` cover every REST body and every socket event, and are used by the API, the web app and the widget
- **Tests for the hard parts**: 47 server tests (19 of them drive real HTTP and real sockets against real Postgres and Redis), 10 Playwright browser tests, a load script, and CI — [details](#-testing)

## 🖼️ Screens

| The widget on a customer's site | The shared inbox | Widget settings (admin) |
|---|---|---|
| ![The chat widget](apps/web/public/home/seat-widget.png) | ![The agent inbox](apps/web/public/home/seat-inbox.png) | ![The admin widget settings](apps/web/public/home/seat-admin.png) |

## 🏗️ Architecture

```mermaid
flowchart LR
    Host["Any website<br/>loader.js · ~1.9 kB"] -->|iframe| Frame["Widget frame<br/>React, own origin"]
    Frame <-->|WebSocket + REST| API
    Inbox["Agent inbox + admin<br/>Next.js"] <-->|WebSocket + REST| API
    subgraph API["API instances: Express 5 + Socket.IO"]
        A1["instance 1"]
        A2["instance N"]
    end
    API --> PG[("PostgreSQL<br/>every row has workspaceId")]
    API <--> Queue[("Redis · queue<br/>adapter, presence, rate limits<br/>noeviction")]
    API <--> Cache[("Redis · cache<br/>volatile-lru")]
    Queue --> Worker["BullMQ workers<br/>email · maintenance"]
    Worker --> PG
    Worker --> Gmail["Gmail API"]
```

The backend is strictly layered: **route → controller → service → ORM**.

- **Routes** attach URL, verb and middleware to a controller.
- **Controllers** are wrapped in `catchError`, validate input with a Zod schema from `@repo/types`, call exactly one service and respond through `ok(...)`. They never query the database.
- **Services** hold the business logic and the Prisma 8 queries (raw parameterised SQL through the shared `pool` only where the ORM can't express something) and fail fast with `appAssert(condition, status, message)`. They never touch `req` or `res`.
- **One error handler**, mounted last, turns `ZodError` into a 400 with field errors, `AppError` into its own status, and anything else into a logged 500.
- **Socket handlers** (`realtime/handlers/`) follow the same rule: validate the incoming event with its Zod schema, scope everything by `socket.data.workspaceId`, call a service, acknowledge.

Every JSON response uses one envelope, `{ status, data, meta?, errors? }`, built by `ok()` / `fail()`.

**Process model.** The API and the workers are one codebase with two entry points: `src/index.ts` (HTTP + sockets) and `src/worker.ts` (BullMQ). In development `index.ts` imports the worker, so one `pnpm --filter server dev` does both. In production run `worker` as its own process, or set `RUN_WORKERS_IN_API=true` to let the API register and run the jobs itself, which is what a single free web service needs. Shutdown is ordered so nothing is lost: stop accepting connections, close the socket server, let in-flight requests finish, close the workers, close the cache connection, with a 10-second forced exit. `GET /health` reports Postgres and Redis separately and answers `503` only when Postgres is down (Redis is reported, not fatal).

## 🔄 Key Flows

### One conversation

```mermaid
sequenceDiagram
    participant V as Visitor (widget)
    participant A as API
    participant P as PostgreSQL
    participant I as Agent inbox
    V->>A: POST /widget/session (public key) → visitor token
    V->>A: socket message:send (clientMessageId, body)
    A->>P: one transaction: lock conversation row, seq + 1, insert message
    A-->>V: ack (message with seq)
    A-->>I: message:new to the workspace room (after commit)
    I->>A: POST assign to me
    A->>P: UPDATE … WHERE status = 'unassigned' RETURNING
    A-->>I: conversation:assigned (and to every other agent)
    I->>A: typing / reply
    A-->>V: typing, message:new
    I->>A: resolve
    V->>A: writes again next week
    A->>P: same conversation reopens, back to the agent who had it
```

### Sending a message: order and exactly-once

Every message is written by `sendMessage` (`message.service.ts`) in **one transaction**:

1. Look up `(conversationId, clientMessageId)`. If it exists, return that message (a retry, a replay or a double click).
2. `UPDATE conversation SET "lastSeq" = "lastSeq" + 1 … RETURNING` takes the conversation's row lock, so concurrent senders queue up and the numbers are gap-free.
3. Insert the message with that `seq`. The unique index on `(conversationId, seq)` is the backstop.
4. Commit, **then** emit. Postgres decides, sockets deliver.

Never order by `createdAt`: two messages can share a timestamp, and clocks disagree. Internal notes live in their own `note` table and are never read by a visitor route or emitted to a visitor room.

### Dropped connection: nothing lost, nothing twice

- A message typed while offline is stored in an **outbox** (`localStorage` in the widget, memory in the inbox) with its `clientMessageId` and shown as "sending".
- On every (re)connect the client rejoins its rooms and sends `sync` with its last `seq` per conversation; the server returns everything newer from Postgres, paged until `hasMore` is false.
- Only after `sync` finishes is the outbox replayed. Because the id is the same, a message that did arrive before the drop is not duplicated.

### Two agents click "Assign to me"

```sql
UPDATE conversation SET "assigneeId" = $1, "lastAssigneeId" = $1, status = 'assigned'
 WHERE id = $2 AND "workspaceId" = $3 AND status = 'unassigned'
RETURNING …
```

One row matches, so one agent wins. The other statement matches nothing and the service answers `409 "Already taken by <name>"`. Resolve, reopen, hand-over and unassign are guarded the same way. `lastAssigneeId` remembers who had a chat, so a visitor writing again after it was resolved reopens it to the same agent (or to whoever reopens it, if that agent has left the team).

### A reply when the visitor has left

When an agent replies and the visitor is not connected, the visitor gave an email, and the workspace is not a demo, the API queues an offline-reply job. See [Background Jobs](#-background-jobs--queues).

## 🧩 The Thirteen Tricky Situations

The product spec lists thirteen situations that separate a real chat product from a classroom one. Each is a mechanism in Postgres or Redis, and each has a test.

| Situation | Mechanism | Test |
|---|---|---|
| Two messages at the same instant | `lastSeq + 1 … RETURNING` under the row lock | 50 concurrent sends from 5 sockets arrive as `seq 1…50` on every client |
| Internet drops for a minute | `sync` from the last `seq`, then outbox replay | a reconnecting client syncs what it missed; a queued send arrives once |
| Send pressed twice | unique `(conversationId, clientMessageId)` | socket and REST with one id give one row and the same message |
| Site open in two tabs | one `visitor:<id>` room per visitor | both sockets get every message and typing event |
| Two agents assign at once | conditional `UPDATE … RETURNING` | one `200`, one `409` naming the winner |
| Agent closes the inbox mid-chat | presence is separate from assignment | goes offline, stays assigned, a colleague can take it |
| Visitor writes after resolve | `lastAssigneeId` | the same conversation reopens to the same agent |
| No agent online | presence hash + offline-reply job | the widget is told, the reply is queued as an email |
| Internal note | separate `note` table | agents see it; the visitor's socket and `/widget/messages` never do |
| Another business's data | composite FKs, `workspaceId` on every query | `404` on every route; sockets can't join or sync it |
| Agent removed | `revokeSessions` + socket disconnect | next REST call `401`, socket dropped, chats back to Unassigned |
| Someone floods the widget | per-visitor limiter, 20 messages a minute | rejected with `RATE_LIMITED` |
| The host site is slow or busy | loader waits for `window.load`, iframe isolation | Playwright host-site specs |

## 🔐 Authentication & Authorization

**Team (admins and agents):**

| Token | Lifetime | Cookie path | Secret |
|---|---|---|---|
| Access JWT (`aud: access`) | 15 min | `/` | `JWT_SECRET` |
| Refresh JWT (`aud: refresh`) | 30 days | `/auth/refresh` only | `JWT_REFRESH_SECRET` |

Both cookies are `httpOnly`; in production they are `Secure` + `SameSite=None` (the web app and the API are on different sites). The algorithm is pinned to HS256 on sign and verify, and each token type has its own audience and secret, so one cannot be accepted as the other. The server refuses to boot if any of the three secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `VISITOR_TOKEN_SECRET`) is under 32 characters or if two of them are equal.

**What happens on each request** (`middleware/authenticate.ts`): verify the access token's signature and audience → confirm the session row still exists and has not expired (a Redis hit skips the Postgres lookup for 60 s) → populate `req.memberId`, `req.workspaceId`, `req.role`, `req.sessionId`. A valid signature alone is not enough, so logging out, removing an agent or revoking a device takes effect immediately instead of when the token expires.

**Refresh rotation** (`refreshUserAccessToken`): each refresh token carries a `jti`. Rotation is a conditional update on the session's current `jti`, so two concurrent refreshes cannot both rotate. A stale token is accepted only when it was replaced in the last 30 seconds (two tabs refreshing together); otherwise it is treated as replay and the session is revoked.

**Visitors.** Third-party cookies are blocked inside iframes, so a visitor gets no cookie at all. `POST /widget/session` issues a visitor JWT (its own secret, `aud: visitor`, payload `{ visitorId, workspaceId }`, 180 days) that the widget keeps in its own `localStorage` and sends as `Authorization: Bearer`. The same token authenticates the socket handshake. The same browser coming back next week is the same visitor with the same conversation.

**Authorization.** Admin routes run `authenticate` then `requireRole`. The workspace always comes from the token (`req.workspaceId`, `socket.data.workspaceId`), never from a request body or query string.

**Sessions.** Each login creates a `session` row (user agent, `refreshJti`, expiry). Members can list their sessions and revoke one. Every revocation goes through `revokeSessions`, which also clears the Redis session-cache key, and removing an agent disconnects their sockets (`io.in("member:<id>").disconnectSockets()`).

**Other auth details**
- Passwords are hashed with argon2. An unknown email still runs a verify against a throwaway hash, so response time does not reveal which emails are registered.
- Invitation tokens are stored as hashes, work once (consumed by an atomic conditional update) and expire after 2 days.
- **Google sign-in** verifies the Google ID token on the server (`google-auth-library`) and accepts only a verified email. It works for log in, for sign-up (with a business name) and for accepting an invitation. An email that already has a password account is refused with `409` rather than linked, because sign-up here does not verify email and linking would be an account-takeover path.

## ⚡ Real Time

Socket.IO with `@socket.io/redis-adapter` on the queue Redis, **WebSocket transport only** (`pingInterval` 25 s, `pingTimeout` 20 s), so nothing needs sticky sessions behind a load balancer. The handshake runs the same checks as the REST middleware.

| Room | Who is in it |
|---|---|
| `ws:<workspaceId>` | every agent of a workspace |
| `conv:<conversationId>` | whoever has that conversation open |
| `visitor:<visitorId>` | all tabs of one visitor |
| `member:<memberId>` | all tabs of one agent (so removal can disconnect them) |

- **Client → server:** `message:send` (with an acknowledgement), `message:seen`, `presence:set`, `conversation:join` / `conversation:leave`, typing, and `sync`.
- **Server → client:** `message:new`, `message:seen`, `conversation:updated`, `conversation:assigned`, `conversation:viewers`, `note:new`, `visitor:updated`, `presence:update`, `presence:snapshot`, `stats:update`, `workspace:updated`.
- **Every incoming event is validated** with a schema from `@repo/types/socket` and scoped by `socket.data.workspaceId`. The `message:send` handler calls the rate-limit store directly.
- **Presence and typing live in Redis only.** Presence is a hash per workspace (`memberId → online | away`) with a 60-second heartbeat TTL; who is looking at a conversation is kept separately. Presence never changes assignment.
- **Client state.** Socket events patch the TanStack Query cache with `setQueryData` instead of refetching. Message marks go sending → sent → seen.

## ⚡ Redis & Caching

Two Redis instances, on purpose (`docker-compose.yml`, or two hosted databases):

| Instance | Local port | Policy | Holds |
|---|---|---|---|
| `redis` (queue) | 6381 | `noeviction`, AOF on | BullMQ queues, rate-limit windows, Socket.IO adapter, presence |
| `redis-cache` | 6382 | `volatile-lru`, 256 MB, no persistence | response cache, session-active flags |

A cache has to evict to stay bounded, but evicting a queue loses jobs, so they cannot share one policy.

| Cached | Key | TTL | Invalidated by |
|---|---|---|---|
| Widget config (looked up by the public key on every widget load) | versioned `widget` + public key | 5 min | `cache.bump("widget")` when widget settings change |
| Dashboard numbers (four counts in one SQL round trip) | versioned `dashboard`, per workspace and timezone | 30 s | TTL only; "who is online" is always read fresh |
| Session is active | `cache:session:<id>` | 60 s | `revokeSessions` |

**Versioned keys** (`utils/cache`): each domain has a counter; a key embeds the counter of the domain it reads; a write increments the counter, so old keys are never read again and age out. It is O(1) however many keys exist and closes the race where a slow request writes stale data back after an invalidation.

**Failure behaviour.** The cache never throws. Redis down, slow (300 ms per command, no offline queue) or switched off (`CACHE_ENABLED=false`) all degrade to a cache miss, and the request reads Postgres. The same circuit breaker the rate limiter uses stops a hung Redis from adding its timeout to every request. A fetcher that throws caches nothing, so "not found" is never remembered. Every entry has a TTL because `volatile-lru` only evicts keys that have one.

## 🧵 Background Jobs & Queues

Email is sent outside the request: a service enqueues a job **after its database write commits**, and a worker does the slow, failure-prone part. Processors re-read Postgres rather than trusting the payload.

| Queue | Jobs | Attempts / backoff | Worker settings |
|---|---|---|---|
| `email-queue` | `send_invitation`, `send_offline_reply` | 3, exponential from 5 s | concurrency 5, limited to 2 jobs a second, 30 s lock |
| `maintenance-queue` | `sweep_expired` (every 15 min), `delete_demo_workspaces` (every 60 min) | repeatable | — |

Completed jobs are kept for an hour, failed ones for a week.

- **Invitations** use a deterministic job id (`invite-<invitationId>`). The processor skips if the invitation was revoked, accepted or has expired, and throws `UnrecoverableError` for a malformed address.
- **Offline replies are batched.** The job has one id per conversation and a 60-second delay, so replies written within a minute go out as one email; a conversation is emailed at most once every ten minutes (a Redis key remembers the last send). When the job runs it reads the unread agent replies from Postgres and skips if the visitor has read them, gave no email, or never reported a page to link back to. The link in the email is the page's origin and path only, and only for `http(s)`.
- **Demo workspaces** never send email: their sample visitors' addresses are not real.
- **Cleanup.** `sweep_expired` deletes expired sessions and invitations; `delete_demo_workspaces` deletes expired demo workspaces, and one delete removes all of a workspace's data because every child row cascades.
- **A permanent failure ends the job at once.** `MailError.isRetryable` marks a bad recipient or a revoked token as not worth retrying; quota limits and Google outages are retried with backoff.

**Monitoring.** Bull Board is mounted at `/admin/queues` in development, and in production only when `ENABLE_QUEUE_DASHBOARD=true` with credentials, behind basic auth. It stays off by default because job payloads contain invitation tokens.

## ✉️ Email (Gmail API)

Mail goes out through the **Gmail API** as one Google account, with an OAuth2 refresh token: no domain to verify and nothing to pay for. `utils/email/sendMail.ts` trades the refresh token for a one-hour access token (the client caches it), builds the message (`mime.ts`: multipart text + HTML, RFC 2047 UTF-8 headers, a header value can never contain a line break) and posts it to `users/me/messages/send`. Without credentials, development prints the email in the server log (the invitation link is in it), and production reports every send as failed rather than pretending it went out.

**The emails.** Both are built on one shared layout (`emailLayout.ts` → `renderEmail`): brand header, heading, body, one button, the link again as plain text, and a footer that says why the person got the email. It is table-based with inline styles, has a dark-mode variant and fits a phone; everything a person typed is escaped. A new email is `renderEmail({...})` plus its words.

| Email | When |
|---|---|
| Invitation | an admin invites an agent |
| Reply while away | an agent replies after the visitor left, and the visitor gave an email |

**One-time setup**
1. In Google Cloud, enable the **Gmail API** and create an OAuth client of type **Web application**. Register the redirect URI `http://localhost:<PORT>/api/auth/gmail/callback` (and your deployed one later).
2. While the app is in *Testing*, add the sending Gmail address as a **test user**.
3. Put `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI` and `EMAIL_FROM="RelayDesk <the-sending-account@gmail.com>"` in `apps/server/.env`.
4. Start the API and open `http://localhost:<PORT>/api/auth/gmail`. Choose the sending account and allow sending. The token is printed in the **server console** only, never in the browser.
5. Paste it as `GMAIL_REFRESH_TOKEN`, restart, and check with `pnpm --filter server mail:test you@example.com`.

Only the `gmail.send` permission is requested: the app can send mail but cannot read the mailbox. While the Google project is in *Testing*, refresh tokens expire after 7 days; repeat step 4. In production the authorise route is off unless `GMAIL_OAUTH_SETUP=true`. A consumer Gmail account sends about 500 emails a day, and recipients see that Gmail address as the sender.

## 🧷 The Widget

`apps/widget` builds two outputs with Vite:

- **`loader.js`** (1.94 kB, 0.92 kB gzipped): vanilla TypeScript, no dependencies, IIFE. It reads `data-key` from its own script tag, waits for `window.load`, inserts one fixed-position iframe, resizes it on request, and forwards the host page's URL and title (including single-page-app navigations). Everything is wrapped in `try/catch`: it must never throw into the host page.
- **`frame.html`**: the React chat window (bubble, header, greeting, messages, marks, typing, text box, a name/email prompt, offline form). It starts with `POST /widget/session`, keeps the visitor token and the unsent-message outbox in `localStorage`, connects the socket with `auth: { token }` and runs `sync` on every (re)connect.

The two talk through `postMessage` messages namespaced `rd:*` (`rd:resize`, `rd:context`, `rd:unread`); both sides check `event.origin` and never post data to `"*"`. Each business sets its own colour, name and greeting; the colour becomes the CSS variable `--rd-brand`, and the admin screen renders the same components as a live preview. Adding it to a site is one line:

```html
<script async src="https://<widget-origin>/loader.js" data-key="rd_pk_…"></script>
```

## 🛡️ Security

| Mechanism | Where |
|---|---|
| `helmet` headers (HSTS in production), CORS allowlist with credentials | `index.ts` |
| httpOnly cookies, `Secure` + `SameSite=None` in production, refresh cookie scoped to its own path | `utils/auth/cookies.ts` |
| Secret length / distinctness checks at boot, pinned algorithm, per-token audience | `constants/env.ts`, `utils/auth/jwt.ts` |
| Refresh rotation with reuse detection; live-session check on every request | `auth.service.ts`, `authenticate.ts` |
| argon2 + dummy-hash verify for unknown emails | `utils/auth/password.ts`, `loginUser` |
| Visitor token in the iframe's `localStorage`, own secret and audience | `utils/auth/visitorToken.ts`, `authenticateVisitor.ts` |
| `workspaceId` from the token on every query; cross-workspace ids are `404` | services, composite foreign keys |
| Internal notes in their own table, never read by a visitor route | `note.service.ts` |
| Zod validation of every body, param and socket event | controllers, socket handlers, `@repo/types` |
| Redis rate limiting on auth, invitations, widget and API routes, and on socket sends | [Rate limiting](#-rate-limiting) |
| Trusted-proxy aware client IP (`TRUSTED_PROXY_CIDRS`); a raw `X-Forwarded-For` is never trusted | `utils/rateLimiter/ipExtractor.ts` |
| Header-injection-safe MIME building; all user text escaped in email HTML | `utils/email/mime.ts`, `emailLayout.ts` |
| Offline-reply links carry only `origin + path` of an `http(s)` page | `email.processor.ts` |
| Bull Board off by default, basic auth | `index.ts` |
| `/debug-ip` exists only when `DEBUG_IP_ENDPOINT=true`; the Gmail authorise routes are off in production | `index.ts`, `gmail.route.ts` |

## 🚦 Rate Limiting

A custom limiter, not a library (`utils/rateLimiter/`, wired in by `middleware/rateLimiter.ts`, limits in `config/rateLimiter.ts`).

- **Algorithm:** sliding-window log. Each request is a member in a Redis sorted set scored by timestamp. One `EVAL` of a Lua script prunes expired members, counts, finds the oldest survivor for an exact reset time, then either rejects or records the request. It is atomic, so concurrent requests across API instances cannot both take the last slot, and there is no burst at window edges.
- **Three variants.** *Single bucket* for ordinary limits. *Punitive*: exceeding the limit sets a lock key with a TTL (used for login). *Dual bucket*: a per-browser and a per-IP bucket checked together and committed only if both pass (the global pre-auth limiter).
- **Identity.** The client IP comes from `extractClientIp`: `CF-Connecting-IP` is honoured only when the TCP peer is in `TRUSTED_PROXY_CIDRS`. Other keys are `ip:email`, `email`, the session, the workspace, the member and the visitor.
- **Login is limited on three axes** so neither spreading one account across many IPs nor walking many accounts from one IP slips through. The per-account limit is deliberately *not* punitive, so nobody can lock another person out by typing their email.
- **Fallback.** A circuit breaker (opens after 10 consecutive failures, probes again after 30 s) switches to an in-memory store (capped at 20,000 keys). While it is open, limits apply per instance instead of globally.

| Limit | Window | Key |
|---|---|---|
| Global pre-auth: 500 per browser, 2,000 per IP | 5 min | browser + IP |
| Login, then a 30-minute lock: 10 | 5 min | IP + email |
| Login per account: 15 (not punitive) / per source: 50 | 15 min | email / IP |
| Sign-up: 10 | 1 h | IP |
| Refresh: 20 per session, 300 per source | 15 min | session / IP |
| Invitations: 30 | 1 h | workspace |
| Widget session: 30 | 5 min | IP |
| Widget messages: 20 (HTTP and socket) | 1 min | visitor |
| Authenticated API: 300 | 5 min | member |
| Demo session: 10 (`DEMO_SESSIONS_PER_HOUR`) | 1 h | IP |

Responses carry `X-RateLimit-*` and `Retry-After`; a socket send over the limit is acknowledged with `RATE_LIMITED` and a `retryAfter`.

## 🗄️ Database

PostgreSQL (Neon) through **Prisma 8** (release candidate): a `contract.prisma`, planned and applied migrations, and `db sign`. The rules live in the database:

| Table | Notes |
|---|---|
| `workspace` | the business; unique `publicKey` (the widget key); widget settings; demo flag and expiry |
| `member` | admins and agents; unique `lower(email)`; password hash or Google id; status `active` / `removed` |
| `session` | refresh `jti`, user agent, expiry |
| `invitation` | hashed token, expiry; one pending invitation per workspace + `lower(email)` |
| `visitor` | anonymous visitor; per-workspace display number ("Visitor 1042"); optional name, email, last page |
| `conversation` | exactly one per visitor; status, assignee, last assignee, `lastSeq`, read marks |
| `message` | `seq` and `clientMessageId` per conversation; sender type |
| `note` | internal notes, never sent to visitors |
| `saved_reply` | shared answers; unique `lower(shortcut)` per workspace |

**Constraints worth noting**
- **Tenant-consistent foreign keys.** Every parent has `UNIQUE (id, workspaceId)` and every child references `(parentId, workspaceId)`, so a conversation cannot point at another workspace's visitor even by mistake. Member references are deferred to commit.
- **Ordering and idempotency.** `UNIQUE (conversationId, seq)` and `UNIQUE (conversationId, clientMessageId)` on `message`; the first backs gap-free ordering, the second makes retries safe.
- **Case-insensitive uniqueness** through expression indexes on `lower(email)` and `lower(shortcut)`.
- **The inbox query is index-backed**: `(workspaceId, status, lastMessageAt DESC)` plus `(workspaceId, assigneeId, status)`.
- **Cascades.** Deleting a workspace removes everything under it, which is how expired demo workspaces are cleaned up in one statement.
- `pnpm --filter server db:check` proves the database rejects each broken rule, inside a transaction that is rolled back.

**Conversation status** is a small state machine: `unassigned → assigned → resolved`, back to `assigned` when the visitor writes again, and back to `unassigned` when an agent hands it back or is removed.

## 📁 Project Structure

```
.
├── apps/
│   ├── server/                    Express 5 + Socket.IO API and BullMQ workers
│   │   └── src/
│   │       ├── routes/ controllers/ services/
│   │       ├── middleware/        authenticate, authenticateVisitor, requireRole, rateLimiter, errorHandler
│   │       ├── realtime/          socket server, handshake auth, rooms, presence, handlers/ (message, typing, seen, sync, …)
│   │       ├── jobs/              queues, producers, processors, workers, Bull Board
│   │       ├── prisma/            contract.prisma, emitted contract, db.ts
│   │       ├── utils/             auth, cache, rateLimiter, email, errors, api, date, db
│   │       ├── config/ constants/ types/ data/ scripts/ __tests__/
│   │       └── index.ts, worker.ts
│   ├── web/                       Next.js 16 (App Router)
│   │   └── src/
│   │       ├── app/               (public): /, /login, /signup, /invite/[token]   (app): /inbox, /account, /admin/*
│   │       ├── components/        inbox, admin, auth, demo, home, realtime, ui
│   │       ├── hooks/<domain>/    one TanStack Query hook per operation
│   │       ├── api/ lib/          Axios client with silent refresh, socket, query client
│   │       └── store/             Redux Toolkit (auth + inbox UI state only)
│   ├── widget/                    Vite: src/loader (loader.js) and src/ (the React chat frame)
│   ├── test-site/                 a plain static "bakery" site that proves the widget on a site we don't control
│   └── e2e/                       Playwright specs
├── packages/
│   ├── types/                     @repo/types: Zod schemas for every REST body and socket event
│   └── ui/  typescript-config/  eslint-config/
├── docker-compose.yml             the two Redis instances (+ a test Postgres)
├── render.yaml  apps/*/vercel.json
└── turbo.json, pnpm-workspace.yaml
```

## 🧰 Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| Language | TypeScript | server, web, widget and shared package |
| Monorepo | pnpm workspaces, Turborepo | scoped installs, task orchestration |
| Web | Next.js 16 (App Router), React 19 | inbox, admin, demo homepage |
| Web state | TanStack Query, Redux Toolkit | server data vs. auth and inbox UI state |
| Styling | Tailwind CSS v4, shadcn/ui (Radix) | one design system, light and dark |
| Widget | React 19 in an iframe, vanilla loader, Vite | embeddable chat |
| Backend | Node.js, Express 5 | HTTP API |
| Real time | Socket.IO 4, `@socket.io/redis-adapter` | WebSocket delivery across instances |
| Database | PostgreSQL (Neon), Prisma 8 | primary store, constraints enforce the rules |
| Cache / queue / limiter | Redis via `ioredis` (two instances) | response cache; BullMQ, rate limits, presence |
| Jobs | BullMQ 5, Bull Board | email and maintenance workers, queue UI |
| Email | Gmail API via `google-auth-library` | invitations and offline replies |
| Auth | `jsonwebtoken`, argon2, `google-auth-library` | JWT sessions, hashing, Google sign-in |
| Validation | Zod 4 | shared request and event schemas |
| Tests | Jest 30, Supertest, `socket.io-client`, Playwright + axe | server, real-time and browser tests |
| Infrastructure | Docker Compose, GitHub Actions | local Redis, CI |

## 🚀 Getting Started

**Prerequisites:** Node.js 22, pnpm 9, Docker (for Redis; hosted Redis works too), a PostgreSQL database (Neon works), and optionally a Google OAuth client for sign-in and a Gmail account for email.

```bash
git clone git@github.com:venkateshg12/relaydesk.git
cd relaydesk
pnpm install

# Redis: queue on 6381, cache on 6382 (skip if REDIS_* points at a hosted Redis)
docker compose up -d

# Environment (fill in real values; see the tables below)
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
cp apps/widget/.env.example apps/widget/.env

# The apps consume the compiled shared package
pnpm --filter @repo/types build

# Migrations, then two sample businesses (optional, password Password123!)
pnpm --filter server db:deploy
pnpm --filter server db:seed

# API :4000, web :3000, widget :5173
pnpm dev
```

Open `http://localhost:3000`. The homepage starts a private demo workspace on its own.

- **Try the widget on a site you don't control:** `pnpm --filter test-site serve` serves the bakery site on `http://localhost:5500`. Open it with your workspace's key, e.g. `http://localhost:5500/?key=rd_pk_…` (the seeded sample is `rd_pk_sweetcrumbsbakery0000001`). The key is on the admin **Install** screen.
- **Sample logins** after `db:seed`: `sarah@sweetcrumbs.test` (admin) and `tom@sweetcrumbs.test` (agent), password `Password123!`.
- **Standalone worker:** `pnpm --filter server worker`.
- **Queue dashboard:** `http://localhost:4000/admin/queues` in development.
- **Check email:** `pnpm --filter server mail:test you@example.com`.
- **Checks:** `pnpm lint`, `pnpm typecheck`, `pnpm build` from the repo root.

## 🔑 Environment Variables

**API: `apps/server/.env`.** Variables without a default must be non-empty or the server will not start.

| Variable | Description | Required |
|---|---|---|
| `PORT` | API port (default `4000`) | No |
| `NODE_ENV` | `development` or `production` | No |
| `DATABASE_URL` | PostgreSQL connection string (Neon: the pooled one) | Yes |
| `CORS_ORIGIN` | Comma-separated origins allowed with credentials: the web app and the widget | Yes |
| `WIDGET_ORIGIN` | Origin of the widget frame (`postMessage` and CORS checks) | Yes |
| `WEB_ORIGIN` | Web app origin used in invitation links (default: first `CORS_ORIGIN`) | No |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `VISITOR_TOKEN_SECRET` | Three different secrets, 32+ characters each (`openssl rand -hex 32`) | Yes |
| `REDIS_HOST`, `REDIS_PORT` | Queue / rate-limit Redis (defaults `localhost`, `6381`) | No |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | For a hosted Redis (it must use `noeviction`) | No |
| `CACHE_REDIS_HOST`, `CACHE_REDIS_PORT` | Cache Redis (defaults: queue host, port `6382`) | No |
| `CACHE_REDIS_USERNAME`, `CACHE_REDIS_PASSWORD` | Default to the queue credentials | No |
| `CACHE_ENABLED` | `false` bypasses the cache entirely | No (default `true`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client id for sign-in; empty turns it off | No |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` | OAuth client used to send email | For email |
| `GMAIL_REDIRECT_URI` | The callback registered on that client, `…/api/auth/gmail/callback` | For email |
| `GMAIL_REFRESH_TOKEN` | Created once at `/api/auth/gmail` | For email |
| `GMAIL_OAUTH_SETUP` | `true` switches the authorise routes on in production while re-authorising | No (default `false`) |
| `EMAIL_FROM` | `Name <address>`; the address must be the authorising Gmail account | For email |
| `TRUSTED_PROXY_CIDRS` | Proxies whose client-IP headers may be trusted (`127.0.0.1/32` on Render); empty if directly exposed | Recommended behind a proxy |
| `RUN_WORKERS_IN_API` | `true` runs the background jobs inside the API in production (one-service deploys) | No (default `false`) |
| `ENABLE_QUEUE_DASHBOARD`, `QUEUE_DASHBOARD_USER`, `QUEUE_DASHBOARD_PASSWORD` | Bull Board in production and its basic-auth credentials | No |
| `DEBUG_IP_ENDPOINT` | `true` exposes `/debug-ip` for checking proxy trust; leave off normally | No |
| `DEMO_TTL_HOURS`, `DEMO_SESSIONS_PER_HOUR` | Demo workspace lifetime (24) and sessions per IP per hour (10) | No |

**Web: `apps/web/.env`**

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the API | Yes |
| `NEXT_PUBLIC_WIDGET_ORIGIN` | Where `loader.js` and the frame are served (used in the install snippet) | Yes |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same Google client id; enables "Continue with Google" | No |
| `NEXT_PUBLIC_TEST_SITE_ORIGIN` | The sample site linked from the Install screen | No |
| `NEXT_PUBLIC_REPO_URL` | Enables the "View the code" button | No |

**Widget: `apps/widget/.env`:** `VITE_API_URL` (the API) and `VITE_FRAME_ORIGIN` (where the frame is served).

## 🧪 Testing

| Suite | What it covers |
|---|---|
| `situations.test.ts` (12) | The tricky situations over real HTTP and real sockets, against real Postgres and Redis |
| `tricky-situations.test.ts` (7) | Ordering, idempotency, assignment race, reopen, note isolation, tenancy, removal |
| `googleAuth.test.ts` (6) | Google sign-in, sign-up and invitation paths |
| `gmailAuth.test.ts` (7) | The Gmail authorise flow: consent URL, state cookie, every refusal |
| `mime.test.ts` (9), `emailTemplates.test.ts` (6) | Message building, header-injection safety, template escaping |
| Playwright (`apps/e2e`, 10) | Two-browser chat and offline mode, host-site isolation, axe accessibility checks |
| `pnpm --filter server load` | Load test: N visitors, M agents, p50 / p95 / p99 acknowledgement latency |

The server suite refuses to run without a database of its own, because every test writes real rows (each makes its own workspace and deletes it):

```bash
docker compose --profile test up -d postgres-test       # an in-memory Postgres on :5433
DATABASE_URL=postgresql://postgres:password@localhost:5433/relaydesk_test pnpm --filter server db:deploy
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5433/relaydesk_test pnpm test
pnpm test:e2e
pnpm --filter server load -- --url http://localhost:4000 --visitors 100
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck and build, then the server tests and the Playwright suite against Postgres and Redis service containers.

## 🐳 Docker

`docker-compose.yml` runs the two Redis instances and, behind a profile, a test database; the apps run on the host and there is no application Dockerfile.

| Service | Port | Configuration |
|---|---|---|
| `redis` | 6381 | `--appendonly yes --maxmemory-policy noeviction`, health check |
| `redis-cache` | 6382 | no persistence, `--maxmemory 256mb --maxmemory-policy volatile-lru`, health check |
| `postgres-test` (profile `test`) | 5433 | an in-memory Postgres 16 for the test suite |

```bash
docker compose up -d      # start the two Redis instances
docker compose down       # stop
```

## 📊 Engineering Decisions

**Why PostgreSQL, not MongoDB?** The data is relational (workspace → members → conversations → messages), and the hard rules need constraints: unique indexes for idempotency, composite foreign keys for tenancy, a row lock for ordering, and conditional updates for "only one winner". A document store would push all of those into application code.

**Why a sequence number instead of timestamps?** Two messages can share a timestamp and clocks disagree between servers. `lastSeq + 1 … RETURNING` under the conversation's row lock gives a gap-free order that every client can sort by and use for catch-up.

**Why is the client's `clientMessageId` part of the design?** Networks retry, and people double-click. Making the id part of a unique index turns every retry path (socket, REST, outbox replay) into a safe lookup instead of a deduplication problem.

**Why conditional updates instead of check-then-write?** Every race that matters here (two agents assigning, resolve, reopen, hand-over, removing a member) is decided by one statement whose `WHERE` encodes the invariant, not by a read followed by a write.

**Why "Postgres decides, sockets deliver"?** Events are emitted only after the transaction commits, so a client never sees a message that was rolled back, and a reconnecting client can always rebuild its view from Postgres through `sync`.

**Why an iframe, and a token in `localStorage`?** The iframe isolates the widget from the host site's CSS and scripts, and the host from the widget. Third-party cookies are blocked inside iframes, so visitors authenticate with a signed token that the frame keeps itself.

**Why WebSocket-only?** There is no polling fallback, so nothing needs sticky sessions behind a load balancer; the Redis adapter handles fan-out. The cost is that a network that blocks WebSockets cannot use the chat.

**Why two Redis instances?** BullMQ loses jobs if keys are evicted, while a cache that cannot evict grows until it fails. `volatile-lru` only evicts keys that have a TTL, so every cache entry carries one.

**Why the Gmail API instead of an email provider?** It needs no domain and no payment, and it works over HTTPS (a host that blocks SMTP does not matter). The cost is a single sending account, about 500 emails a day, and a refresh token to look after.

**Why background jobs?** Email delivery is slow and fails independently of the request. Queueing keeps the API responsive, and BullMQ supplies retries with backoff and a failure history. Processors re-read Postgres, so a late job never acts on stale data.

**Why a custom rate limiter?** The requirements (per-IP and per-account login limits, a lock-out attackers cannot weaponise, a dual-bucket pre-auth limit, graceful behaviour when Redis is down) are not met by a stock per-IP counter. Atomicity comes from Lua; availability comes from the breaker and the memory fallback.

**Why shared Zod schemas?** Every REST body and every socket event is defined once, so the server's validation and the clients' types cannot drift.

## 👨‍💻 Author

Venkatesh · [github.com/venkateshg12](https://github.com/venkateshg12)
