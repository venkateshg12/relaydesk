import { clientConversationJoinSchema, clientConversationLeaveSchema, type JoinAck } from "@repo/types";
import { orm } from "../../config/db.js";
import { presence } from "../presence.js";
import { emitViewers } from "../emit.js";
import { convRoom } from "../rooms.js";
import { reply } from "./ack.js";
import type { AppSocket } from "../../types/socket.d.js";

// An agent opening a conversation: joins its room (typing, read marks) and shows up as a viewer.
export async function handleConversationJoin(socket: AppSocket, data: unknown, ack?: (response: JoinAck) => void): Promise<void> {
    const agent = socket.data;
    if (agent.kind !== "agent") return reply(ack, { ok: false, error: "FORBIDDEN" });

    const parsed = clientConversationJoinSchema.safeParse(data);
    if (!parsed.success) return reply(ack, { ok: false, error: "VALIDATION_ERROR" });
    const { conversationId } = parsed.data;

    try {
        const conversation = await orm.Conversation.where({ id: conversationId, workspaceId: agent.workspaceId }).select("id").first();
        if (!conversation) return reply(ack, { ok: false, error: "NOT_FOUND" });

        void socket.join(convRoom(conversationId));

        // Joining twice from one socket (a re-render, a reconnect replay) must not count as two tabs.
        if (!agent.viewing.has(conversationId)) {
            agent.viewing.add(conversationId);
            await presence.addViewer(conversationId, agent.memberId, agent.name);
        }
        const viewers = await presence.viewers(conversationId);

        emitViewers(agent.workspaceId, { conversationId, viewers });
        reply(ack, { ok: true, viewers });
    } catch (error) {
        console.error("[Socket] conversation:join failed:", error);
        reply(ack, { ok: false, error: "INTERNAL_ERROR" });
    }
}

export async function handleConversationLeave(socket: AppSocket, data: unknown): Promise<void> {
    const agent = socket.data;
    if (agent.kind !== "agent") return;

    const parsed = clientConversationLeaveSchema.safeParse(data);
    if (!parsed.success) return;

    await leaveConversation(socket, parsed.data.conversationId);
}

// Also called for every open conversation when the socket disconnects.
export async function leaveConversation(socket: AppSocket, conversationId: string): Promise<void> {
    const agent = socket.data;
    if (agent.kind !== "agent") return;

    void socket.leave(convRoom(conversationId));
    if (!agent.viewing.delete(conversationId)) return;

    try {
        const viewers = await presence.removeViewer(conversationId, agent.memberId);
        emitViewers(agent.workspaceId, { conversationId, viewers });
    } catch (error) {
        console.error("[Socket] leaving a conversation failed:", error);
    }
}
