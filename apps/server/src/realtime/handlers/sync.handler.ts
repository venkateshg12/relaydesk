import { clientSyncSchema, type SyncAck } from "@repo/types";
import { syncMessagesService } from "../../services/message.service.js";
import { reply } from "./ack.js";
import type { AppSocket } from "../../types/socket.d.js";

// On every (re)connect the client says how far it got; Postgres answers with what it missed.
export async function handleSync(socket: AppSocket, data: unknown, ack?: (response: SyncAck) => void): Promise<void> {
    const parsed = clientSyncSchema.safeParse(data);
    if (!parsed.success) return reply(ack, { ok: false, error: "VALIDATION_ERROR" });

    try {
        const { workspaceId } = socket.data;
        const result = await syncMessagesService({
            workspaceId,
            visitorId: socket.data.kind === "visitor" ? socket.data.visitorId : undefined,
            conversations: parsed.data.conversations
        });
        reply(ack, { ok: true, ...result });
    } catch (error) {
        console.error("[Socket] sync failed:", error);
        reply(ack, { ok: false, error: "INTERNAL_ERROR" });
    }
}
