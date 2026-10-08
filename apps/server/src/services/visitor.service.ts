import crypto from "crypto";
import type {
    ConversationSummary,
    CreateWidgetSessionSchema,
    UpdateVisitorProfileSchema,
    VisitorSummary,
    WidgetSessionData
} from "@repo/types";
import { orm } from "../config/db.js";
import { appAssert } from "../utils/errors/index.js";
import { NOT_FOUND } from "../constants/http.js";
import { withPgTransaction } from "../utils/db/index.js";
import { signVisitorToken, verifyVisitorToken } from "../utils/auth/visitorToken.js";
import { cache } from "../utils/cache/index.js";
import { emitVisitorUpdated } from "../realtime/emit.js";

const WIDGET_CONFIG_CACHE_TTL_SECONDS = 300;

type VisitorRow = {
    id: string;
    displayNo: number;
    name: string | null;
    email: string | null;
    lastPageUrl: string | null;
    firstSeenAt: Date | string;
};

const toVisitorSummary = (v: VisitorRow): VisitorSummary => ({
    id: v.id,
    displayNo: v.displayNo,
    name: v.name,
    email: v.email,
    lastPageUrl: v.lastPageUrl,
    firstSeenAt: new Date(v.firstSeenAt).toISOString(),
});

// The visitor's one conversation (if they have written yet), in the same shape the inbox uses.
const findVisitorConversation = async (
    workspaceId: string,
    visitor: VisitorRow
): Promise<ConversationSummary | null> => {
    const conversation = await orm.Conversation.where({ visitorId: visitor.id, workspaceId }).first();
    if (!conversation) return null;

    const assignee = conversation.assigneeId
        ? await orm.Member.where({ id: conversation.assigneeId, workspaceId }).select("id", "name").first()
        : null;

    return {
        ...conversation,
        visitor: toVisitorSummary(visitor),
        assignee: assignee ?? null,
    };
};

/*
  The widget's first call. Resolves the workspace from its public key, then resumes the visitor in
  the token — or creates a new one. A missing, expired or invalid token, or one issued for another
  workspace, simply means "new visitor": the token is the only identity a visitor has.
 */
export const getOrCreateVisitorSessionService = async (
    data: CreateWidgetSessionSchema
): Promise<WidgetSessionData> => {
    const cacheKey = await cache.versionedKey(["widget"], data.publicKey);
    const workspace = await cache.getOrSet(
        cacheKey,
        async () =>
            (await orm.Workspace.where({ publicKey: data.publicKey })
                .select("id", "name", "widgetColor", "greeting", "awayMessage")
                .first()) ?? null,
        WIDGET_CONFIG_CACHE_TTL_SECONDS
    );
    appAssert(workspace, NOT_FOUND, "Workspace not found");

    const widget = {
        workspaceName: workspace.name,
        widgetColor: workspace.widgetColor,
        greeting: workspace.greeting,
        awayMessage: workspace.awayMessage,
    };

    const { payload } = data.visitorToken ? verifyVisitorToken(data.visitorToken) : {};
    if (payload && payload.workspaceId === workspace.id) {
        const visitor = await orm.Visitor
            .where({ id: payload.visitorId, workspaceId: workspace.id })
            .update({ lastSeenAt: new Date().toISOString() });

        if (visitor) {
            return {
                token: data.visitorToken!,
                visitor: toVisitorSummary(visitor),
                conversation: await findVisitorConversation(workspace.id, visitor),
                widget,
            };
        }
    }

    // "Visitor 1042": the number comes from the workspace counter in the same transaction as the
    // insert, so two visitors arriving at once can never get the same number.
    const visitor = await withPgTransaction(async (client) => {
        const counter = await client.query<{ lastVisitorNo: number }>(
            `UPDATE "public"."workspace" SET "lastVisitorNo" = "lastVisitorNo" + 1
              WHERE "id" = $1
          RETURNING "lastVisitorNo"`,
            [workspace.id]
        );
        const inserted = await client.query<VisitorRow>(
            `INSERT INTO "public"."visitor" ("id", "workspaceId", "displayNo")
             VALUES ($1, $2, $3)
             RETURNING "id", "displayNo", "name", "email", "lastPageUrl", "firstSeenAt"`,
            [crypto.randomUUID(), workspace.id, counter.rows[0]!.lastVisitorNo]
        );
        return inserted.rows[0]!;
    });

    return {
        token: signVisitorToken({ visitorId: visitor.id, workspaceId: workspace.id }),
        visitor: toVisitorSummary(visitor),
        conversation: null,
        widget,
    };
};

export const updateVisitorProfileService = async (
    workspaceId: string,
    visitorId: string,
    data: UpdateVisitorProfileSchema
): Promise<VisitorSummary> => {
    const { pageUrl, ...profile } = data;
    const visitor = await orm.Visitor
        .where({ id: visitorId, workspaceId })
        .update({ ...profile, ...(pageUrl && { lastPageUrl: pageUrl }), lastSeenAt: new Date().toISOString() });
    appAssert(visitor, NOT_FOUND, "Visitor not found");

    // After the commit: agents looking at this visitor see the new name, email or page at once.
    const summary = toVisitorSummary(visitor);
    emitVisitorUpdated(workspaceId, summary);
    return summary;
};
