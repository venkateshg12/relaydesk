import { clientPresenceSetSchema } from "@repo/types";
import { presence } from "../presence.js";
import { emitPresence } from "../emit.js";
import type { AppSocket } from "../../types/socket.d.js";

// An agent's own "online" / "away" choice. It only changes who the widget says is available.
export async function handlePresenceSet(socket: AppSocket, data: unknown): Promise<void> {
    const agent = socket.data;
    if (agent.kind !== "agent") return;

    const parsed = clientPresenceSetSchema.safeParse(data);
    if (!parsed.success) return;

    const { workspaceOnline } = await presence.setMemberStatus(agent.workspaceId, agent.memberId, parsed.data.status);
    emitPresence(agent.workspaceId, { memberId: agent.memberId, status: parsed.data.status, workspaceOnline });
}
