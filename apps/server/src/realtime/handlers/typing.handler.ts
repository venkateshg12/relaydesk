import { clientTypingSchema } from "@repo/types";
import { convRoom } from "../rooms.js";
import type { AppSocket } from "../../types/socket.d.js";

/*
  Typing is relayed only into a conversation room this socket already belongs to: an agent joins
  through `conversation:join` (which checks the workspace), a visitor's socket is joined to their own
  conversation by the server. A made-up or foreign conversation id therefore reaches nobody.
 */
export function handleTyping(socket: AppSocket, data: unknown): void {
    const parsed = clientTypingSchema.safeParse(data);
    if (!parsed.success) return;

    const room = convRoom(parsed.data.conversationId);
    if (!socket.rooms.has(room)) return;

    socket.to(room).emit("typing", {
        conversationId: parsed.data.conversationId,
        who: socket.data.name,
        isTyping: parsed.data.isTyping
    });
}
