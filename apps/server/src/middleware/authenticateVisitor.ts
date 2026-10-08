import { appAssert } from "../utils/errors/index.js";
import { UNAUTHORIZED } from "../constants/http.js";
import { appErrorCode } from "../constants/appErrorCode.js";
import { verifyVisitorToken } from "../utils/auth/visitorToken.js";
import { orm } from "../config/db.js";
import { catchError } from "../utils/errors/catchError.js";

export const authenticateVisitor = catchError(async (req, _res, next) => {
    const authHeader = req.headers.authorization;
    appAssert(
        authHeader && authHeader.startsWith("Bearer "),
        UNAUTHORIZED,
        "Missing or invalid authorization header",
        appErrorCode.InvalidAccessToken
    );

    const token = authHeader.slice(7).trim();
    const { payload, error } = verifyVisitorToken(token);

    appAssert(
        payload,
        UNAUTHORIZED,
        error === "jwt expired" ? "Visitor token expired" : "Invalid visitor token",
        error === "jwt expired" ? appErrorCode.TokenExpired : appErrorCode.InvalidAccessToken
    );

    // Verify visitor exists in workspace
    const visitor = await orm.Visitor
        .where({ id: payload.visitorId, workspaceId: payload.workspaceId })
        .select("id")
        .first();

    appAssert(visitor, UNAUTHORIZED, "Visitor not found", appErrorCode.InvalidAccessToken);

    req.visitorId = payload.visitorId;
    req.workspaceId = payload.workspaceId;

    return next();
});
