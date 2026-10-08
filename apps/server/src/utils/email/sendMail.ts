import { OAuth2Client } from "google-auth-library";
import { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, EMAIL_FROM, NODE_ENV } from "../../constants/env.js";
import { buildMimeMessage, parseMailbox, toBase64Url } from "./mime.js";

export interface MailOptions {
    to: string;
    subject: string;
    text: string;
    html: string;
}

/*
  A failed send. `isRetryable` tells the queue whether trying again can help: a mistyped address or a revoked
  token never will, so the job stops at once instead of retrying three times and filling Bull Board with noise.
 */
export class MailError extends Error {
    constructor(message: string, readonly isRetryable: boolean, readonly status?: number) {
        super(message);
        this.name = "MailError";
    }
}

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_TIMEOUT_MS = 15_000;

const isConfigured = Boolean(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN);

if (!isConfigured && NODE_ENV === "production") {
    console.warn("[Mail] GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET or GMAIL_REFRESH_TOKEN is missing: emails will fail until they are set.");
}

/*
  One client for the whole process. It holds the refresh token, trades it for a short-lived access token when
  needed (about once an hour) and keeps that token until it expires, so a send is one HTTPS call to Gmail.
 */
let client: OAuth2Client | undefined;
const getClient = () => {
    if (!client) {
        client = new OAuth2Client(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
        client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
    }
    return client;
};

interface GoogleHttpError {
    message?: string;
    response?: { status?: number; data?: { error?: string | { message?: string; errors?: { reason?: string }[] }; error_description?: string } };
}

// Turns what Google answered into a `MailError` that says what to do about it.
const toMailError = (error: unknown): MailError => {
    const { message = "Unknown error", response } = (error ?? {}) as GoogleHttpError;
    const status = response?.status;
    const data = response?.data;
    const code = typeof data?.error === "string" ? data.error : undefined;
    const reasons = typeof data?.error === "object" ? (data.error.errors ?? []).map((entry) => entry.reason) : [];
    const detail = typeof data?.error === "object" ? data.error.message : data?.error_description;

    // The refresh token was revoked, expired (a Google Cloud project still in "Testing" expires them after 7
    // days) or belongs to another client: only a new token fixes it.
    if (code === "invalid_grant" || code === "invalid_client" || code === "unauthorized_client") {
        return new MailError(
            `Gmail rejected the credentials (${code}). Create a new GMAIL_REFRESH_TOKEN for this client id and update the environment.`,
            false,
            status
        );
    }

    // Quotas and a busy Google clear by themselves: retry with the queue's backoff.
    const isQuota = reasons.some((reason) => reason && /rateLimit|quota|dailyLimit/i.test(reason));
    if (status === 429 || (status !== undefined && status >= 500) || isQuota || status === undefined) {
        return new MailError(`Gmail could not send right now: ${detail ?? message}`, true, status);
    }

    return new MailError(`Gmail refused the message (${status}): ${detail ?? message}`, false, status);
};

export const sendMail = async (options: MailOptions) => {
    // In production a missing credential is a failure, so the job retries and shows up in Bull Board —
    // never a silent "sent" for an email that went nowhere.
    if (!isConfigured && NODE_ENV === "production") {
        return { data: null, error: new MailError("Gmail credentials are not configured", true) };
    }

    // In development, print the email instead of sending it (the invite link is in the server log).
    if (!isConfigured) {
        console.log("--- DEVELOPMENT MAIL SEND (nothing was sent: set GMAIL_REFRESH_TOKEN and EMAIL_FROM to send for real) ---");
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Body: ${options.text}`);
        console.log("------------------------------");
        return {
            data: { id: "dev-mock-mail-id" },
            error: null,
        };
    }

    // An address that cannot be built into a message is the caller's mistake: retrying changes nothing.
    if (EMAIL_FROM && !parseMailbox(EMAIL_FROM)) {
        return { data: null, error: new MailError('EMAIL_FROM must look like "Name <address@gmail.com>"', false) };
    }
    if (!parseMailbox(options.to)) {
        return { data: null, error: new MailError("The recipient is not a valid email address", false) };
    }

    try {
        const raw = toBase64Url(buildMimeMessage({ from: EMAIL_FROM, ...options }));
        const response = await getClient().request<{ id: string; threadId: string }>({
            url: GMAIL_SEND_URL,
            method: "POST",
            data: { raw },
            timeout: GMAIL_TIMEOUT_MS,
        });

        return { data: { id: response.data.id }, error: null };
    } catch (error) {
        const mailError = toMailError(error);
        console.error(`[Mail] ${mailError.message}`);
        return { data: null, error: mailError };
    }
};
