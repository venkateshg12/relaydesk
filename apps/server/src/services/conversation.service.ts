import type {
    ConversationDetail,
    ConversationSummary,
    ConversationListStatus,
    PaginatedResult
} from "@repo/types";
import { pool } from "../config/db.js";
import { appErrorCode } from "../constants/appErrorCode.js";
import { appAssert } from "../utils/errors/index.js";
import { CONFLICT, NOT_FOUND } from "../constants/http.js";
import { getConversationMessagesService } from "./message.service.js";
import { emitConversationAssigned, emitConversationUpdated } from "../realtime/emit.js";

// One SELECT and one mapper for list rows and the open conversation, so both always agree.
const CONVERSATION_SELECT = `
    SELECT c."id", c."workspaceId", c."visitorId", c."status", c."assigneeId", c."lastAssigneeId",
           c."lastSeq", c."lastMessageAt", c."lastMessagePreview", c."visitorLastReadSeq",
           c."agentLastReadSeq", c."createdAt", c."updatedAt",
           v."displayNo" AS "visitorDisplayNo", v."name" AS "visitorName", v."email" AS "visitorEmail",
           v."lastPageUrl" AS "visitorLastPageUrl", v."firstSeenAt" AS "visitorFirstSeenAt",
           m."name" AS "assigneeName"
      FROM "public"."conversation" c
      JOIN "public"."visitor" v ON v."id" = c."visitorId" AND v."workspaceId" = c."workspaceId"
      LEFT JOIN "public"."member" m ON m."id" = c."assigneeId" AND m."workspaceId" = c."workspaceId"`;

const iso = (value: Date | string) => new Date(value).toISOString();

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a raw pg row of CONVERSATION_SELECT
const toConversationSummary = (r: any): ConversationSummary => ({
    id: r.id,
    workspaceId: r.workspaceId,
    visitorId: r.visitorId,
    status: r.status,
    assigneeId: r.assigneeId,
    lastAssigneeId: r.lastAssigneeId,
    lastSeq: r.lastSeq,
    lastMessageAt: r.lastMessageAt ? iso(r.lastMessageAt) : null,
    lastMessagePreview: r.lastMessagePreview,
    visitorLastReadSeq: r.visitorLastReadSeq,
    agentLastReadSeq: r.agentLastReadSeq,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    visitor: {
        id: r.visitorId,
        displayNo: r.visitorDisplayNo,
        name: r.visitorName,
        email: r.visitorEmail,
        lastPageUrl: r.visitorLastPageUrl,
        firstSeenAt: iso(r.visitorFirstSeenAt),
    },
    assignee: r.assigneeId ? { id: r.assigneeId, name: r.assigneeName } : null,
});

// Tells every agent's list (and the visitor's widget) which row changed, after the update committed.
const announce = (workspaceId: string, c: ConversationSummary) =>
    emitConversationUpdated(workspaceId, {
        id: c.id,
        visitorId: c.visitorId,
        status: c.status,
        assigneeId: c.assigneeId,
        assignee: c.assignee ?? null,
        lastMessageAt: c.lastMessageAt,
        preview: c.lastMessagePreview,
    });

export interface ListConversationsParams {
    workspaceId: string;
    memberId: string;
    status?: ConversationListStatus;
    mine?: boolean;
    page: number;
    limit: number;
}

// The inbox lists: newest message first, paged. Same shape as e-commerce's listProductsService —
// the page and the total side by side, `hasMore` from the two.
export const listConversationsService = async ({
    workspaceId,
    memberId,
    status,
    mine,
    page,
    limit,
}: ListConversationsParams): Promise<PaginatedResult<ConversationSummary>> => {
    const filters = [workspaceId, status ?? null, mine ? memberId : null];
    const where = `WHERE c."workspaceId" = $1
                     AND ($2::text IS NULL OR c."status" = $2 OR ($2 = 'open' AND c."status" <> 'resolved'))
                     AND ($3::uuid IS NULL OR c."assigneeId" = $3)`;

    const [rowsResult, countResult] = await Promise.all([
        pool.query(
            `${CONVERSATION_SELECT} ${where}
              ORDER BY c."lastMessageAt" DESC NULLS LAST, c."id" DESC
              LIMIT $4 OFFSET $5`,
            [...filters, limit, (page - 1) * limit]
        ),
        pool.query<{ total: number }>(`SELECT count(*)::int AS "total" FROM "public"."conversation" c ${where}`, filters),
    ]);

    const total = countResult.rows[0]?.total ?? 0;
    return {
        items: rowsResult.rows.map(toConversationSummary),
        meta: { page, limit, total, hasMore: page * limit < total },
    };
};

