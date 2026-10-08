import crypto from "crypto";
import type { NoteItem, CreateNoteSchema } from "@repo/types";
import { pool } from "../config/db.js";
import { appAssert } from "../utils/errors/index.js";
import { NOT_FOUND } from "../constants/http.js";
import { getIo } from "../realtime/emit.js";
import { wsRoom } from "../realtime/rooms.js";

export const listNotesService = async (params: {
    workspaceId: string;
    conversationId: string;
}): Promise<NoteItem[]> => {
    const { workspaceId, conversationId } = params;

    // Verify conversation belongs to workspace
    const convCheck = await pool.query(
        `SELECT "id" FROM "public"."conversation" WHERE "id" = $1 AND "workspaceId" = $2`,
        [conversationId, workspaceId]
    );
    appAssert(convCheck.rows.length > 0, NOT_FOUND, "Conversation not found");

    const query = `
        SELECT
            n."id",
            n."workspaceId",
            n."conversationId",
            n."authorId",
            n."body",
            n."createdAt",
            m."name" as "authorName",
            m."email" as "authorEmail"
        FROM "public"."note" n
        INNER JOIN "public"."member" m ON m."id" = n."authorId" AND m."workspaceId" = n."workspaceId"
        WHERE n."conversationId" = $1 AND n."workspaceId" = $2
        ORDER BY n."createdAt" ASC
    `;

    const result = await pool.query(query, [conversationId, workspaceId]);

    return result.rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        conversationId: r.conversationId,
        authorId: r.authorId,
        body: r.body,
        createdAt: new Date(r.createdAt).toISOString(),
        author: {
            id: r.authorId,
            name: r.authorName,
            email: r.authorEmail,
        },
    }));
};

export const createNoteService = async (params: {
    workspaceId: string;
    conversationId: string;
    authorId: string;
    data: CreateNoteSchema;
}): Promise<NoteItem> => {
    const { workspaceId, conversationId, authorId, data } = params;

    // Verify conversation belongs to workspace
    const convCheck = await pool.query(
        `SELECT "id" FROM "public"."conversation" WHERE "id" = $1 AND "workspaceId" = $2`,
        [conversationId, workspaceId]
    );
    appAssert(convCheck.rows.length > 0, NOT_FOUND, "Conversation not found");

    const authorCheck = await pool.query(
        `SELECT "id", "name", "email" FROM "public"."member" WHERE "id" = $1 AND "workspaceId" = $2`,
        [authorId, workspaceId]
    );
    appAssert(authorCheck.rows.length > 0, NOT_FOUND, "Author not found");
    const author = authorCheck.rows[0];

    const noteId = crypto.randomUUID();
    const result = await pool.query(
        `INSERT INTO "public"."note" ("id", "workspaceId", "conversationId", "authorId", "body", "createdAt")
         VALUES ($1, $2, $3, $4, $5, now())
         RETURNING "id", "workspaceId", "conversationId", "authorId", "body", "createdAt"`,
        [noteId, workspaceId, conversationId, authorId, data.body]
    );

    const r = result.rows[0];
    const note: NoteItem = {
        id: r.id,
        workspaceId: r.workspaceId,
        conversationId: r.conversationId,
        authorId: r.authorId,
        body: r.body,
        createdAt: new Date(r.createdAt).toISOString(),
        author: {
            id: author.id,
            name: author.name,
            email: author.email,
        },
    };

    // Note is an internal agent-only record: Emit note:new ONLY to workspace room ws:<workspaceId>
    // NEVER to visitor room or visitor socket!
    getIo()?.to(wsRoom(workspaceId)).emit("note:new", { note });

    return note;
};
