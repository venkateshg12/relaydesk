import "dotenv/config";
import crypto from "crypto";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import {
    CORS_ORIGIN,
    DEBUG_IP_ENDPOINT,
    ENABLE_QUEUE_DASHBOARD,
    NODE_ENV,
    PORT,
    QUEUE_DASHBOARD_PASSWORD,
    QUEUE_DASHBOARD_USER,
    RUN_WORKERS_IN_API,
    TRUSTED_PROXY_CIDRS
} from "./constants/env.js";
import { pool } from "./config/db.js";
import { ok } from "./utils/api/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRoutes } from "./routes/auth.route.js";
import { gmailRoutes } from "./routes/gmail.route.js";
import { sessionRoutes } from "./routes/session.route.js";
import { teamRoutes } from "./routes/team.route.js";
import { invitationRoutes } from "./routes/invitation.route.js";
import { widgetRoutes } from "./routes/widget.route.js";
import { conversationRoutes } from "./routes/conversation.route.js";
import { savedReplyRoutes } from "./routes/savedReply.route.js";
import { workspaceRoutes } from "./routes/workspace.route.js";
import { dashboardRoutes } from "./routes/dashboard.route.js";
import { demoRoutes } from "./routes/demo.route.js";
import { extractClientIp, trustProxy } from "./utils/rateLimiter/ipExtractor.js";
import { globalLimiter } from "./config/rateLimiter.js";
import { cache } from "./utils/cache/index.js";
import { setupBullBoard } from "./jobs/dashboard/bull-board.js";
import { closeWorkers, startWorker } from "./worker.js";
import { initSocketServer, closeSocketServer } from "./realtime/socket.js";

/**
 * Basic auth for the queue dashboard. Compared with a timing-safe digest comparison so the
 * credentials can't be recovered a character at a time.
 */
const matchesSecret = (candidate: string | undefined, expected: string): boolean => {
    const a = crypto.createHash("sha256").update(candidate ?? "").digest();
    const b = crypto.createHash("sha256").update(expected).digest();
    return crypto.timingSafeEqual(a, b);
};

const queueDashboardAuth: express.RequestHandler = (req, res, next) => {
    const header = req.headers.authorization ?? "";
    const [scheme, encoded] = header.split(" ");

    if (scheme === "Basic" && encoded) {
        const [user, password] = Buffer.from(encoded, "base64").toString().split(":");
        if (matchesSecret(user, QUEUE_DASHBOARD_USER) && matchesSecret(password, QUEUE_DASHBOARD_PASSWORD)) {
            return next();
        }
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="Queues"');
    res.status(401).send("Authentication required");
};

export const createApp = () => {
    const app = express();

    /*
      BullMQ dashboard.
      Job payloads contain invitation tokens, so an unauthenticated dashboard is a security risk.
      Requires an explicit opt-in AND credentials, and refuses to mount half-configured.
     */
    const queueDashboardEnabled = ENABLE_QUEUE_DASHBOARD === "true";
    const queueDashboardConfigured = Boolean(QUEUE_DASHBOARD_USER) && Boolean(QUEUE_DASHBOARD_PASSWORD);

    if (queueDashboardEnabled && !queueDashboardConfigured) {
        throw new Error(
            "ENABLE_QUEUE_DASHBOARD is true but QUEUE_DASHBOARD_USER/QUEUE_DASHBOARD_PASSWORD are not set"
        );
    }

    if (queueDashboardEnabled && queueDashboardConfigured) {
        app.use("/admin/queues", queueDashboardAuth, setupBullBoard());
    }

    /*
      Trust exactly the proxies the rate limiter trusts. The old `1` believed one hop of
      X-Forwarded-For from any peer, which disagreed with the limiter's own view of the client IP.
     */
    app.set("trust proxy", trustProxy);

    if (NODE_ENV === "production" && !TRUSTED_PROXY_CIDRS.trim()) {
        console.warn(
            "TRUSTED_PROXY_CIDRS is empty. If this server runs behind a load balancer or reverse proxy, " +
            "every client will share that proxy's IP and one rate-limit bucket. See .env.example."
        );
    }

    // Baseline response headers: HSTS, nosniff, frame-ancestors, a conservative referrer policy.
    // `crossOriginResourcePolicy` is relaxed because the web app and the widget are served from
    // other origins.
    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" },
            hsts: NODE_ENV === "production" ? undefined : false,
        })
    );

    const corsOrigin = (CORS_ORIGIN).split(",").map(origin => origin.trim()).filter(Boolean);

    app.use(cors({ origin: corsOrigin, credentials: true }));

    app.use(express.json());
    // `dev` is colourised and human-shaped; a deployed server's output is read by a log collector.
    app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));
    app.use(cookieParser());
    app.use(globalLimiter);

    /*
      Shows how the rate limiter identifies the caller, to check TRUSTED_PROXY_CIDRS on a real deploy.
      Off unless DEBUG_IP_ENDPOINT=true: it echoes proxy headers and reveals which ones are trusted.
      Declared before the routers mounted at "/" for the same reason as /health below.
     */
    if (DEBUG_IP_ENDPOINT === "true") {
        app.get("/debug-ip", (req, res) => {
            const peer = req.socket.remoteAddress;
            res.json(ok({
                resolvedIp: extractClientIp(req),
                expressReqIp: req.ip,
                tcpPeer: peer,
                peerIsTrustedProxy: peer ? trustProxy(peer) : false,
                visitorId: req.visitorId ?? null,
                headers: {
                    "cf-connecting-ip": req.headers["cf-connecting-ip"] ?? null,
                    "x-forwarded-for": req.headers["x-forwarded-for"] ?? null,
                    "true-client-ip": req.headers["true-client-ip"] ?? null
                }
            }));
        });
    }

    /*
      Health check first. Routers that call `router.use(authenticate)` run for every request that
      reaches them regardless of path — so a route declared after them would answer 401 instead of
      its own response.
      Reports the dependencies, not just the process. Postgres is fatal; Redis is reported but not fatal:
      the cache and rate limiter both degrade to working without it.
     */
    app.get("/health", async (_req, res) => {
        const [postgresUp, redisReady] = await Promise.all([
            Promise.race([
                pool.query("SELECT 1").then(() => true, () => false),
                new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000).unref()),
            ]),
            cache.ping()
        ]);

        return res.status(postgresUp ? 200 : 503).json(
            ok({
                status: postgresUp ? "ok" : "degraded",
                postgres: postgresUp ? "up" : "down",
                redis: redisReady ? "up" : "down",
            })
        );
    });

    // Routes declaration.
    // The one-time Gmail authorisation. The path is fixed by the redirect URI registered with Google
    // (`/api/auth/gmail/callback`), so it keeps the `/api` prefix the other routers here don't use.
    app.use("/api/auth/gmail", gmailRoutes);
    app.use("/auth", authRoutes);
    app.use("/session", sessionRoutes);
    app.use("/team", teamRoutes);
    app.use("/invitations", invitationRoutes);
    app.use("/widget", widgetRoutes);
    app.use("/conversations", conversationRoutes);
    app.use("/saved-replies", savedReplyRoutes);
    app.use("/workspace", workspaceRoutes);
    app.use("/dashboard", dashboardRoutes);
    app.use("/demo", demoRoutes);

    // Registered before listening, so a request can never arrive at a server whose 404 and error
    // handlers aren't mounted yet.
    app.use(notFound);
    app.use(errorHandler);

    return app;
};