export const getConversationDetailsService = async ({
    workspaceId,
    conversationId,
}: {
    workspaceId: string;
    conversationId: string;
}): Promise<ConversationDetail> => {
    const { rows } = await pool.query(`${CONVERSATION_SELECT} WHERE c."id" = $1 AND c."workspaceId" = $2`, [
        conversationId,
        workspaceId,
    ]);
    appAssert(rows[0], NOT_FOUND, "Conversation not found");

    const messages = await getConversationMessagesService({ workspaceId, conversationId, limit: 50 });
    return { ...toConversationSummary(rows[0]), messages };
};

// Every state change is one UPDATE guarded by the state it expects (the same pattern as "Assign to me"):
// Postgres row-locks the conversation, so of two simultaneous clicks the first matches and the second
// matches nothing. This explains a miss: the conversation isn't there (404) or someone changed it first (409).
const explainNoMatch = async (workspaceId: string, conversationId: string, conflict: { message: string; code?: appErrorCode }) => {
    const { rows } = await pool.query<{ assigneeName: string | null }>(
        `SELECT m."name" AS "assigneeName"
           FROM "public"."conversation" c
           LEFT JOIN "public"."member" m ON m."id" = c."assigneeId" AND m."workspaceId" = c."workspaceId"
          WHERE c."id" = $1 AND c."workspaceId" = $2`,
        [conversationId, workspaceId]
    );
    appAssert(rows[0], NOT_FOUND, "Conversation not found");
    appAssert(false, CONFLICT, conflict.message.replace("{assignee}", rows[0].assigneeName ?? "another agent"), conflict.code);
};

export const assignConversationService = async (params: {
    workspaceId: string;
    conversationId: string;
    memberId: string;
    targetMemberId?: string;
}): Promise<ConversationSummary> => {
    const { workspaceId, conversationId, memberId, targetMemberId } = params;
    // No `memberId` = "Assign to me", which only takes a free conversation. Naming a member (even oneself, to take
    // over from a colleague) is a hand-over, which works on anything not resolved.
    const isHandOver = targetMemberId !== undefined;
    const assigneeId = targetMemberId ?? memberId;

    if (isHandOver) {
        const target = await pool.query(
            `SELECT 1 FROM "public"."member" WHERE "id" = $1 AND "workspaceId" = $2 AND "status" = 'active'`,
            [assigneeId, workspaceId]
        );
        appAssert(target.rows.length > 0, NOT_FOUND, "Target agent not found or inactive");
    }

    // "Assign to me" only takes a conversation nobody has; handing over works on anything not resolved.
    const { rowCount } = await pool.query(
        `UPDATE "public"."conversation"
            SET "assigneeId" = $1, "lastAssigneeId" = $1, "status" = 'assigned', "updatedAt" = now()
          WHERE "id" = $2 AND "workspaceId" = $3
            AND ("status" = 'unassigned' OR ($4 AND "status" = 'assigned'))`,
        [assigneeId, conversationId, workspaceId, isHandOver]
    );
    if (!rowCount) {
        await explainNoMatch(
            workspaceId,
            conversationId,
            isHandOver
                ? { message: "A resolved conversation can't be handed over. Reopen it first." }
                : { message: "Already taken by {assignee}", code: appErrorCode.ConversationTaken }
        );
    }

    const details = await getConversationDetailsService({ workspaceId, conversationId });
    announce(workspaceId, details);
    if (isHandOver && assigneeId !== memberId) emitConversationAssigned(assigneeId, conversationId, memberId);
    return details;
};

