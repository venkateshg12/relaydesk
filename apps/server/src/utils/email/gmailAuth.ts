import { OAuth2Client } from "google-auth-library";
import { EMAIL_FROM, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI } from "../../constants/env.js";
import { BAD_GATEWAY, BAD_REQUEST, INTERNAL_SERVER_ERROR } from "../../constants/http.js";
import { appErrorCode } from "../../constants/appErrorCode.js";
import appAssert from "../errors/appAssert.js";
import { parseMailbox } from "./mime.js";

/*
  The one-time browser flow that produces `GMAIL_REFRESH_TOKEN`: send the browser to Google's consent screen, get
  a one-time `code` back at the redirect URI, and trade it for a refresh token. Sending mail never uses this
  file (see sendMail.ts); it only runs when someone opens `/api/auth/gmail`.
 */

// The one permission requested: sending. Never widen it to read/modify/full-mailbox scopes: the app can send mail
// and cannot read the mailbox, which is also what keeps Google's verification simple if you ever publish.
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

let oauthClient: OAuth2Client | undefined;

// Created on first use, so a server without Gmail configured still boots and fails here, with a clear error.
const getOAuthClient = () => {
    appAssert(
        GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REDIRECT_URI,
        INTERNAL_SERVER_ERROR,
        "Gmail is not configured on the server (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI)",
        appErrorCode.GmailNotConfigured
    );
    oauthClient ??= new OAuth2Client(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
    return oauthClient;
};

export const getGmailAuthUrl = (state: string) => {
    // Pre-selects the sending account on Google's account chooser, so a personal account isn't picked by accident.
    const senderAddress = EMAIL_FROM ? parseMailbox(EMAIL_FROM)?.address : undefined;

    return getOAuthClient().generateAuthUrl({
        access_type: "offline", // ask for a refresh token
        prompt: "consent", // and make Google issue a new one even if this account authorised the app before
        scope: GMAIL_SCOPES,
        state,
        ...(senderAddress ? { login_hint: senderAddress } : {}),
    });
};

export const exchangeGmailAuthCode = async (code: string) => {
    const client = getOAuthClient();

    // Never log the error object: it can carry the code and the client secret.
    const tokens = await client
        .getToken(code)
        .then(({ tokens }) => tokens)
        .catch((error: { response?: { status?: number } }) => {
            console.error("[Gmail] Authorization code exchange failed", { status: error?.response?.status });
            return null;
        });
    appAssert(
        tokens,
        BAD_REQUEST,
        "Invalid or expired authorization code; start again at /api/auth/gmail",
        appErrorCode.GmailAuthInvalid
    );

    appAssert(
        tokens.scope?.split(" ").includes(GMAIL_SCOPES[0]!),
        BAD_REQUEST,
        "The gmail.send permission was not granted",
        appErrorCode.GmailAuthInvalid
    );
    appAssert(
        tokens.refresh_token,
        BAD_GATEWAY,
        "Google did not return a refresh token; remove this app at myaccount.google.com/permissions for the sending account and try again",
        appErrorCode.GmailAuthInvalid
    );

    return tokens.refresh_token;
};