async function main() {
    // Fail at boot, not on the first request, if Postgres is unreachable.
    await pool.query("SELECT 1");

    // In development, run workers in-process. In production they are a standalone process (`pnpm start:worker`),
    // unless RUN_WORKERS_IN_API=true: one web service then registers the repeating jobs and runs everything.
    if (NODE_ENV !== "production" || RUN_WORKERS_IN_API === "true") {
        await startWorker();
    }

    const app = createApp();

    const BACKEND_PORT = Number(PORT);
    const server = app.listen(BACKEND_PORT, "0.0.0.0", () => {
        console.log(`Server is listening to the port: ${BACKEND_PORT}`);
    });

    // Socket.IO shares the HTTP server, so one process and one port serve both.
    initSocketServer(server);

    /*
      Orderly shutdown, in the order that loses nothing: stop accepting connections, let in-flight
      requests finish, then close the queue workers and the database. A deploy sends SIGTERM, and
      exiting straight away could cut a request off mid-transaction.
     */
    const SHUTDOWN_GRACE_MS = 10_000;
    let shuttingDown = false;

    const shutdown = async (reason: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[shutdown] ${reason} — closing`);

        // A client holding a keep-alive connection open shouldn't hold the deploy open with it.
        const forceExit = setTimeout(() => {
            console.error("[shutdown] in-flight requests did not finish in time — exiting anyway");
            process.exit(1);
        }, SHUTDOWN_GRACE_MS);
        forceExit.unref();

        try {
            await closeSocketServer();
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await closeWorkers();
            await cache.close();
            await pool.end();
            console.log("[shutdown] complete");
            process.exit(0);
        } catch (error) {
            console.error("[shutdown] failed:", error);
            process.exit(1);
        }
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));

    /*
      A rejection nobody handled would otherwise end the process with no context (and, on current
      Node, end it by default). Logged, then taken down the same orderly path.
     */
    process.on("unhandledRejection", (reason) => {
        console.error("[fatal] unhandled promise rejection:", reason);
        void shutdown("unhandledRejection");
    });

    process.on("uncaughtException", (error) => {
        console.error("[fatal] uncaught exception:", error);
        void shutdown("uncaughtException");
    });
}

main().catch((error) => {
    console.error("failed to start", error);
    process.exit(1);
});
