import crypto from "crypto";
import { SYNC_PAGE_SIZE, type ClientSyncSchema, type ConversationStatus, type MessageItem } from "@repo/types";
import { orm, pool } from "../config/db.js";
import { appAssert } from "../utils/errors/index.js";
import { NOT_FOUND } from "../constants/http.js";
import { withPgTransaction } from "../utils/db/index.js";
import { incrementDeliveredMessagesCount } from "./stats.service.js";
import { announceMessage, isVisitorConnected } from "../realtime/emit.js";
import { EmailProducer } from "../jobs/producers/email.producer.js";

// One column list and one mapper for every message read, so the shape can't drift between queries.
// `senderName` comes from a join on the sending member (null for visitor messages).
const MESSAGE_SELECT = `
    SELECT m."id", m."workspaceId", m."conversationId", m."seq", m."clientMessageId", m."senderType",
           m."senderMemberId", sender."name" AS "senderName", m."body", m."createdAt"
      FROM "public"."message" m
      LEFT JOIN "public"."member" sender
        ON sender."id" = m."senderMemberId" AND sender."workspaceId" = m."workspaceId"`;

const toMessage = (row: MessageItem & { createdAt: Date | string }): MessageItem => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
});

const CONVERSATION_RETURNING = `"id", "visitorId", "status", "assigneeId", "lastMessageAt", "lastMessagePreview"`;

interface ConversationRow {
    id: string;
    visitorId: string;
    status: string;
    assigneeId: string | null;
    lastMessageAt: Date | string | null;
    lastMessagePreview: string | null;
}

const toConversationResult = (row: ConversationRow) => ({
    id: row.id,
    visitorId: row.visitorId,
    status: row.status as ConversationStatus,
    assigneeId: row.assigneeId,
    lastMessageAt: row.lastMessageAt ? new Date(row.lastMessageAt).toISOString() : null,
    preview: row.lastMessagePreview,
});

// An agent's reply to a visitor who has left the page goes to their email — if they gave one. The
// producer batches replies and caps it at one email per ten minutes; the processor re-checks what is unread.
const emailOfflineVisitor = async (workspaceId: string, { message, conversation }: SendMessageResult) => {
    try {
        if (await isVisitorConnected(conversation.visitorId)) return;
        const visitor = await orm.Visitor.where({ id: conversation.visitorId, workspaceId }).select("email").first();
        if (!visitor?.email) return;
        // Demo workspaces never send email: their sample visitors' addresses are not real.
        const workspace = await orm.Workspace.where({ id: workspaceId }).select("isDemo").first();
        if (!workspace?.isDemo) await EmailProducer.scheduleOfflineReplyJob({ workspaceId, conversationId: message.conversationId });
    } catch (error) {
        console.error("[Message] Could not schedule the offline reply email:", error);
    }
};

export interface SendMessageParams {
    workspaceId: string;
    // Agents name the conversation; a visitor has exactly one, found from `visitorId`.
    conversationId?: string;
    visitorId?: string;
    senderType: "visitor" | "agent";
    senderMemberId?: string;
    clientMessageId: string;
    body: string;
    pageUrl?: string;
}

export interface SendMessageResult {
    message: MessageItem;
    duplicate: boolean;
    conversation: ReturnType<typeof toConversationResult>;
}

/*
  The only way a message is written. In one transaction:
  1. A visitor's first message creates their conversation. `ON CONFLICT DO NOTHING` on the unique
     visitorId means two tabs sending a first message at once share one conversation.
  2. The conversation row is locked (`FOR UPDATE`). Every send to it — including two retries of the
     same message — queues here, so what follows runs one at a time per conversation.
  3. Idempotency: if this clientMessageId is already stored, return that message ("sent twice" = one).
  4. Take the next seq with `lastSeq + 1 … RETURNING`, so order is gap-free; a visitor writing to a
     resolved conversation reopens it to the last agent.
  5. Insert the message with that seq.
  The socket events (`announceMessage`) go out only after the commit, whichever route the message took.
 */
