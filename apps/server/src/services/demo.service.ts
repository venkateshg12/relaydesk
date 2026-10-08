import crypto from "crypto";
import { pool } from "../config/db.js";
import { hashValue } from "../utils/auth/password.js";
import { SAMPLE_BAKERY } from "../data/sampleBakery.js";
import { createSessionAndTokens } from "./auth.service.js";

// How long a homepage visitor's private workspace lives; the hourly `delete_demo_workspaces` job removes it.
export const DEMO_TTL_HOURS = Number(process.env["DEMO_TTL_HOURS"] ?? 24);

const DEMO_MEMBER_NAME = "Sarah Baker";
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

export interface DemoSession {
    workspace: { id: string; name: string; publicKey: string; widgetColor: string; isDemo: true };
    member: { id: string; name: string; role: "admin" };
    expiresAt: string;
    accessToken: string;
    refreshToken: string;
}

/*
  A private workspace for one homepage visitor: the sample bakery's conversations in each state, one demo
  admin who is signed in by the cookies set from the result. Everything is inserted by one statement
  (data-modifying CTEs over `jsonb_to_recordset`), so the page is usable within a second rather than after
  dozens of round trips. Nothing here is a mock: it is a real workspace with `isDemo` set, isolated from every
  other by the same `workspaceId` rule as any customer, and deleted by cascade when it expires.
 */
