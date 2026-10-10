export const DEFAULT_KEY_PREFIX = "rl:global";
export const GLOBAL_VISITOR_PREFIX = "rl:global:guest";
export const GLOBAL_IP_PREFIX = "rl:global:ip";

export const AUTH_LOGIN_PREFIX = "rl:auth:login";
// The same endpoints, counted along two more axes: one bucket per account regardless of where the
// attempts come from, and one per source regardless of which account is being tried.
export const AUTH_LOGIN_ACCOUNT_PREFIX = "rl:auth:login:account";
export const AUTH_LOGIN_SOURCE_PREFIX = "rl:auth:login:source";
export const AUTH_SIGNUP_SOURCE_PREFIX = "rl:auth:signup:source";
export const AUTH_VERIFY_EMAIL_PREFIX = "rl:auth:verify-email";
export const AUTH_RESEND_VERIFICATION_PREFIX = "rl:auth:resend-verification";
export const AUTH_RESEND_VERIFICATION_SOURCE_PREFIX = "rl:auth:resend-verification:source";

export const AUTH_REFRESH_PREFIX = "rl:auth:refresh";
export const AUTH_REFRESH_SOURCE_PREFIX = "rl:auth:refresh:source";

export const TEAM_INVITE_PREFIX = "rl:team:invite";
export const WIDGET_SESSION_PREFIX = "rl:widget:session";
export const WIDGET_MESSAGE_PREFIX = "rl:widget:message";

export const PROTECTED_API_PREFIX = "rl:protected";
export const LOCKOUT_PREFIX = "rl:lockout";

export const HTTP_HEADERS = {
    RETRY_AFTER: "Retry-After",
    RATELIMIT_LIMIT: "X-RateLimit-Limit",
    RATELIMIT_REMAINING: "X-RateLimit-Remaining",
    RATELIMIT_IP_REMAINING: "X-RateLimit-IP-Remaining",
    RATELIMIT_RESET: "X-RateLimit-Reset"
} as const;

export const ONE_MINUTE_MS = 60 * 1000;
export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
export const THIRTY_MINUTES_MS = 30 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;
export const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_MAX_REQUESTS = 100;

export const CIRCUIT_BREAKER_DEFAULTS = {
    FAILURE_THRESHOLD: 10,
    RESET_TIMEOUT_MS: 30000
};

// The per-window budgets shared by the HTTP limiters (config/rateLimiter.ts) and the socket
// `message:send` handler, so a message costs the same over either transport.
export const WIDGET_MESSAGE_LIMIT = 20; // per minute, per visitor
export const PROTECTED_API_LIMIT = 300; // per five minutes, per member
export const DEMO_MESSAGE_LIMIT = 12; // per minute, per person, in a demo workspace
