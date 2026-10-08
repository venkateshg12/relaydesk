import { clientMessageSeenSchema } from "@repo/types";
import { pool } from "../../config/db.js";
import { emitMessageSeen } from "../emit.js";
import type { AppSocket } from "../../types/socket.d.js";

/*
  A read mark only moves forward and never past the last message (`LEAST(seq, lastSeq)`), and is
  written and announced only when it actually advanced — a client repeating the same mark costs one
  failed WHERE, not a broadcast. A visitor can mark only their own conversation.
 */
export async function handleMessageSeen(socket: AppSocket, data: unknown): Promise<void> {
    const parsed = clientMessageSeenSchema.safeParse(data);
    if (!parsed.success) return;

    const reader = socket.data;
    const column = reader.kind === "visitor" ? "visitorLastReadSeq" : "agentLastReadSeq";

    try {
        const { rows } = await pool.query<{ visitorId: string; seq: number }>(
            `UPDATE "public"."conversation"
                SET "${column}" = LEAST($1, "lastSeq"), "updatedAt" = now()
              WHERE "id" = $2 AND "workspaceId" = $3
                AND ($4::uuid IS NULL OR "visitorId" = $4)
                AND "${column}" < LEAST($1, "lastSeq")
          RETURNING "visitorId", "${column}" AS "seq"`,
            [parsed.data.seq, parsed.data.conversationId, reader.workspaceId, reader.kind === "visitor" ? reader.visitorId : null]
        );
        const row = rows[0];
        if (!row) return;

        emitMessageSeen(reader.workspaceId, row.visitorId, {
            conversationId: parsed.data.conversationId,
            by: reader.kind,
            seq: row.seq
        });
    } catch (error) {
        console.error("[Socket] message:seen failed:", error);
    }
}