export const createDemoSessionService = async ({ userAgent }: { userAgent?: string }): Promise<DemoSession> => {
    const workspaceId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const publicKey = `rd_pk_demo_${crypto.randomBytes(12).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + DEMO_TTL_HOURS * 60 * 60 * 1000).toISOString();
    // A random address and password nobody ever sees: the cookies are the only way into a demo.
    const email = `demo+${crypto.randomBytes(6).toString("hex")}@relaydesk.invalid`;
    const passwordHash = await hashValue(crypto.randomBytes(32).toString("hex"));

    const { visitors, savedReplies } = SAMPLE_BAKERY;
    const rows = { visitors: [] as object[], conversations: [] as object[], messages: [] as object[], notes: [] as object[] };

    visitors.forEach((sample, index) => {
        const visitorId = crypto.randomUUID();
        const conversationId = crypto.randomUUID();
        // The oldest sample is the one furthest back; each conversation's last message is a few minutes old.
        const age = (visitors.length - index) * 40;
        rows.visitors.push({
            id: visitorId, displayNo: 1001 + index, name: sample.name, email: sample.email,
            lastPageUrl: sample.page, firstSeenAt: minutesAgo(age + 120), lastSeenAt: minutesAgo(age),
        });

        const { status, messages, note } = sample.conversation;
        const lastMessage = messages[messages.length - 1]!;
        // Sample agents all map to the one demo member, so an "assigned" sample is assigned to *you*.
        rows.conversations.push({
            id: conversationId, visitorId, status,
            assigneeId: status === "assigned" ? memberId : null,
            lastAssigneeId: status === "unassigned" ? null : memberId,
            lastSeq: messages.length, lastMessageAt: minutesAgo(age), lastMessagePreview: lastMessage.body,
            visitorLastReadSeq: messages.length, agentLastReadSeq: status === "unassigned" ? 0 : messages.length,
            firstAgentReplyAt: messages.some((m) => m.from === "agent") ? minutesAgo(age + 30) : null,
            resolvedAt: status === "resolved" ? minutesAgo(age) : null, createdAt: minutesAgo(age + 120),
        });
        messages.forEach((message, i) =>
            rows.messages.push({
                id: crypto.randomUUID(), conversationId, seq: i + 1, clientMessageId: crypto.randomUUID(),
                senderType: message.from, senderMemberId: message.from === "agent" ? memberId : null,
                body: message.body, createdAt: minutesAgo(age + (messages.length - i) * 20),
            })
        );
        if (note) rows.notes.push({ id: crypto.randomUUID(), conversationId, body: note.body, createdAt: minutesAgo(age - 1) });
    });

    // One statement: the data-modifying CTEs all run, in one implicit transaction, and the foreign keys are
    // checked when the statement ends — so a single round trip to Postgres creates the whole workspace.
    await pool.query(
        `WITH workspace AS (
             INSERT INTO "public"."workspace"
                 ("id", "name", "publicKey", "widgetColor", "greeting", "awayMessage", "lastVisitorNo", "isDemo", "demoExpiresAt")
             VALUES ($1, $3, $4, $5, $6, $7, $8, true, $9)
         ), member AS (
             INSERT INTO "public"."member" ("id", "workspaceId", "name", "email", "passwordHash", "role")
             VALUES ($2, $1, $10, $11, $12, 'admin')
         ), replies AS (
             INSERT INTO "public"."savedReply" ("id", "workspaceId", "title", "shortcut", "body", "createdById")
             SELECT gen_random_uuid(), $1, r.title, r.shortcut, r.body, $2
               FROM jsonb_to_recordset($13::jsonb) AS r(title text, shortcut text, body text)
         ), visitors AS (
             INSERT INTO "public"."visitor" ("id", "workspaceId", "displayNo", "name", "email", "lastPageUrl", "firstSeenAt", "lastSeenAt")
             SELECT r.id, $1, r."displayNo", r.name, r.email, r."lastPageUrl", r."firstSeenAt", r."lastSeenAt"
               FROM jsonb_to_recordset($14::jsonb) AS r(id uuid, "displayNo" int, name text, email text, "lastPageUrl" text,
                    "firstSeenAt" timestamptz, "lastSeenAt" timestamptz)
         ), conversations AS (
             INSERT INTO "public"."conversation"
                 ("id", "workspaceId", "visitorId", "status", "assigneeId", "lastAssigneeId", "lastSeq", "lastMessageAt", "lastMessagePreview",
                  "visitorLastReadSeq", "agentLastReadSeq", "firstAgentReplyAt", "resolvedAt", "createdAt")
             SELECT r.id, $1, r."visitorId", r.status, r."assigneeId", r."lastAssigneeId", r."lastSeq", r."lastMessageAt", r."lastMessagePreview",
                    r."visitorLastReadSeq", r."agentLastReadSeq", r."firstAgentReplyAt", r."resolvedAt", r."createdAt"
               FROM jsonb_to_recordset($15::jsonb) AS r(id uuid, "visitorId" uuid, status text, "assigneeId" uuid, "lastAssigneeId" uuid, "lastSeq" int,
                    "lastMessageAt" timestamptz, "lastMessagePreview" text, "visitorLastReadSeq" int, "agentLastReadSeq" int,
                    "firstAgentReplyAt" timestamptz, "resolvedAt" timestamptz, "createdAt" timestamptz)
         ), messages AS (
             INSERT INTO "public"."message" ("id", "workspaceId", "conversationId", "seq", "clientMessageId", "senderType", "senderMemberId", "body", "createdAt")
             SELECT r.id, $1, r."conversationId", r.seq, r."clientMessageId", r."senderType", r."senderMemberId", r.body, r."createdAt"
               FROM jsonb_to_recordset($16::jsonb) AS r(id uuid, "conversationId" uuid, seq int, "clientMessageId" text, "senderType" text,
                    "senderMemberId" uuid, body text, "createdAt" timestamptz)
         )
         INSERT INTO "public"."note" ("id", "workspaceId", "conversationId", "authorId", "body", "createdAt")
         SELECT r.id, $1, r."conversationId", $2, r.body, r."createdAt"
           FROM jsonb_to_recordset($17::jsonb) AS r(id uuid, "conversationId" uuid, body text, "createdAt" timestamptz)`,
        [
            workspaceId, memberId, SAMPLE_BAKERY.name, publicKey, SAMPLE_BAKERY.widgetColor, SAMPLE_BAKERY.greeting, SAMPLE_BAKERY.awayMessage,
            1000 + visitors.length, expiresAt, DEMO_MEMBER_NAME, email, passwordHash,
            JSON.stringify(savedReplies), JSON.stringify(rows.visitors), JSON.stringify(rows.conversations),
            JSON.stringify(rows.messages), JSON.stringify(rows.notes),
        ]
    );

    const { accessToken, refreshToken } = await createSessionAndTokens({ id: memberId, workspaceId, role: "admin" }, userAgent);

    return {
        workspace: { id: workspaceId, name: SAMPLE_BAKERY.name, publicKey, widgetColor: SAMPLE_BAKERY.widgetColor, isDemo: true },
        member: { id: memberId, name: DEMO_MEMBER_NAME, role: "admin" },
        expiresAt,
        accessToken,
        refreshToken,
    };
};
