import { verifyToken } from "../utils/auth/jwt.js";
import { verifyVisitorToken } from "../utils/auth/visitorToken.js";
import { assertSessionActive } from "../middleware/authenticate.js";
import { orm } from "../config/db.js";
import type { AccessTokenPayload } from "../types/auth.types.js";
import type { AppSocket } from "../types/socket.d.js";

// Demo workspaces get the homepage's live numbers, and lower message limits.
const isDemoWorkspace = async (workspaceId: string) =>
    (await orm.Workspace.where({ id: workspaceId }).select("isDemo").first())?.isDemo ?? false;

const readCookie = (header: string | undefined, name: string) =>
    header
        ?.split(";")
        .map((part) => part.trim().split("="))
        .find(([key]) => key === name)?.[1];

/*
  Handshake authentication — the same checks as HTTP, done once per connection.
  - A visitor (the widget iframe) sends its visitor JWT as `auth.token`.
  - An agent (the web app) is identified by the httpOnly access cookie, exactly like `authenticate`:
    valid JWT, live session, member not removed (`assertSessionActive`, shared with the middleware).
  `auth.token` is checked first: on the demo page one browser holds an agent cookie and also runs a
  visitor widget, and the widget's socket must not be mistaken for the agent.
 */
export async function authSocketMiddleware(socket: AppSocket, next: (err?: Error) => void): Promise<void> {
    try {
        const visitorToken = socket.handshake.auth?.token as string | undefined;

        if (visitorToken) {
            const { payload } = verifyVisitorToken(visitorToken);
            const visitor = payload
                ? await orm.Visitor.where({ id: payload.visitorId, workspaceId: payload.workspaceId })
                      .select("id", "name", "displayNo")
                      .first()
                : null;
            if (!payload || !visitor) return next(new Error("UNAUTHORIZED"));

            socket.data = {
                kind: "visitor",
                visitorId: payload.visitorId,
                workspaceId: payload.workspaceId,
                isDemo: await isDemoWorkspace(payload.workspaceId),
                name: visitor.name ?? `Visitor ${visitor.displayNo}`,
            };
            return next();
        }

        const accessToken = readCookie(socket.request.headers.cookie, "accessToken");
        const { payload } = accessToken ? verifyToken<AccessTokenPayload>(decodeURIComponent(accessToken)) : {};
        if (!payload) return next(new Error("UNAUTHORIZED"));

        await assertSessionActive(payload.sessionId, payload.memberId, payload.workspaceId);
        const member = await orm.Member.where({ id: payload.memberId, workspaceId: payload.workspaceId })
            .select("name")
            .first();

        socket.data = {
            kind: "agent",
            memberId: payload.memberId,
            workspaceId: payload.workspaceId,
            role: payload.role,
            sessionId: payload.sessionId,
            isDemo: await isDemoWorkspace(payload.workspaceId),
            name: member?.name ?? "Agent",
            viewing: new Set(),
        };
        return next();
    } catch {
        return next(new Error("UNAUTHORIZED"));
    }
}
