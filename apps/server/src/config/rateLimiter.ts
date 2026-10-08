import { Request } from "express";
import { createDualRateLimiter, createRateLimiter } from "../middleware/rateLimiter.js";
import { extractClientIp } from "../utils/rateLimiter/ipExtractor.js";
import {
    AUTH_LOGIN_ACCOUNT_PREFIX,
    AUTH_LOGIN_SOURCE_PREFIX,
    AUTH_LOGIN_PREFIX,
    AUTH_REFRESH_PREFIX,
    AUTH_REFRESH_SOURCE_PREFIX,
    AUTH_SIGNUP_SOURCE_PREFIX,
    FIFTEEN_MINUTES_MS,
    FIVE_MINUTES_MS,
    GLOBAL_IP_PREFIX,
    GLOBAL_VISITOR_PREFIX,
    ONE_HOUR_MS,
    ONE_MINUTE_MS,
    PROTECTED_API_PREFIX,
    TEAM_INVITE_PREFIX,
    THIRTY_MINUTES_MS,
    PROTECTED_API_LIMIT,
    WIDGET_MESSAGE_LIMIT,
    WIDGET_MESSAGE_PREFIX,
    WIDGET_SESSION_PREFIX
} from "../constants/rateLimiter.constant.js";
import { refreshTokenVerifyOptions, verifyToken } from "../utils/auth/jwt.js";
import type { RefreshTokenPayload } from "../types/auth.types.js";

/*
  Key Resolvers
 */
const emailKeyPart = (req: Request): string =>
    req.body?.email ? String(req.body.email).toLowerCase().trim() : "anonymous";

const ipAndEmailKeyResolver = (req: Request): string => {
    const ip = extractClientIp(req);
    return `ip:${ip}:email:${emailKeyPart(req)}`;
};

// The account being tried, independent of where the attempt came from.
const emailKeyResolver = (req: Request): string => `email:${emailKeyPart(req)}`;

const ipKeyResolver = (req: Request): string => `ip:${extractClientIp(req)}`;

const visitorKeyResolver = (req: Request): string => {
    return req.visitorId || req.cookies?.visitorId || extractClientIp(req);
};

/*
  The session a refresh cookie belongs to, so every signed-in user gets their own refresh budget
  instead of sharing one per IP — behind an office NAT or carrier-grade NAT, an IP-keyed budget ran
  out and the client then signed out everyone on that address. Verifying is a single HMAC, so it's
  cheap; a missing or forged cookie falls back to the IP.
 */
const refreshSessionKeyResolver = (req: Request): string => {
    const refreshToken = req.cookies?.refreshToken;
    if (typeof refreshToken === "string") {
        const { payload } = verifyToken<RefreshTokenPayload>(refreshToken, refreshTokenVerifyOptions);
        if (payload?.sessionId) {
            return `session:${payload.sessionId}`;
        }
    }
    return `ip:${extractClientIp(req)}`;
};

/*
  1. Global Infrastructure Protection (Atomic Dual-Bucket)
  Runs pre-auth across all incoming requests.
  Evaluates both:
  - Anonymous browser fairness: 500 requests / 5 minutes
  - Aggregate IP flood defense: 2000 requests / 5 minutes
 */
export const globalLimiter = createDualRateLimiter({
    visitorPrefix: GLOBAL_VISITOR_PREFIX,
    ipPrefix: GLOBAL_IP_PREFIX,
    windowMs: FIVE_MINUTES_MS,
    visitorLimit: 500,
    ipLimit: 2000,
    visitorKeyResolver: (req: Request) => visitorKeyResolver(req),
    ipKeyResolver: (req: Request) => extractClientIp(req)
});

/*
  2. Authentication Limiters
  Security-sensitive; applies punitive temporary lockouts to the specific ip:email key.
 */
export const loginLimiter = createRateLimiter({
    prefix: AUTH_LOGIN_PREFIX,
    windowMs: FIVE_MINUTES_MS,
    blockDurationMs: THIRTY_MINUTES_MS,
    max: 10,
    keyResolver: ipAndEmailKeyResolver
});

