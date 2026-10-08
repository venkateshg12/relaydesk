import { updateWidgetSettingsSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError.js";
import {
    getWorkspaceSettingsService,
    updateWorkspaceWidgetService,
} from "../services/workspace.service.js";
import { OK } from "../constants/http.js";
import { ok } from "../utils/api/index.js";

export const getWorkspaceSettingsHandler = catchError(async (req, res) => {
    const settings = await getWorkspaceSettingsService(req.workspaceId);
    return res.status(OK).json(ok({ settings }));
});

export const patchWorkspaceWidgetHandler = catchError(async (req, res) => {
    const data = updateWidgetSettingsSchema.parse(req.body);

    const workspace = await updateWorkspaceWidgetService({
        workspaceId: req.workspaceId,
        data,
    });

    return res.status(OK).json(ok({ workspace }));
});
