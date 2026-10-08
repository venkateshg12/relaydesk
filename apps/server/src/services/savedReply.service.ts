import type { CreateSavedReplySchema, SavedReplyItem, UpdateSavedReplySchema } from "@repo/types";
import { orm } from "../config/db.js";
import { appAssert } from "../utils/errors/index.js";
import { NOT_FOUND } from "../constants/http.js";
import { withDuplicateGuard } from "../utils/db/pgErrors.js";

// Shortcuts are stored lower-case and unique per workspace: the unique index on `lower(shortcut)` is the
// rule, and `withDuplicateGuard` turns its violation into the 409 — no "check, then insert" race.
const taken = (shortcut: string) => `Shortcut "${shortcut}" already exists`;

const toItem = (row: {
    id: string;
    workspaceId: string;
    title: string;
    shortcut: string;
    body: string;
    createdById: string;
    createdAt: string | Date;
    updatedAt: string | Date;
}, createdBy: SavedReplyItem["createdBy"]): SavedReplyItem => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    createdBy,
});

export const listSavedRepliesService = async (workspaceId: string): Promise<SavedReplyItem[]> => {
    const rows = await orm.SavedReply.where({ workspaceId })
        .include("createdBy", (member) => member.select("id", "name"))
        .orderBy((reply) => reply.shortcut.asc())
        .all();
    return rows.map(({ createdBy, ...row }) => toItem(row, createdBy));
};

// Who wrote it, for the table. A reply always has a creator in the same workspace (composite foreign key).
const creatorOf = (workspaceId: string, memberId: string) =>
    orm.Member.where({ id: memberId, workspaceId }).select("id", "name").first();

export const createSavedReplyService = async (params: {
    workspaceId: string;
    createdById: string;
    data: CreateSavedReplySchema;
}): Promise<SavedReplyItem> => {
    const { workspaceId, createdById, data } = params;
    const shortcut = data.shortcut.toLowerCase();

    const created = await withDuplicateGuard(taken(shortcut), () =>
        orm.SavedReply.create({ workspaceId, createdById, title: data.title, shortcut, body: data.body })
    );
    return toItem(created, (await creatorOf(workspaceId, createdById)) ?? null);
};

export const updateSavedReplyService = async (params: {
    workspaceId: string;
    id: string;
    data: UpdateSavedReplySchema;
}): Promise<SavedReplyItem> => {
    const { workspaceId, id, data } = params;
    const shortcut = data.shortcut?.toLowerCase();

    const updated = await withDuplicateGuard(taken(shortcut ?? ""), () =>
        orm.SavedReply.where({ id, workspaceId }).update({
            ...(data.title !== undefined && { title: data.title }),
            ...(shortcut !== undefined && { shortcut }),
            ...(data.body !== undefined && { body: data.body }),
            updatedAt: new Date().toISOString(),
        })
    );
    appAssert(updated, NOT_FOUND, "Saved reply not found");
    return toItem(updated, (await creatorOf(workspaceId, updated.createdById)) ?? null);
};

export const deleteSavedReplyService = async (params: { workspaceId: string; id: string }): Promise<void> => {
    const deleted = await orm.SavedReply.where({ id: params.id, workspaceId: params.workspaceId }).delete();
    appAssert(deleted, NOT_FOUND, "Saved reply not found");
};
