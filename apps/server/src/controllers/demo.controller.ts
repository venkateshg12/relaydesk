import { catchError } from "../utils/errors/catchError.js";
import { createDemoSessionService } from "../services/demo.service.js";
import { getLiveStats } from "../services/stats.service.js";
import { setAuthCookies } from "../utils/auth/cookies.js";
import { CREATED, OK } from "../constants/http.js";
import { ok } from "../utils/api/index.js";

// Creates the visitor's private workspace and signs them in as its admin through the usual cookies.
export const postDemoSessionHandler = catchError(async (req, res) => {
    const { accessToken, refreshToken, ...demo } = await createDemoSessionService({ userAgent: req.headers["user-agent"] });
    setAuthCookies({ res, accessToken, refreshToken });
    return res.status(CREATED).json(ok(demo));
});

export const getDemoStatsHandler = catchError(async (_req, res) => {
    return res.status(OK).json(ok(await getLiveStats()));
});
