import crypto from "crypto";
import request from "supertest";
import { pool } from "../config/db.js";
import { cache } from "../utils/cache/index.js";
import { emailQueue } from "../jobs/queues/email.queue.js";
import { redisConnection } from "../jobs/redis/connection.js";
import { WIDGET_MESSAGE_LIMIT } from "../constants/rateLimiter.constant.js";
import {
  addTestMember,
  addTestVisitor,
  cleanupTestWorkspace,
  createTestWorkspace,
  type TestWorkspaceContext,
} from "./testFactory.js";
import { connectSocket, emitAck, startTestServer, waitFor, type RecordingSocket, type TestServer } from "./helpers/server.js";

/*
  The product guide's "rules and tricky situations", each driven through the interface a client really uses —
  HTTP (supertest) and sockets (socket.io-client) against the real app, Postgres and Redis. The service-level
  checks of the same rules live in tricky-situations.test.ts.
 */
describe("tricky situations through HTTP and sockets", () => {
  let server: TestServer;
  let a: TestWorkspaceContext;
  let b: TestWorkspaceContext;
  const sockets: RecordingSocket[] = [];
  const open = async (options: { token?: string; cookie?: string }) => {
    const socket = await connectSocket(server.url, options);
    sockets.push(socket);
    return socket;
  };
  const send = (socket: RecordingSocket, body: string, conversationId?: string, clientMessageId = crypto.randomUUID()) =>
    emitAck(socket, "message:send", { conversationId, clientMessageId, body });

  beforeAll(async () => {
    server = await startTestServer();
    a = await createTestWorkspace();
    b = await createTestWorkspace();
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    await cleanupTestWorkspace(a?.workspaceId);
    await cleanupTestWorkspace(b?.workspaceId);
    await server.close();
    await cache.close();
    await emailQueue.close();
    redisConnection.disconnect();
    await pool.end();
  });

  // A fresh visitor with a conversation (their first message creates it), and an agent socket watching.
  const conversationWithVisitor = async (ctx: TestWorkspaceContext) => {
    const visitor = await addTestVisitor(ctx.publicKey);
    const visitorSocket = await open({ token: visitor.token });
    const ack = await send(visitorSocket, "Hello");
    expect(ack.ok).toBe(true);
    return { visitor, visitorSocket, conversationId: ack.message.conversationId as string };
  };

  test("same order for everyone: 50 concurrent sends from 5 sockets arrive as seq 1…50 on every client", async () => {
    const { conversationId } = await conversationWithVisitor(a);
    const agentSockets = await Promise.all([1, 2, 3].map(() => open({ cookie: a.agent.cookie })));
    const writers = await Promise.all(Array.from({ length: 5 }, () => open({ cookie: a.admin.cookie })));
    await Promise.all(agentSockets.map((socket) => emitAck(socket, "conversation:join", { conversationId })));

    await Promise.all(
      writers.flatMap((socket, w) => Array.from({ length: 10 }, (_, i) => send(socket, `w${w} m${i}`, conversationId)))
    );
    await waitFor(() => agentSockets.every((s) => s.eventsOf("message:new").length >= 50));

    // The visitor's "Hello" was seq 1, before these sockets joined: they all see 2…51, once each, in one order.
    for (const socket of agentSockets) {
      const seqs = (socket.eventsOf("message:new") as { seq: number }[]).map((m) => m.seq);
      expect([...seqs].sort((x, y) => x - y)).toEqual(Array.from({ length: 50 }, (_, i) => i + 2));
    }
  });

  test("internet drops: a reconnecting client syncs what it missed, and a queued send arrives once", async () => {
    const { visitor, visitorSocket, conversationId } = await conversationWithVisitor(a);
    const agent = await open({ cookie: a.agent.cookie });

    visitorSocket.disconnect();
    for (const text of ["one", "two", "three"]) expect((await send(agent, text, conversationId)).ok).toBe(true);

    const back = await open({ token: visitor.token });
    const queued = crypto.randomUUID();
    const first = await send(back, "typed offline", conversationId, queued);
    const replay = await send(back, "typed offline", conversationId, queued); // the outbox replays after a reconnect
    expect(replay.duplicate).toBe(true);
    expect(replay.message.id).toBe(first.message.id);

    const sync = await emitAck(back, "sync", { conversations: [{ id: conversationId, lastSeq: 1 }] });
    expect(sync.messages[conversationId].map((m: { body: string }) => m.body)).toEqual(["one", "two", "three", "typed offline"]);
    expect(sync.hasMore[conversationId]).toBe(false);
  });

  test("send pressed twice: socket and REST with one clientMessageId give one row and the same message", async () => {
    const { visitor, visitorSocket, conversationId } = await conversationWithVisitor(a);
    const clientMessageId = crypto.randomUUID();

    const viaSocket = await send(visitorSocket, "once", conversationId, clientMessageId);
    const viaRest = await request(server.url)
      .post("/widget/messages")
      .set("Authorization", `Bearer ${visitor.token}`)
      .send({ clientMessageId, body: "once" });

    expect(viaRest.status).toBeLessThan(300);
    expect(viaRest.body.data.duplicate).toBe(true);
    expect(viaRest.body.data.message.id).toBe(viaSocket.message.id);
    const { rows } = await pool.query(`SELECT 1 FROM "public"."message" WHERE "conversationId" = $1 AND "clientMessageId" = $2`, [conversationId, clientMessageId]);
    expect(rows).toHaveLength(1);
  });

  test("two tabs: both visitor sockets get every message and typing event", async () => {
    const { visitor, conversationId } = await conversationWithVisitor(a);
    const tabs = await Promise.all([open({ token: visitor.token }), open({ token: visitor.token })]);
    const agent = await open({ cookie: a.agent.cookie });
    await emitAck(agent, "conversation:join", { conversationId });

    await send(agent, "to both tabs", conversationId);
    agent.emit("typing", { conversationId, isTyping: true });
    await waitFor(() => tabs.every((tab) => tab.eventsOf("message:new").length === 1 && tab.eventsOf("typing").length === 1));
  });

  test("two agents assign at once: one 200 and one 409 naming the winner", async () => {
    const { conversationId } = await conversationWithVisitor(a);
    const [first, second] = await Promise.all([
      request(server.url).post(`/conversations/${conversationId}/assign`).set("Cookie", a.admin.cookie).send({}),
      request(server.url).post(`/conversations/${conversationId}/assign`).set("Cookie", a.agent.cookie).send({}),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    const winnerName = first.status === 200 ? a.admin.name : a.agent.name;
    expect(loser.body.errors[0].message).toBe(`Already taken by ${winnerName}`);
  });

  test("agent closes the inbox: presence goes offline, the conversation stays assigned, a colleague can take it", async () => {
    const { conversationId, visitorSocket } = await conversationWithVisitor(a);
    const mine = await open({ cookie: a.agent.cookie });
    await waitFor(() => visitorSocket.eventsOf<{ workspaceOnline: boolean }>("presence:update").some((p) => p.workspaceOnline));
    expect((await request(server.url).post(`/conversations/${conversationId}/assign`).set("Cookie", a.agent.cookie).send({})).status).toBe(200);

    mine.disconnect();
    await waitFor(() => visitorSocket.eventsOf<{ workspaceOnline: boolean }>("presence:update").at(-1)?.workspaceOnline === false);

    const { rows } = await pool.query(`SELECT "status", "assigneeId" FROM "public"."conversation" WHERE "id" = $1`, [conversationId]);
    expect(rows[0]).toEqual({ status: "assigned", assigneeId: a.agent.id });
    const takeover = await request(server.url).post(`/conversations/${conversationId}/assign`).set("Cookie", a.admin.cookie).send({ memberId: a.admin.id });
    expect(takeover.status).toBe(200);
  });

  test("writes after resolve: the visitor's message reopens it to the same agent, same conversation", async () => {
    const { conversationId, visitorSocket } = await conversationWithVisitor(a);
    await request(server.url).post(`/conversations/${conversationId}/assign`).set("Cookie", a.agent.cookie).send({});
    await request(server.url).post(`/conversations/${conversationId}/resolve`).set("Cookie", a.agent.cookie).send({});

    const ack = await send(visitorSocket, "me again");
    expect(ack.message.conversationId).toBe(conversationId);
    const detail = await request(server.url).get(`/conversations/${conversationId}`).set("Cookie", a.admin.cookie);
    expect(detail.body.data.status).toBe("assigned");
    expect(detail.body.data.assigneeId).toBe(a.agent.id);
  });

  test("no agent online: the widget is told, and a reply to an emailed visitor is queued as an offline-reply email", async () => {
    const visitor = await addTestVisitor(a.publicKey);
    await request(server.url).patch("/widget/visitor").set("Authorization", `Bearer ${visitor.token}`).send({ email: "away@example.test", pageUrl: "http://localhost:5500/" });
    const visitorSocket = await open({ token: visitor.token });
    const { message } = await send(visitorSocket, "Anyone there?");
    await waitFor(() => visitorSocket.eventsOf("presence:update").length > 0);
    expect(visitorSocket.eventsOf<{ workspaceOnline: boolean }>("presence:update")[0]!.workspaceOnline).toBe(false);

    visitorSocket.disconnect(); // "has left the page"
    await new Promise((resolve) => setTimeout(resolve, 600));
    await request(server.url)
      .post(`/conversations/${message.conversationId}/messages`)
      .set("Cookie", a.admin.cookie)
      .send({ clientMessageId: crypto.randomUUID(), body: "Yes, we are here" });

    await waitFor(() => false, 300).catch(() => undefined); // the reply's email job is scheduled just after the response
    const job = await emailQueue.getJob(`offline-reply-${message.conversationId}`);
    expect(job?.name).toBe("send_offline_reply");
    await job?.remove();
  });

  test("internal note: agents see it, the visitor's socket gets nothing and /widget/messages excludes it", async () => {
    const { visitor, visitorSocket, conversationId } = await conversationWithVisitor(a);
    const agent = await open({ cookie: a.agent.cookie });
    const before = visitorSocket.received.length;

    const note = await request(server.url).post(`/conversations/${conversationId}/notes`).set("Cookie", a.agent.cookie).send({ body: "secret internal text" });
    expect(note.status).toBeLessThan(300);
    await waitFor(() => agent.eventsOf("note:new").length === 1);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(JSON.stringify(visitorSocket.received.slice(before))).not.toContain("secret internal text");
    const history = await request(server.url).get("/widget/messages").set("Authorization", `Bearer ${visitor.token}`);
    expect(JSON.stringify(history.body)).not.toContain("secret internal text");
  });

  test("another business's data: 404 on every route, and sockets can't join or sync it", async () => {
    const { conversationId } = await conversationWithVisitor(b);
    const savedReply = await request(server.url).post("/saved-replies").set("Cookie", b.admin.cookie).send({ title: "T", shortcut: "tt", body: "b" });
    const foreign = a.admin.cookie; // an admin of A, asking about B's ids

    for (const [method, path, body] of [
      ["get", `/conversations/${conversationId}`, undefined],
      ["get", `/conversations/${conversationId}/notes`, undefined],
      ["post", `/conversations/${conversationId}/assign`, {}],
      ["post", `/conversations/${conversationId}/resolve`, {}],
      ["patch", `/saved-replies/${savedReply.body.data.savedReply.id}`, { title: "x" }],
      ["delete", `/team/members/${b.agent.id}`, undefined],
    ] as const) {
      const response = await request(server.url)[method](path).set("Cookie", foreign).send(body);
      expect([method, path, response.status]).toEqual([method, path, 404]);
    }

    const agentOfA = await open({ cookie: a.agent.cookie });
    expect(await emitAck(agentOfA, "conversation:join", { conversationId })).toMatchObject({ ok: false, error: "NOT_FOUND" });
    const sync = await emitAck(agentOfA, "sync", { conversations: [{ id: conversationId, lastSeq: 0 }] });
    expect(sync.messages[conversationId]).toEqual([]);
  });

  test("agent removed: their next REST call is 401, their socket is disconnected, their conversations are unassigned", async () => {
    const removed = await addTestMember(a.workspaceId, "Soon Gone");
    const { conversationId } = await conversationWithVisitor(a);
    await request(server.url).post(`/conversations/${conversationId}/assign`).set("Cookie", removed.cookie).send({});
    const socket = await open({ cookie: removed.cookie });

    const result = await request(server.url).delete(`/team/members/${removed.id}`).set("Cookie", a.admin.cookie);
    expect(result.status).toBe(200);

    await waitFor(() => socket.disconnected);
    expect((await request(server.url).get("/conversations").set("Cookie", removed.cookie)).status).toBe(401);
    const { rows } = await pool.query(`SELECT "status", "assigneeId" FROM "public"."conversation" WHERE "id" = $1`, [conversationId]);
    expect(rows[0]).toEqual({ status: "unassigned", assigneeId: null });
  });

  test("flooding: the visitor's message past the per-minute budget is rejected with RATE_LIMITED", async () => {
    const visitor = await addTestVisitor(a.publicKey);
    const socket = await open({ token: visitor.token });
    const acks = [];
    for (let i = 0; i <= WIDGET_MESSAGE_LIMIT; i += 1) acks.push(await send(socket, `flood ${i}`));

    expect(acks.slice(0, WIDGET_MESSAGE_LIMIT).every((ack) => ack.ok)).toBe(true);
    expect(acks[WIDGET_MESSAGE_LIMIT]).toMatchObject({ ok: false, error: "RATE_LIMITED" });
  });
});
