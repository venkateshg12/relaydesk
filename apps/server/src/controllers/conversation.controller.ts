import z from "zod";
import {
    listConversationsQuerySchema,
    messageHistoryQuerySchema,
    sendAgentMessageSchema
} from "@repo/types";
import { catchError } from "../utils/errors/catchError.js";
import {
    listConversationsService,
    getConversationDetailsService,
    assignConversationService,
    unassignConversationService,
    resolveConversationService,
    reopenConversationService,
    getConversationCountsService,
} from "../services/conversation.service.js";
import {
    getConversationMessagesService,
    sendMessageService
} from "../services/message.service.js";
import { CREATED, OK } from "../constants/http.js";
import { ok } from "../utils/api/index.js";

const idSchema = z.string().uuid({ message: "Invalid conversation id" });

export const listConversationsHandler = catchError(async (req, res) => {
    const query = listConversationsQuerySchema.parse(req.query);

    const result = await listConversationsService({
        workspaceId: req.workspaceId,
        memberId: req.memberId,
        status: query.status,
        mine: query.mine,
        page: query.page,
        limit: query.limit,
    });

    return res.status(OK).json(ok(result));
});

export const getConversationDetailsHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);

    const result = await getConversationDetailsService({
        workspaceId: req.workspaceId,
        conversationId: id,
    });

    return res.status(OK).json(ok(result));
});

export const getConversationMessagesHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const query = messageHistoryQuerySchema.parse(req.query);

    const messages = await getConversationMessagesService({
        workspaceId: req.workspaceId,
        conversationId: id,
        ...query,
    });

    return res.status(OK).json(ok({ messages }));
});

export const postConversationMessageHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const data = sendAgentMessageSchema.parse(req.body);

    const result = await sendMessageService({
        workspaceId: req.workspaceId,
        conversationId: id,
        senderType: "agent",
        senderMemberId: req.memberId,
        clientMessageId: data.clientMessageId,
        body: data.body,
    });

    return res.status(CREATED).json(ok(result));
});

export const assignConversationHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const memberId = req.body?.memberId ? z.string().uuid().parse(req.body.memberId) : undefined;

    const conversation = await assignConversationService({
        workspaceId: req.workspaceId,
        conversationId: id,
        memberId: req.memberId,
        targetMemberId: memberId,
    });

    return res.status(OK).json(ok({ conversation }));
});

export const unassignConversationHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);

    const conversation = await unassignConversationService({
        workspaceId: req.workspaceId,
        conversationId: id,
    });

    return res.status(OK).json(ok({ conversation }));
});

export const resolveConversationHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);

    const conversation = await resolveConversationService({
        workspaceId: req.workspaceId,
        conversationId: id,
    });

    return res.status(OK).json(ok({ conversation }));
});

export const reopenConversationHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);

    const conversation = await reopenConversationService({
        workspaceId: req.workspaceId,
        conversationId: id,
        memberId: req.memberId,
    });

    return res.status(OK).json(ok({ conversation }));
});

export const getConversationCountsHandler = catchError(async (req, res) => {
    const counts = await getConversationCountsService({
        workspaceId: req.workspaceId,
        memberId: req.memberId,
    });

    return res.status(OK).json(ok(counts));
});
