import z from "zod";
import {
    createSavedReplySchema,
    updateSavedReplySchema,
} from "@repo/types";
import { catchError } from "../utils/errors/catchError.js";
import {
    listSavedRepliesService,
    createSavedReplyService,
    updateSavedReplyService,
    deleteSavedReplyService,
} from "../services/savedReply.service.js";
import { CREATED, OK } from "../constants/http.js";
import { ok } from "../utils/api/index.js";

const idSchema = z.string().uuid({ message: "Invalid saved reply id" });

export const listSavedRepliesHandler = catchError(async (req, res) => {
    const savedReplies = await listSavedRepliesService(req.workspaceId);
    return res.status(OK).json(ok({ savedReplies }));
});

export const postSavedReplyHandler = catchError(async (req, res) => {
    const data = createSavedReplySchema.parse(req.body);

    const savedReply = await createSavedReplyService({
        workspaceId: req.workspaceId,
        createdById: req.memberId,
        data,
    });

    return res.status(CREATED).json(ok({ savedReply }));
});

export const patchSavedReplyHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const data = updateSavedReplySchema.parse(req.body);

    const savedReply = await updateSavedReplyService({
        workspaceId: req.workspaceId,
        id,
        data,
    });

    return res.status(OK).json(ok({ savedReply }));
});

export const deleteSavedReplyHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);

    await deleteSavedReplyService({
        workspaceId: req.workspaceId,
        id,
    });

    return res.status(OK).json(ok({ message: "Saved reply deleted" }));
});
