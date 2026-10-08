import "dotenv/config";
import crypto from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { pool } from "../config/db.js";
import { addTestVisitor, addTestMember, cleanupTestWorkspace, createTestWorkspace } from "../__tests__/testFactory.js";

/*
  A load run against a running API (`--url`, default http://localhost:4000): N visitors each connect, send
  M messages one second apart and wait for every ack, while a few agents in the same workspace receive all of
  it. It prints what was measured — messages per second, p50/p95/p99 ack latency, error rate, how many
  deliveries the agents received — and the machine it ran from. It creates its own workspace and deletes it.
  Never point it at production.

    pnpm --filter server load -- --visitors 50 --messages 10 --agents 5 --url http://localhost:4010
 */
if (process.env["NODE_ENV"] === "production") throw new Error("Refusing to run a load test with NODE_ENV=production");

const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > -1 ? (process.argv[at + 1] ?? fallback) : fallback;
};
const URL = arg("url", "http://localhost:4000");
const VISITORS = Number(arg("visitors", "50"));
const MESSAGES = Number(arg("messages", "10"));
const AGENTS = Number(arg("agents", "5"));

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const connectSocket = (options: Parameters<typeof io>[1]) =>
  new Promise<Socket>((resolve, reject) => {
    const socket = io(URL, { transports: ["websocket"], forceNew: true, ...options });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });

const workspace = await createTestWorkspace();
try {
  const agentSockets = await Promise.all(
    Array.from({ length: AGENTS }, async () => {
      const member = await addTestMember(workspace.workspaceId, "Load agent");
      return connectSocket({ extraHeaders: { cookie: member.cookie } });
    })
  );
  let received = 0;
  agentSockets.forEach((socket) => socket.on("message:new", () => (received += 1)));

  const visitors = await Promise.all(Array.from({ length: VISITORS }, () => addTestVisitor(workspace.publicKey)));
  const latencies: number[] = [];
  let errors = 0;

  const startedAt = Date.now();
  await Promise.all(
    visitors.map(async (visitor, index) => {
      await sleep((index / VISITORS) * 5000); // arrivals spread over five seconds
      const socket = await connectSocket({ auth: { token: visitor.token } });
      for (let i = 0; i < MESSAGES; i += 1) {
        const sentAt = performance.now();
        const ack = await new Promise<{ ok: boolean }>((resolve) =>
          socket.timeout(10_000).emit("message:send", { clientMessageId: crypto.randomUUID(), body: `load ${index}/${i}` }, (timedOut: unknown, response: { ok: boolean }) =>
            resolve(timedOut ? { ok: false } : response)
          )
        );
        if (ack.ok) latencies.push(performance.now() - sentAt);
        else errors += 1;
        await sleep(1000);
      }
      socket.disconnect();
    })
  );
  const seconds = (Date.now() - startedAt) / 1000;
  await sleep(1500); // let the last deliveries land

  const sorted = latencies.sort((a, b) => a - b);
  const sent = VISITORS * MESSAGES;
  console.log(JSON.stringify({
    target: URL,
    machine: `${process.platform} ${process.arch}, node ${process.version}`,
    visitors: VISITORS, messagesPerVisitor: MESSAGES, agents: AGENTS,
    messagesSent: sent, acked: latencies.length, errors, errorRatePercent: Number(((errors / sent) * 100).toFixed(2)),
    durationSeconds: Number(seconds.toFixed(1)),
    sustainedMessagesPerSecond: Number((latencies.length / seconds).toFixed(1)),
    ackLatencyMs: { p50: Math.round(percentile(sorted, 50)), p95: Math.round(percentile(sorted, 95)), p99: Math.round(percentile(sorted, 99)) },
    deliveriesToAgents: received, expectedDeliveries: latencies.length,
  }, null, 2));
  agentSockets.forEach((socket) => socket.disconnect());
} finally {
  await cleanupTestWorkspace(workspace.workspaceId);
  await pool.end();
  // Redis connections (queue, cache) would keep the process alive.
  process.exit(process.exitCode ?? 0);
}
