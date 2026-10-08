import type { UpdateWidgetSettingsSchema, WidgetConfig } from "@repo/types";
import { orm } from "../config/db.js";
import { appAssert } from "../utils/errors/index.js";
import { NOT_FOUND } from "../constants/http.js";
import { cache } from "../utils/cache/index.js";
import { getIo } from "../realtime/emit.js";
import { wsRoom, wsVisitorsRoom } from "../realtime/rooms.js";

const SETTINGS_COLUMNS = ["id", "name", "publicKey", "widgetColor", "greeting", "awayMessage"] as const;

export const getWorkspaceSettingsService = async (workspaceId: string) => {
    const workspace = await orm.Workspace.where({ id: workspaceId })
        .select(...SETTINGS_COLUMNS, "createdAt")
        .first();
    appAssert(workspace, NOT_FOUND, "Workspace not found");
    return { ...workspace, createdAt: new Date(workspace.createdAt).toISOString() };
};

export const updateWorkspaceWidgetService = async (params: { workspaceId: string; data: UpdateWidgetSettingsSchema }) => {
    const { workspaceId, data } = params;

    // Only the fields that were sent (the schema has already trimmed them); `updatedAt` is ours to set.
    const changes = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    const updated = await orm.Workspace.where({ id: workspaceId }).update({
        ...changes,
        updatedAt: new Date().toISOString(),
    });
    appAssert(updated, NOT_FOUND, "Workspace not found");

    const widget: WidgetConfig = {
        workspaceName: updated.name,
        widgetColor: updated.widgetColor,
        greeting: updated.greeting,
        awayMessage: updated.awayMessage,
    };

    // After the write: the next widget session reads fresh settings, and widgets that are open right now
    // (and the agents' app) re-theme without a reload.
    await cache.bump("widget");
    getIo()?.to([wsRoom(workspaceId), wsVisitorsRoom(workspaceId)]).emit("workspace:updated", { widget });

    return Object.fromEntries(SETTINGS_COLUMNS.map((column) => [column, updated[column]])) as Pick<typeof updated, (typeof SETTINGS_COLUMNS)[number]>;
};
