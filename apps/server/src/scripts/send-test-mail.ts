import "dotenv/config";

/*
  Sends one real email through the same `sendMail` the workers use, to check the Gmail setup without starting
  the app and inviting someone:  pnpm --filter server mail:test you@example.com
  It does not go through the queue: it tests the credentials, the sender address and Gmail itself.
 */
const to = process.argv[2];
if (!to) {
    console.error("Usage: pnpm --filter server mail:test <recipient email>");
    process.exit(1);
}

// Imported after dotenv has loaded `.env`, because the env constants are read when the module loads.
const { sendMail, getInvitationEmail } = await import("../utils/email/index.js");
const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, EMAIL_FROM } = await import("../constants/env.js");

const missing = Object.entries({ GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN })
    .filter(([, value]) => !value)
    .map(([name]) => name);
if (missing.length > 0) {
    console.error(`Not configured: ${missing.join(", ")} is empty in apps/server/.env (see docs/EMAIL.md).`);
    process.exit(1);
}

console.log(`Sending from ${EMAIL_FROM || "the authorised Gmail account"} to ${to} ...`);
const template = getInvitationEmail("RelayDesk test workspace", "RelayDesk", "test-token-not-a-real-invitation");
const { data, error } = await sendMail({ to, ...template });

if (error) {
    console.error(`Failed: ${error.message}`);
    process.exit(1);
}
console.log(`Sent. Gmail message id: ${data?.id}. Check the inbox (and spam) of ${to}.`);
process.exit(0);
