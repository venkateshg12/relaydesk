const getEnv = (key: string, defaultValue?: string) => {
    const value = process.env[key] || defaultValue;

    if (value === undefined) {
        throw new Error(`Missing environment variable ${key}`);
    }

    return value;
};

export const PORT = getEnv("PORT", "4000");
export const NODE_ENV = getEnv("NODE_ENV", "development");
export const DATABASE_URL = getEnv("DATABASE_URL");
export const CORS_ORIGIN = getEnv("CORS_ORIGIN");
export const WEB_ORIGIN = getEnv("WEB_ORIGIN", CORS_ORIGIN.split(",")[0].trim());
export const WIDGET_ORIGIN = getEnv("WIDGET_ORIGIN");

export const JWT_SECRET = getEnv("JWT_SECRET");
export const JWT_REFRESH_SECRET = getEnv("JWT_REFRESH_SECRET");
export const VISITOR_TOKEN_SECRET = getEnv("VISITOR_TOKEN_SECRET");

/*
  HS256 secrets are only as strong as their entropy: a short or guessable one can be brute-forced
  offline from any single token, after which anyone can mint tokens for any user or role. The three
  must also differ from each other.
 */
const MIN_JWT_SECRET_LENGTH = 32;

if (
    JWT_SECRET.length < MIN_JWT_SECRET_LENGTH ||
    JWT_REFRESH_SECRET.length < MIN_JWT_SECRET_LENGTH ||
    VISITOR_TOKEN_SECRET.length < MIN_JWT_SECRET_LENGTH
) {
    throw new Error(
        `JWT_SECRET, JWT_REFRESH_SECRET, and VISITOR_TOKEN_SECRET must each be at least ${MIN_JWT_SECRET_LENGTH} characters (generate with: openssl rand -hex 32)`
    );
}

if (
    JWT_SECRET === JWT_REFRESH_SECRET ||
    JWT_SECRET === VISITOR_TOKEN_SECRET ||
    JWT_REFRESH_SECRET === VISITOR_TOKEN_SECRET
) {
    throw new Error("JWT_SECRET, JWT_REFRESH_SECRET, and VISITOR_TOKEN_SECRET must be different values");
}

// Optional: without it the server runs and `POST /auth/google` answers that Google sign-in is not configured.
export const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID", "");

// Email goes out through the Gmail API as the Google account that created the refresh token. All three are needed
// together; without them development prints the email to the log and production reports every send as failed.
export const GMAIL_CLIENT_ID = getEnv("GMAIL_CLIENT_ID", "");
export const GMAIL_CLIENT_SECRET = getEnv("GMAIL_CLIENT_SECRET", "");
export const GMAIL_REFRESH_TOKEN = getEnv("GMAIL_REFRESH_TOKEN", "");
// Where Google sends the browser back after the one-time authorisation (`/api/auth/gmail/callback` on this API). It must be
// registered, character for character, as an authorised redirect URI on the OAuth client.
export const GMAIL_REDIRECT_URI = getEnv("GMAIL_REDIRECT_URI", "");
// The authorisation routes are always on outside production. In production they stay off unless this is "true",
// which you set only while re-authorising (a token from a project still in "Testing" expires after 7 days).
export const GMAIL_OAUTH_SETUP = getEnv("GMAIL_OAUTH_SETUP", "false");
// `Name <address>`. Gmail only sends as the authorised account (or an alias set up in its settings), so the
// address here must be that account's; the name is what recipients see. Empty: Gmail uses the account itself.
export const EMAIL_FROM = getEnv("EMAIL_FROM", "");

export const TRUSTED_PROXY_CIDRS = getEnv("TRUSTED_PROXY_CIDRS", "");
export const DEBUG_IP_ENDPOINT = getEnv("DEBUG_IP_ENDPOINT", "false");

export const ENABLE_QUEUE_DASHBOARD = getEnv("ENABLE_QUEUE_DASHBOARD", "false");
export const QUEUE_DASHBOARD_USER = getEnv("QUEUE_DASHBOARD_USER", "");
export const QUEUE_DASHBOARD_PASSWORD = getEnv("QUEUE_DASHBOARD_PASSWORD", "");

export const REDIS_HOST = getEnv("REDIS_HOST", "localhost");
export const REDIS_PORT = getEnv("REDIS_PORT", "6381");
export const REDIS_USERNAME = getEnv("REDIS_USERNAME", "");
export const REDIS_PASSWORD = getEnv("REDIS_PASSWORD", "");

export const CACHE_REDIS_HOST = getEnv("CACHE_REDIS_HOST", REDIS_HOST);
export const CACHE_REDIS_PORT = getEnv("CACHE_REDIS_PORT", "6382");
export const CACHE_REDIS_USERNAME = getEnv("CACHE_REDIS_USERNAME", REDIS_USERNAME);
export const CACHE_REDIS_PASSWORD = getEnv("CACHE_REDIS_PASSWORD", REDIS_PASSWORD);
export const CACHE_ENABLED = getEnv("CACHE_ENABLED", "true");

export const DEMO_TTL_HOURS = getEnv("DEMO_TTL_HOURS", "24");