export const unassignConversationService = async (params: {
    workspaceId: string;
    conversationId: string;
}): Promise<ConversationSummary> => {
    const { workspaceId, conversationId } = params;

    const { rowCount } = await pool.query(
        `UPDATE "public"."conversation"
            SET "assigneeId" = NULL, "status" = 'unassigned', "updatedAt" = now()
          WHERE "id" = $1 AND "workspaceId" = $2 AND "status" = 'assigned'`,
        [conversationId, workspaceId]
    );
    if (!rowCount) await explainNoMatch(workspaceId, conversationId, { message: "This conversation isn't assigned to anyone" });

    const details = await getConversationDetailsService({ workspaceId, conversationId });
    announce(workspaceId, details);
    return details;
};

export const resolveConversationService = async (params: {
    workspaceId: string;
    conversationId: string;
}): Promise<ConversationSummary> => {
    const { workspaceId, conversationId } = params;

    // `lastAssigneeId` remembers who had it, so a visitor writing again reopens it to the same agent.
    const { rowCount } = await pool.query(
        `UPDATE "public"."conversation"
            SET "status" = 'resolved', "resolvedAt" = now(),
                "lastAssigneeId" = COALESCE("assigneeId", "lastAssigneeId"),
                "assigneeId" = NULL, "updatedAt" = now()
          WHERE "id" = $1 AND "workspaceId" = $2 AND "status" <> 'resolved'`,
        [conversationId, workspaceId]
    );
    if (!rowCount) await explainNoMatch(workspaceId, conversationId, { message: "This conversation is already resolved" });

    const details = await getConversationDetailsService({ workspaceId, conversationId });
    announce(workspaceId, details);
    return details;
};

export const reopenConversationService = async (params: {
    workspaceId: string;
    conversationId: string;
    memberId: string;
}): Promise<ConversationSummary> => {
    const { workspaceId, conversationId, memberId } = params;

    // Back to the agent who had it — unless they have left the team, then to whoever reopens it.
    const { rowCount } = await pool.query(
        `UPDATE "public"."conversation"
            SET "status" = 'assigned',
                "assigneeId" = COALESCE(
                    (SELECT m."id" FROM "public"."member" m
                      WHERE m."id" = "lastAssigneeId" AND m."workspaceId" = $3 AND m."status" = 'active'),
                    $1),
                "resolvedAt" = NULL, "updatedAt" = now()
          WHERE "id" = $2 AND "workspaceId" = $3 AND "status" = 'resolved'`,
        [memberId, conversationId, workspaceId]
    );
    if (!rowCount) await explainNoMatch(workspaceId, conversationId, { message: "This conversation isn't resolved" });

    const details = await getConversationDetailsService({ workspaceId, conversationId });
    announce(workspaceId, details);
    return details;
};

export const getConversationCountsService = async (params: {
    workspaceId: string;
    memberId: string;
}): Promise<{
    unassigned: number;
    mine: number;
    allOpen: number;
    resolved: number;
    unreadMine: number;
    unreadUnassigned: number;
}> => {
    const { workspaceId, memberId } = params;

    const countsQuery = `
        SELECT
            COUNT(*) FILTER (WHERE "status" = 'unassigned')::int AS "unassigned",
            COUNT(*) FILTER (WHERE "status" = 'assigned' AND "assigneeId" = $2)::int AS "mine",
            COUNT(*) FILTER (WHERE "status" IN ('unassigned', 'assigned'))::int AS "allOpen",
            COUNT(*) FILTER (WHERE "status" = 'resolved')::int AS "resolved",
            COALESCE(SUM(GREATEST(0, "lastSeq" - "agentLastReadSeq")) FILTER (WHERE "status" = 'assigned' AND "assigneeId" = $2), 0)::int AS "unreadMine",
            COALESCE(SUM(GREATEST(0, "lastSeq" - "agentLastReadSeq")) FILTER (WHERE "status" = 'unassigned'), 0)::int AS "unreadUnassigned"
        FROM "public"."conversation"
        WHERE "workspaceId" = $1
    `;

    const res = await pool.query(countsQuery, [workspaceId, memberId]);
    const r = res.rows[0];

    return {
        unassigned: r?.unassigned ?? 0,
        mine: r?.mine ?? 0,
        allOpen: r?.allOpen ?? 0,
        resolved: r?.resolved ?? 0,
        unreadMine: r?.unreadMine ?? 0,
        unreadUnassigned: r?.unreadUnassigned ?? 0,
    };
};
