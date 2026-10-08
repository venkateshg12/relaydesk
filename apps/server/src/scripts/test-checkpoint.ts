import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../config/db.js';

/*
  Phase-01 checkpoint: proves the database itself enforces the hard rules. Every check runs inside
  one transaction that is always rolled back, each in its own savepoint, so this never leaves a row
  behind — even when a constraint turns out to be missing. Run after `db:seed`.
*/

type Check = { name: string; expectSqlState: string; run: (client: PoolClient) => Promise<unknown> };

const sqlStateOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';

async function main() {
  const client = await pool.connect();
  let failures = 0;

  try {
    await client.query('BEGIN');

    const conv = (
      await client.query<{ id: string; workspaceId: string }>(
        `SELECT id, "workspaceId" FROM "public"."conversation" ORDER BY "createdAt" LIMIT 1`
      )
    ).rows[0];
    const otherWorkspace = (
      await client.query<{ id: string }>(`SELECT id FROM "public"."workspace" WHERE id <> $1 LIMIT 1`, [conv?.workspaceId])
    ).rows[0];
    if (!conv || !otherWorkspace) throw new Error('Run `pnpm db:seed` first: the checks need two seeded workspaces.');

    const insertMessage = (client: PoolClient, fields: { workspaceId?: string; seq: number; clientMessageId: string; body?: string }) =>
      client.query(
        `INSERT INTO "public"."message" (id, "workspaceId", "conversationId", seq, "clientMessageId", "senderType", body)
         VALUES ($1, $2, $3, $4, $5, 'visitor', $6)`,
        [crypto.randomUUID(), fields.workspaceId ?? conv.workspaceId, conv.id, fields.seq, fields.clientMessageId, fields.body ?? 'checkpoint']
      );
    const firstMessage = (
      await client.query<{ clientMessageId: string }>(`SELECT "clientMessageId" FROM "public"."message" WHERE "conversationId" = $1 AND seq = 1`, [conv.id])
    ).rows[0]!;

    const checks: Check[] = [
      { name: 'duplicate seq in a conversation', expectSqlState: '23505', run: (c) => insertMessage(c, { seq: 1, clientMessageId: crypto.randomUUID() }) },
      { name: 'duplicate clientMessageId in a conversation', expectSqlState: '23505', run: (c) => insertMessage(c, { seq: 9999, clientMessageId: firstMessage.clientMessageId }) },
      { name: 'message body over 4000 characters', expectSqlState: '23514', run: (c) => insertMessage(c, { seq: 9998, clientMessageId: crypto.randomUUID(), body: 'a'.repeat(4001) }) },
      {
        name: "message whose workspace differs from its conversation's",
        expectSqlState: '23503',
        run: (c) => insertMessage(c, { seq: 9997, clientMessageId: crypto.randomUUID(), workspaceId: otherWorkspace.id }),
      },
      {
        name: 'duplicate visitor number in a workspace',
        expectSqlState: '23505',
        run: (c) => c.query(`INSERT INTO "public"."visitor" (id, "workspaceId", "displayNo") VALUES ($1, $2, 1001)`, [crypto.randomUUID(), conv.workspaceId]),
      },
      {
        name: 'assigned conversation without an assignee',
        expectSqlState: '23514',
        run: (c) => c.query(`UPDATE "public"."conversation" SET status = 'assigned', "assigneeId" = NULL WHERE id = $1`, [conv.id]),
      },
      {
        // The member references are checked at commit; SET CONSTRAINTS forces the check now.
        name: 'hard-deleting a member who is still referenced',
        expectSqlState: '23503',
        run: async (c) => {
          await c.query(`DELETE FROM "public"."member" WHERE id IN (SELECT "senderMemberId" FROM "public"."message" WHERE "senderMemberId" IS NOT NULL LIMIT 1)`);
          await c.query('SET CONSTRAINTS ALL IMMEDIATE');
        },
      },
    ];

    for (const check of checks) {
      await client.query('SAVEPOINT checkpoint');
      try {
        await check.run(client);
        failures++;
        console.error(`FAIL  ${check.name}: the database accepted it`);
      } catch (error) {
        const state = sqlStateOf(error);
        if (state === check.expectSqlState) console.log(`ok    ${check.name} → rejected (${state})`);
        else {
          failures++;
          console.error(`FAIL  ${check.name}: expected ${check.expectSqlState}, got ${state}`);
        }
      }
      await client.query('ROLLBACK TO SAVEPOINT checkpoint');
    }

    // Deleting a workspace must take every row that belongs to it (phase 11's demo cleanup relies on this).
    await client.query(`DELETE FROM "public"."workspace" WHERE id = $1`, [conv.workspaceId]);
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    const leftovers = (
      await client.query<{ n: number }>(
        `SELECT (SELECT count(*) FROM "public"."member" WHERE "workspaceId" = $1)
              + (SELECT count(*) FROM "public"."message" WHERE "workspaceId" = $1)
              + (SELECT count(*) FROM "public"."savedReply" WHERE "workspaceId" = $1) AS n`,
        [conv.workspaceId]
      )
    ).rows[0]!;
    if (Number(leftovers.n) === 0) console.log('ok    deleting a workspace cascades to all of its rows');
    else {
      failures++;
      console.error(`FAIL  deleting a workspace left ${leftovers.n} rows behind`);
    }
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }

  if (failures > 0) {
    console.error(`${failures} check(s) failed`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
