import z from "zod";
import { NOT_FOUND, OK } from "../constants/http.js";
import { catchError } from "../utils/errors/catchError.js";
import { appAssert } from "../utils/errors/index.js";
import { ok } from "../utils/api/apiEnvelope.js";
import { listSessionsService, revokeSessions } from "../services/auth.service.js";

const sessionIdSchema = z.string().uuid({ message: "Invalid session id" });

export const getSessionHandler = catchError(async (req, res) => {
    const sessions = await listSessionsService(req.memberId, req.workspaceId, req.sessionId);
    return res.status(OK).json(ok(sessions));
});

export const deleteSessionHandler = catchError(async (req, res) => {
    const sessionId = sessionIdSchema.parse(req.params.id);
    const revoked = await revokeSessions({
        id: sessionId,
        memberId: req.memberId,
        workspaceId: req.workspaceId
    });
    appAssert(revoked, NOT_FOUND, "Session not found");
    return res.status(OK).json(ok({ message: "Session removed" }));
});
