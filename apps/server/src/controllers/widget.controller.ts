import {
    createWidgetSessionSchema,
    messageHistoryQuerySchema,
    sendVisitorMessageSchema,
    updateVisitorProfileSchema
} from "@repo/types";
import { catchError } from "../utils/errors/catchError.js";
import {
    getOrCreateVisitorSessionService,
    updateVisitorProfileService
} from "../services/visitor.service.js";
import {
    getVisitorMessagesService,
    sendMessageService
} from "../services/message.service.js";
import { CREATED, OK } from "../constants/http.js";
import { ok } from "../utils/api/index.js";

export const postWidgetSessionHandler = catchError(async (req, res) => {
    const data = createWidgetSessionSchema.parse(req.body);
    const result = await getOrCreateVisitorSessionService(data);
    return res.status(OK).json(ok(result));
});

export const getWidgetMessagesHandler = catchError(async (req, res) => {
    const { afterSeq, limit } = messageHistoryQuerySchema.parse(req.query);

    const messages = await getVisitorMessagesService({
        workspaceId: req.workspaceId,
        visitorId: req.visitorId!,
        afterSeq,
        limit,
    });

    return res.status(OK).json(ok({ messages }));
});

export const postWidgetMessageHandler = catchError(async (req, res) => {
    const data = sendVisitorMessageSchema.parse(req.body);

    const result = await sendMessageService({
        workspaceId: req.workspaceId,
        visitorId: req.visitorId!,
        senderType: "visitor",
        clientMessageId: data.clientMessageId,
        body: data.body,
        pageUrl: data.pageUrl,
    });

    return res.status(CREATED).json(ok(result));
});

export const patchVisitorProfileHandler = catchError(async (req, res) => {
    const data = updateVisitorProfileSchema.parse(req.body);

    const visitor = await updateVisitorProfileService(
        req.workspaceId,
        req.visitorId!,
        data
    );

    return res.status(OK).json(ok({ visitor }));
});
