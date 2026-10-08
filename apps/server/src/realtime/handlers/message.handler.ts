import { clientSendMessageSchema, type SendMessageAck } from "@repo/types";
import { getDefaultStore } from "../../middleware/rateLimiter.js";
import {
    FIVE_MINUTES_MS,
    DEMO_MESSAGE_LIMIT,
    ONE_MINUTE_MS,
    PROTECTED_API_LIMIT,
    PROTECTED_API_PREFIX,
    WIDGET_MESSAGE_LIMIT,
    WIDGET_MESSAGE_PREFIX
} from "../../constants/rateLimiter.constant.js";
import { NOT_FOUND } from "../../constants/http.js";
import { AppError } from "../../utils/errors/index.js";
import { sendMessageService } from "../../services/message.service.js";
import { convRoom } from "../rooms.js";
import { reply } from "./ack.js";
import type { AppSocket } from "../../types/socket.d.js";

export async function handleSendMessage(
    socket: AppSocket,
    data: unknown,
    ack?: (response: SendMessageAck) => void
): Promise<void> {
    try {
        const parsed = clientSendMessageSchema.safeParse(data);
        if (!parsed.success) return reply(ack, { ok: false, error: "VALIDATION_ERROR" });

        const sender = socket.data;
        const { workspaceId } = sender;

        // The same budget as the HTTP routes, taken straight from the Redis store.
        // A demo workspace gets a lower budget for everyone in it (the demo is public).
        const [key, windowMs, max] = sender.isDemo
            ? [`demo:message:${sender.kind === "visitor" ? sender.visitorId : sender.memberId}`, ONE_MINUTE_MS, DEMO_MESSAGE_LIMIT]
            : sender.kind === "visitor"
              ? [`${WIDGET_MESSAGE_PREFIX}:visitor:${sender.visitorId}`, ONE_MINUTE_MS, WIDGET_MESSAGE_LIMIT]
              : [`${PROTECTED_API_PREFIX}:member:${sender.memberId}`, FIVE_MINUTES_MS, PROTECTED_API_LIMIT];
        const limit = await getDefaultStore().increment(key, windowMs, max);
        if (!limit.allowed) {
            const retryAfter = Math.max(1, Math.ceil(((limit.resetTimeMs ?? Date.now() + windowMs) - Date.now()) / 1000));
            return reply(ack, { ok: false, error: "RATE_LIMITED", retryAfter });
        }

        const { message, duplicate } = await sendMessageService({
            workspaceId,
            conversationId: parsed.data.conversationId,
            visitorId: sender.kind === "visitor" ? sender.visitorId : undefined,
            senderType: sender.kind,
            senderMemberId: sender.kind === "agent" ? sender.memberId : undefined,
            clientMessageId: parsed.data.clientMessageId,
            body: parsed.data.body,
            pageUrl: parsed.data.pageUrl
        });

        // A visitor's first message creates their conversation; their socket joins it now.
        if (sender.kind === "visitor") void socket.join(convRoom(message.conversationId));

        reply(ack, { ok: true, duplicate, message });
    } catch (error) {
        if (error instanceof AppError && error.statusCode === NOT_FOUND) return reply(ack, { ok: false, error: "NOT_FOUND" });
        console.error("[Socket] message:send failed:", error);
        reply(ack, { ok: false, error: "INTERNAL_ERROR" });
    }
}
