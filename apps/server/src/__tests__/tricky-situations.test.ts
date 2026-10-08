import crypto from "crypto";
import { pool } from "../config/db.js";
import { cache } from "../utils/cache/index.js";
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  type TestWorkspaceContext,
} from "./testFactory.js";
import { sendMessageService } from "../services/message.service.js";
import {
  assignConversationService,
  resolveConversationService,
  getConversationDetailsService,
} from "../services/conversation.service.js";
import { createNoteService, listNotesService } from "../services/note.service.js";
import { removeMemberService } from "../services/team.service.js";

describe("Phase 12 — Tricky Situations & Invariants", () => {
  let ctx: TestWorkspaceContext;
  let otherCtx: TestWorkspaceContext;

  beforeAll(async () => {
    ctx = await createTestWorkspace();
    otherCtx = await createTestWorkspace();
  });

  afterAll(async () => {
    await cleanupTestWorkspace(ctx?.workspaceId);
    await cleanupTestWorkspace(otherCtx?.workspaceId);
    await cache.close();
    await pool.end();
  });

  // 1. Same order for everyone: strictly monotonically increasing sequence
  test("Same order for everyone: concurrent messages get strictly contiguous sequence numbers", async () => {
    const firstMsg = await sendMessageService({
      workspaceId: ctx.workspaceId,
      visitorId: ctx.visitor.id,
      senderType: "visitor",
      clientMessageId: crypto.randomUUID(),
      body: "Initial conversation message",
    });
    const conversationId = firstMsg.message.conversationId;
    expect(firstMsg.message.seq).toBe(1);

    // Send 10 concurrent messages
    const concurrentBodies = Array.from({ length: 10 }, (_, i) => `Concurrent message ${i + 1}`);
    const results = await Promise.all(
      concurrentBodies.map((body) =>
        sendMessageService({
          workspaceId: ctx.workspaceId,
          conversationId,
          senderType: "visitor",
          visitorId: ctx.visitor.id,
          clientMessageId: crypto.randomUUID(),
          body,
        })
      )
    );

    const seqs = results.map((r) => r.message.seq).sort((a, b) => a - b);
    expect(seqs).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    const dbMessages = await pool.query(
      `SELECT "seq" FROM "public"."message" WHERE "conversationId" = $1 ORDER BY "seq" ASC`,
      [conversationId]
    );
    const dbSeqs = dbMessages.rows.map((r) => r.seq);
    expect(dbSeqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  // 2. Send pressed twice (Idempotency)
  test("Send pressed twice: same clientMessageId produces exactly one DB row and returns duplicate flag", async () => {
    const fixedClientId = crypto.randomUUID();

    const firstCall = await sendMessageService({
      workspaceId: ctx.workspaceId,
      visitorId: ctx.visitor.id,
      senderType: "visitor",
      clientMessageId: fixedClientId,
      body: "Double tap message",
    });
    expect(firstCall.duplicate).toBe(false);

    const secondCall = await sendMessageService({
      workspaceId: ctx.workspaceId,
      visitorId: ctx.visitor.id,
      senderType: "visitor",
      clientMessageId: fixedClientId,
      body: "Double tap message",
    });
    expect(secondCall.duplicate).toBe(true);
    expect(secondCall.message.id).toBe(firstCall.message.id);
    expect(secondCall.message.seq).toBe(firstCall.message.seq);

    const rows = await pool.query(
      `SELECT count(*) FROM "public"."message" WHERE "clientMessageId" = $1`,
      [fixedClientId]
    );
    expect(parseInt(rows.rows[0].count, 10)).toBe(1);
  });

  // 3. Two agents assign at once (Race condition with row-level lock)
  test("Two agents assign at once: exactly one 200 winner, one 409 conflict with winner's name", async () => {
    const newVisitorRes = await pool.query(
      `INSERT INTO "public"."visitor" ("id", "workspaceId", "displayNo")
       VALUES (gen_random_uuid(), $1, 9999) RETURNING "id"`,
      [ctx.workspaceId]
    );
    const vId = newVisitorRes.rows[0].id;

    const startMsg = await sendMessageService({
      workspaceId: ctx.workspaceId,
      visitorId: vId,
      senderType: "visitor",
      clientMessageId: crypto.randomUUID(),
      body: "Need help please",
    });
    const convId = startMsg.message.conversationId;

    const results = await Promise.allSettled([
      assignConversationService({
        conversationId: convId,
        workspaceId: ctx.workspaceId,
        memberId: ctx.admin.id,
      }),
      assignConversationService({
        conversationId: convId,
        workspaceId: ctx.workspaceId,
        memberId: ctx.agent.id,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const winner = (fulfilled[0] as PromiseFulfilledResult<{ assigneeId: string | null }>).value;
    const error = (rejected[0] as PromiseRejectedResult).reason;

    expect(error.statusCode).toBe(409);
    expect(error.message).toContain("Already taken by");
    expect(winner.assigneeId).toBeTruthy();
  });

  // 4. Writes after resolve (Auto-reopen and assignee restoration)
  test("Writes after resolve: visitor message reopens conversation and restores previous assignee", async () => {
    const vRes = await pool.query(
      `INSERT INTO "public"."visitor" ("id", "workspaceId", "displayNo")
       VALUES (gen_random_uuid(), $1, 9998) RETURNING "id"`,
      [ctx.workspaceId]
    );
    const vId = vRes.rows[0].id;

    const start = await sendMessageService({
      workspaceId: ctx.workspaceId,
      visitorId: vId,
      senderType: "visitor",
      clientMessageId: crypto.randomUUID(),
      body: "Will this resolve?",
    });
    const cId = start.message.conversationId;

    // Assign to agent
    await assignConversationService({
      conversationId: cId,
      workspaceId: ctx.workspaceId,
      memberId: ctx.agent.id,
    });

    // Resolve conversation
    const resolved = await resolveConversationService({
      conversationId: cId,
      workspaceId: ctx.workspaceId,
    });
    expect(resolved.status).toBe("resolved");

    // Visitor replies after resolve
    await sendMessageService({
      workspaceId: ctx.workspaceId,
      conversationId: cId,
      visitorId: vId,
      senderType: "visitor",
      clientMessageId: crypto.randomUUID(),
      body: "Wait, one more question!",
    });

    const convCheck = await pool.query(
      `SELECT "status", "assigneeId", "lastAssigneeId" FROM "public"."conversation" WHERE "id" = $1`,
      [cId]
    );
    const row = convCheck.rows[0];
    expect(row.status).toBe("assigned");
    expect(row.assigneeId).toBe(ctx.agent.id);
  });

  // 5. Internal note isolation: internal notes never leak to visitor
  test("Internal note isolation: notes are saved and readable by agents but never returned to visitor", async () => {
    const vRes = await pool.query(
      `INSERT INTO "public"."visitor" ("id", "workspaceId", "displayNo")
       VALUES (gen_random_uuid(), $1, 9997) RETURNING "id"`,
      [ctx.workspaceId]
    );
    const vId = vRes.rows[0].id;

    const start = await sendMessageService({
      workspaceId: ctx.workspaceId,
      visitorId: vId,
      senderType: "visitor",
      clientMessageId: crypto.randomUUID(),
      body: "Private question",
    });
    const cId = start.message.conversationId;

    const note = await createNoteService({
      workspaceId: ctx.workspaceId,
      conversationId: cId,
      authorId: ctx.admin.id,
      data: { body: "Customer is asking for an unreleased discount." },
    });
    expect(note.id).toBeTruthy();

    const notes = await listNotesService({
      workspaceId: ctx.workspaceId,
      conversationId: cId,
    });
    expect(notes.length).toBe(1);
    expect(notes[0].body).toBe("Customer is asking for an unreleased discount.");

    const msgs = await pool.query(
      `SELECT "body" FROM "public"."message" WHERE "conversationId" = $1`,
      [cId]
    );
    const bodies = msgs.rows.map((m) => m.body);
    expect(bodies).not.toContain("Customer is asking for an unreleased discount.");
  });

  // 6. Multi-tenant data isolation: Workspace A cannot access Workspace B data
  test("Multi-tenant isolation: agent from workspace A cannot access conversation from workspace B", async () => {
    const startInB = await sendMessageService({
      workspaceId: otherCtx.workspaceId,
      visitorId: otherCtx.visitor.id,
      senderType: "visitor",
      clientMessageId: crypto.randomUUID(),
      body: "Workspace B private conversation",
    });
    const cIdInB = startInB.message.conversationId;

    await expect(
      getConversationDetailsService({
        conversationId: cIdInB,
        workspaceId: ctx.workspaceId,
      })
    ).rejects.toThrow();
  });

  // 7. Agent removed: conversations unassigned
  test("Agent removed: conversations assigned to removed member are unassigned", async () => {
    const tempAgentEmail = `temp_remove_${Date.now()}@test.com`;
    const tempAgentRes = await pool.query(
      `INSERT INTO "public"."member" ("id", "workspaceId", "name", "email", "passwordHash", "role", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'Temp Agent', $2, 'dummyhash', 'agent', now(), now())
       RETURNING "id"`,
      [ctx.workspaceId, tempAgentEmail]
    );
    const tempAgentId = tempAgentRes.rows[0].id;

    const vRes = await pool.query(
      `INSERT INTO "public"."visitor" ("id", "workspaceId", "displayNo")
       VALUES (gen_random_uuid(), $1, 9996) RETURNING "id"`,
      [ctx.workspaceId]
    );
    const cRes = await sendMessageService({
      workspaceId: ctx.workspaceId,
      visitorId: vRes.rows[0].id,
      senderType: "visitor",
      clientMessageId: crypto.randomUUID(),
      body: "Assigned to temp agent",
    });
    const cId = cRes.message.conversationId;

    await assignConversationService({
      conversationId: cId,
      workspaceId: ctx.workspaceId,
      memberId: tempAgentId,
    });

    await removeMemberService(ctx.workspaceId, ctx.admin.id, tempAgentId);

    const convRow = await pool.query(
      `SELECT "status", "assigneeId" FROM "public"."conversation" WHERE "id" = $1`,
      [cId]
    );
    expect(convRow.rows[0].status).toBe("unassigned");
    expect(convRow.rows[0].assigneeId).toBeNull();
  });
});