/*
  The pair above is one axis of three, and on its own it stops neither shape of credential attack:
  spread one account across many sources and no pair fills up; walk a list of accounts from one
  source and, again, no pair fills up. These two cover those axes — an account is locked however
  many places the guesses come from, and a source is capped however many accounts it tries.
  All three run on the login route; the first to reject wins.
*/
/*
  Not punitive on purpose. This key is only the email, which anyone can type, so a lockout here let
  anyone lock any user out for 30 minutes at a time with 15 bad guesses. As a plain sliding window it
  still caps guesses against one account, but the real user regains access as soon as the window
  moves on, and an attacker can't extend a lock.
*/
export const loginAccountLimiter = createRateLimiter({
    prefix: AUTH_LOGIN_ACCOUNT_PREFIX,
    windowMs: FIFTEEN_MINUTES_MS,
    max: 15,
    keyResolver: emailKeyResolver
});

// Deliberately loose: a household or office behind one NAT address shares it, so this is sized to
// catch account enumeration rather than to police normal shared use.
export const loginSourceLimiter = createRateLimiter({
    prefix: AUTH_LOGIN_SOURCE_PREFIX,
    windowMs: FIFTEEN_MINUTES_MS,
    max: 50,
    keyResolver: ipKeyResolver
});

// Sign-up limiter: prevents rapid automated workspace/admin creation from one source IP.
export const signupSourceLimiter = createRateLimiter({
    prefix: AUTH_SIGNUP_SOURCE_PREFIX,
    windowMs: ONE_HOUR_MS,
    max: 10,
    keyResolver: ipKeyResolver
});

export const refreshTokenLimiter = createRateLimiter({
    prefix: AUTH_REFRESH_PREFIX,
    windowMs: FIFTEEN_MINUTES_MS,
    max: 20,
    keyResolver: refreshSessionKeyResolver
});

// Loose on purpose: sized for many signed-in users behind one address, it only stops a single source
// hammering the endpoint with forged or rotating cookies.
export const refreshTokenSourceLimiter = createRateLimiter({
    prefix: AUTH_REFRESH_SOURCE_PREFIX,
    windowMs: FIFTEEN_MINUTES_MS,
    max: 300,
    keyResolver: ipKeyResolver
});

/*
  3. Team & Invite Operations
 */
export const inviteLimiter = createRateLimiter({
    prefix: TEAM_INVITE_PREFIX,
    windowMs: ONE_HOUR_MS,
    max: 30,
    keyResolver: (req: Request) => `workspace:${req.workspaceId ?? "unknown"}`
});

/*
  4. Widget Endpoints (Anonymous & Public)
 */
export const widgetSessionLimiter = createRateLimiter({
    prefix: WIDGET_SESSION_PREFIX,
    windowMs: FIVE_MINUTES_MS,
    max: 30,
    keyResolver: ipKeyResolver
});

export const widgetMessageLimiter = createRateLimiter({
    prefix: WIDGET_MESSAGE_PREFIX,
    windowMs: ONE_MINUTE_MS,
    max: WIDGET_MESSAGE_LIMIT,
    keyResolver: (req: Request) => `visitor:${visitorKeyResolver(req)}`
});

/*
  5. Authenticated Member APIs (Post-Auth)
  Isolates members behind shared NAT/cellular towers; protects against runaway client loops.
 */
export const protectedApiLimiter = createRateLimiter({
    prefix: PROTECTED_API_PREFIX,
    windowMs: FIVE_MINUTES_MS,
    max: PROTECTED_API_LIMIT,
    keyResolver: (req: Request) => `member:${req.memberId ?? "unknown"}`
});

export const demoSessionLimiter = createRateLimiter({
    prefix: "demo:session",
    windowMs: ONE_HOUR_MS,
    // Creating a workspace is the heaviest public call; the page remembers the demo, so a visitor needs one.
    max: Number(process.env["DEMO_SESSIONS_PER_HOUR"] ?? 10),
    keyResolver: ipKeyResolver
});
