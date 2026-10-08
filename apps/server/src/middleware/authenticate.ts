import { appAssert } from "../utils/errors/index.js";
import { UNAUTHORIZED } from "../constants/http.js";
import { appErrorCode } from "../constants/appErrorCode.js";
import { verifyToken } from "../utils/auth/jwt.js";
import { orm } from "../prisma/db.js";
import type { AccessTokenPayload } from "../types/auth.types.js";
import { catchError } from "../utils/errors/catchError.js";
import { cache, sessionCacheKey } from "../utils/cache/index.js";

/*
  A valid signature only proves the token was issued, not that its session is still alive. Without
  the session lookup, logout, password change and "sign out this device" leave the access token
  working for up to its full 15 minutes. The signature is checked first, so forged or malformed
  tokens never reach the database.
*/
/*
  A confirmed-active session is remembered for 60 seconds, so most authenticated requests skip the
  database lookup. Every revocation path goes through `revokeSessions`, which clears this key; the short
  TTL bounds the one race that remains (a request that read the database just before a revocation writing
  `1` just after it). With Redis unavailable the cache reads as a miss and every request checks Postgres
  — it fails closed, never open.
 */
const SESSION_CACHE_TTL_SECONDS = 60;

export const assertSessionActive = async (sessionId: string, memberId: string, workspaceId: string) => {
    const key = sessionCacheKey(sessionId);
    if (await cache.get(key)) return;

    const session = await orm.Session
        .where({ id: sessionId, memberId, workspaceId })
        .where((s) => s.expiresAt.gt(new Date().toISOString()))
        .select("id")
        .first();
    appAssert(session, UNAUTHORIZED, "Session expired", appErrorCode.InvalidAccessToken);

    const member = await orm.Member
        .where({ id: memberId, workspaceId })
        .select("status", "role")
        .first();
    appAssert(member, UNAUTHORIZED, "Member not found", appErrorCode.InvalidAccessToken);
    appAssert(member.status !== "removed", UNAUTHORIZED, "Account removed", appErrorCode.InvalidAccessToken);

    void cache.set(key, "1", SESSION_CACHE_TTL_SECONDS);
};

const authenticate = catchError(async (req, _res, next) => {
    const accessToken = req.cookies.accessToken as string | undefined;
    appAssert(accessToken, UNAUTHORIZED, "Not Authorized", appErrorCode.InvalidAccessToken);

    const { error, payload } = verifyToken<AccessTokenPayload>(accessToken);

    appAssert(
        payload,
        UNAUTHORIZED,
        error === "jwt expired" ? "Token expired" : "Invalid token",
        error === "jwt expired" ? appErrorCode.TokenExpired : appErrorCode.InvalidAccessToken
    );

    await assertSessionActive(payload.sessionId, payload.memberId, payload.workspaceId);

    req.memberId = payload.memberId;
    req.workspaceId = payload.workspaceId;
    req.sessionId = payload.sessionId;
    req.role = payload.role;
    next();
});

export default authenticate;
