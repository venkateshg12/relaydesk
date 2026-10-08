#!/usr/bin/env -S node
import type {
  Contract as End,
  Contract as Start,
} from '../../snapshots/e482d1f39159edb3fb63c2a36e9bcfe4d8353fe82095cfcc271afb6496b452fc/contract';
import endContract from '../../snapshots/e482d1f39159edb3fb63c2a36e9bcfe4d8353fe82095cfcc271afb6496b452fc/contract.json' with { type: 'json' };
import startContract from '../../snapshots/e482d1f39159edb3fb63c2a36e9bcfe4d8353fe82095cfcc271afb6496b452fc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

/*
  The "who did this" foreign keys (assignee, last assignee, sender, author, creator, inviter) point at
  `member (id, workspaceId)` with NO ACTION. Postgres runs each ON DELETE CASCADE step as its own
  internal statement, so deleting a workspace can remove its members before the conversations,
  messages and notes that reference them — and a non-deferred NO ACTION check fails at that moment.
  Deferring the check to COMMIT lets a whole workspace cascade away (phase 11's demo cleanup), while
  hard-deleting one member who is still referenced is still refused when the transaction commits.
  The contract can't express DEFERRABLE, so this migration changes no contract state.
*/
const DEFERRED_MEMBER_REFS = [
  ['conversation', 'conversation_assigneeId_workspaceId_fkey'],
  ['conversation', 'conversation_lastAssigneeId_workspaceId_fkey'],
  ['invitation', 'invitation_invitedById_workspaceId_fkey'],
  ['message', 'message_senderMemberId_workspaceId_fkey'],
  ['note', 'note_authorId_workspaceId_fkey'],
  ['savedReply', 'savedReply_createdById_workspaceId_fkey'],
] as const;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return DEFERRED_MEMBER_REFS.map(([table, constraint]) =>
      rawSql({
        id: `deferrable.${constraint}`,
        invariantId: `deferrable.${constraint}`,
        label: `Make "${constraint}" DEFERRABLE INITIALLY DEFERRED`,
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [
          {
            description: `foreign key "${constraint}" exists`,
            sql: "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = $1 AND contype = 'f')",
            params: [constraint],
          },
        ],
        execute: [
          {
            description: 'defer the check to commit',
            sql: `ALTER TABLE "public"."${table}" ALTER CONSTRAINT "${constraint}" DEFERRABLE INITIALLY DEFERRED`,
          },
        ],
        postcheck: [
          {
            description: `"${constraint}" is deferred`,
            sql: 'SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = $1 AND condeferrable AND condeferred)',
            params: [constraint],
          },
        ],
      }),
    );
  }
}

MigrationCLI.run(import.meta.url, M);
