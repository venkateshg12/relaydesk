import "dotenv/config";
import { pool } from "../config/db.js";

/*
  Applies migration 20261004T1105_deferred_member_refs to a database. That migration changes no contract
  state, so `prisma db migrate` on an EMPTY database does not select it — and without it deleting a workspace
  (the demo cleanup) can fail on a "who did this" foreign key. Idempotent; run it after `prisma db migrate`
  on every new database (`pnpm db:deploy` does both).
 */
const DEFERRED_MEMBER_REFS = [
  ["conversation", "conversation_assigneeId_workspaceId_fkey"],
  ["conversation", "conversation_lastAssigneeId_workspaceId_fkey"],
  ["invitation", "invitation_invitedById_workspaceId_fkey"],
  ["message", "message_senderMemberId_workspaceId_fkey"],
  ["note", "note_authorId_workspaceId_fkey"],
  ["savedReply", "savedReply_createdById_workspaceId_fkey"],
] as const;

for (const [table, constraint] of DEFERRED_MEMBER_REFS) {
  await pool.query(`ALTER TABLE "public"."${table}" ALTER CONSTRAINT "${constraint}" DEFERRABLE INITIALLY DEFERRED`);
}
console.log(`Deferred ${DEFERRED_MEMBER_REFS.length} member references.`);
await pool.end();
