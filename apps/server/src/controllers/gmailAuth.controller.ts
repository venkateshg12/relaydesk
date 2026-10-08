import crypto from "node:crypto";
import type { CookieOptions } from "express";
import { NODE_ENV } from "../constants/env.js";
import { BAD_REQUEST, OK } from "../constants/http.js";
import { catchError } from "../utils/errors/catchError.js";
import appAssert from "../utils/errors/appAssert.js";
import { exchangeGmailAuthCode, getGmailAuthUrl } from "../utils/email/index.js";

const STATE_COOKIE = "gmail_oauth_state";

// Scoped to this flow's path. Lax is enough: Google returns the browser with a top-level GET.
const stateCookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: NODE_ENV !== "development",
    path: "/api/auth/gmail",
};

// Compares through a hash so the check takes the same time whatever the two values share.
const sameValue = (a: string, b: string) =>
    crypto.timingSafeEqual(crypto.createHash("sha256").update(a).digest(), crypto.createHash("sha256").update(b).digest());

// GET /api/auth/gmail — send the browser to Google's consent screen.
export const gmailAuthorizeHandler = catchError(async (_req, res) => {
    // A random state tied to this browser stops someone else's authorisation from being replayed into it.
    const state = crypto.randomBytes(32).toString("hex");
    res.cookie(STATE_COOKIE, state, { ...stateCookieOptions, maxAge: 10 * 60 * 1000 });

    console.log("[Gmail] OAuth authorization started");
    res.redirect(getGmailAuthUrl(state));
});

// GET /api/auth/gmail/callback — Google sends the browser back here with a one-time code.
export const gmailCallbackHandler = catchError(async (req, res) => {
    const { code, state, error } = req.query;
    const expectedState: unknown = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, stateCookieOptions);

    appAssert(!error, BAD_REQUEST, "Google authorization was denied or failed; start again at /api/auth/gmail");
    appAssert(
        typeof state === "string" && typeof expectedState === "string" && sameValue(state, expectedState),
        BAD_REQUEST,
        "Invalid or expired authorization session; start again at /api/auth/gmail"
    );
    appAssert(typeof code === "string" && code.length > 0, BAD_REQUEST, "Missing authorization code");

    const refreshToken = await exchangeGmailAuthCode(code);

    // The one place the refresh token is shown: the server console, for the person running the setup. It is never
    // put in the response, and nothing else in the app logs it.
    console.log("[Gmail] Authorization successful. Put this in apps/server/.env (or the host's secrets), then restart the server:");
    console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}`);

    res.status(OK)
        .type("html")
        .send("<p>Gmail authorization successful. Copy GMAIL_REFRESH_TOKEN from the server console into your environment, then restart the server.</p>");
});