export const sendMessageService = async (params: SendMessageParams): Promise<SendMessageResult> => {
    const { workspaceId, visitorId, senderType, senderMemberId, clientMessageId, body, pageUrl } = params;
    const isVisitor = senderType === "visitor";

    const result = await withPgTransaction(async (client) => {
        if (isVisitor) {
            await client.query(
                `INSERT INTO "public"."conversation" ("id", "workspaceId", "visitorId")
                 VALUES ($1, $2, $3)
                 ON CONFLICT ("visitorId") DO NOTHING`,
                [crypto.randomUUID(), workspaceId, visitorId]
            );
        }

        // A visitor can only reach their own conversation; an agent any conversation of their workspace.
        const locked = isVisitor
            ? await client.query<ConversationRow>(
                  `SELECT ${CONVERSATION_RETURNING} FROM "public"."conversation"
                    WHERE "workspaceId" = $1 AND "visitorId" = $2 AND ($3::uuid IS NULL OR "id" = $3)
                      FOR UPDATE`,
                  [workspaceId, visitorId, params.conversationId ?? null]
              )
            : await client.query<ConversationRow>(
                  `SELECT ${CONVERSATION_RETURNING} FROM "public"."conversation"
                    WHERE "workspaceId" = $1 AND "id" = $2
                      FOR UPDATE`,
                  [workspaceId, params.conversationId]
              );
        const conversation = locked.rows[0];
        appAssert(conversation, NOT_FOUND, "Conversation not found");

        const existing = await client.query<MessageItem>(
            `${MESSAGE_SELECT} WHERE m."conversationId" = $1 AND m."clientMessageId" = $2`,
            [conversation.id, clientMessageId]
        );
        if (existing.rows[0]) {
            return { message: toMessage(existing.rows[0]), duplicate: true, conversation: toConversationResult(conversation) };
        }

        const updated = await client.query<ConversationRow & { lastSeq: number }>(
            `UPDATE "public"."conversation"
                SET "lastSeq" = "lastSeq" + 1,
                    "lastMessageAt" = now(),
                    "lastMessagePreview" = left($1, 120),
                    "updatedAt" = now(),
                    "status" = CASE WHEN "status" = 'resolved' AND $2 = 'visitor'
                                    THEN (CASE WHEN "lastAssigneeId" IS NULL THEN 'unassigned' ELSE 'assigned' END)
                                    ELSE "status" END,
                    "assigneeId" = CASE WHEN "status" = 'resolved' AND $2 = 'visitor'
                                        THEN "lastAssigneeId" ELSE "assigneeId" END,
                    "resolvedAt" = CASE WHEN "status" = 'resolved' AND $2 = 'visitor'
                                        THEN NULL ELSE "resolvedAt" END,
                    "visitorLastReadSeq" = CASE WHEN $2 = 'visitor' THEN "lastSeq" + 1 ELSE "visitorLastReadSeq" END,
                    "agentLastReadSeq" = CASE WHEN $2 = 'agent' THEN "lastSeq" + 1 ELSE "agentLastReadSeq" END,
                    "firstAgentReplyAt" = CASE WHEN $2 = 'agent' AND "firstAgentReplyAt" IS NULL
                                               THEN now() ELSE "firstAgentReplyAt" END
              WHERE "id" = $3
          RETURNING ${CONVERSATION_RETURNING}, "lastSeq"`,
            [body, senderType, conversation.id]
        );
        const { lastSeq, ...conversationRow } = updated.rows[0]!;

        const inserted = await client.query<{ id: string }>(
            `INSERT INTO "public"."message"
                ("id", "workspaceId", "conversationId", "seq", "clientMessageId", "senderType", "senderMemberId", "body")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING "id"`,
            [crypto.randomUUID(), workspaceId, conversation.id, lastSeq, clientMessageId, senderType, senderMemberId ?? null, body]
        );
        const message = await client.query<MessageItem>(`${MESSAGE_SELECT} WHERE m."id" = $1`, [inserted.rows[0]!.id]);

        if (isVisitor && pageUrl) {
            await client.query(
                `UPDATE "public"."visitor" SET "lastPageUrl" = $1, "lastSeenAt" = now()
                  WHERE "id" = $2 AND "workspaceId" = $3`,
                [pageUrl, visitorId, workspaceId]
            );
        }

        return { message: toMessage(message.rows[0]!), duplicate: false, conversation: toConversationResult(conversationRow) };
    });

    // After the commit: Postgres has decided, now the sockets deliver. A duplicate was announced the first time.
    if (!result.duplicate) {
        void incrementDeliveredMessagesCount();
        announceMessage(workspaceId, result);
        if (!isVisitor) void emailOfflineVisitor(workspaceId, result);
    }
    return result;
};

export const getConversationMessagesService = async (params: {
    workspaceId: string;
    conversationId: string;
    beforeSeq?: number;
    afterSeq?: number;
    limit?: number;
}): Promise<MessageItem[]> => {
    const { workspaceId, conversationId, beforeSeq, afterSeq, limit = 50 } = params;

    const conversation = await orm.Conversation.where({ id: conversationId, workspaceId }).select("id").first();
    appAssert(conversation, NOT_FOUND, "Conversation not found");

    // Forward from `afterSeq` (catch-up), otherwise the newest page before `beforeSeq` (history),
    // fetched newest-first and returned oldest-first. Always ordered by seq, never createdAt.
    if (afterSeq !== undefined) {
        const { rows } = await pool.query<MessageItem>(
            `${MESSAGE_SELECT}
              WHERE m."conversationId" = $1 AND m."workspaceId" = $2 AND m."seq" > $3
              ORDER BY m."seq" ASC
              LIMIT $4`,
            [conversationId, workspaceId, afterSeq, limit]
        );
        return rows.map(toMessage);
    }

    const { rows } = await pool.query<MessageItem>(
        `${MESSAGE_SELECT}
          WHERE m."conversationId" = $1 AND m."workspaceId" = $2 AND ($3::int IS NULL OR m."seq" < $3)
          ORDER BY m."seq" DESC
          LIMIT $4`,
        [conversationId, workspaceId, beforeSeq ?? null, limit]
    );
    return rows.map(toMessage).reverse();
};

// The visitor's own conversation only — found through the visitorId in their token.
export const getVisitorMessagesService = async (params: {
    workspaceId: string;
    visitorId: string;
    afterSeq?: number;
    limit?: number;
}): Promise<MessageItem[]> => {
    const { workspaceId, visitorId, afterSeq = 0, limit = 50 } = params;

    const { rows } = await pool.query<MessageItem>(
        `${MESSAGE_SELECT}
          JOIN "public"."conversation" c ON c."id" = m."conversationId" AND c."workspaceId" = m."workspaceId"
          WHERE c."visitorId" = $1 AND m."workspaceId" = $2 AND m."seq" > $3
          ORDER BY m."seq" ASC
          LIMIT $4`,
        [visitorId, workspaceId, afterSeq, limit]
    );
    return rows.map(toMessage);
};

/*
  Reconnect catch-up: for each conversation the client names, everything newer than the last `seq` it
  holds, oldest first, at most SYNC_PAGE_SIZE per conversation (`hasMore` tells the client to ask
  again from the last seq it received). A conversation that is missing, from another workspace, or —
  for a visitor — not theirs, simply comes back empty, so a sync never reveals which ids exist.
 */
export const syncMessagesService = async (params: {
    workspaceId: string;
    visitorId?: string;
    conversations: ClientSyncSchema["conversations"];
}) => {
    const { workspaceId, visitorId, conversations } = params;
    const messages: Record<string, MessageItem[]> = {};
    const hasMore: Record<string, boolean> = {};

    await Promise.all(
        conversations.map(async ({ id, lastSeq }) => {
            const { rows } = await pool.query<MessageItem>(
                `${MESSAGE_SELECT}
                  JOIN "public"."conversation" c ON c."id" = m."conversationId" AND c."workspaceId" = m."workspaceId"
                  WHERE c."id" = $1 AND c."workspaceId" = $2 AND ($3::uuid IS NULL OR c."visitorId" = $3)
                    AND m."seq" > $4
                  ORDER BY m."seq" ASC
                  LIMIT $5`,
                [id, workspaceId, visitorId ?? null, lastSeq, SYNC_PAGE_SIZE + 1]
            );
            hasMore[id] = rows.length > SYNC_PAGE_SIZE;
            messages[id] = rows.slice(0, SYNC_PAGE_SIZE).map(toMessage);
        })
    );

    return { messages, hasMore };
};
