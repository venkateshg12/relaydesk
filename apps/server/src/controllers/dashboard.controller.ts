import { dashboardQuerySchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError.js";
import { getDashboardStatsService } from "../services/dashboard.service.js";
import { OK } from "../constants/http.js";
import { ok } from "../utils/api/index.js";

export const getDashboardStatsHandler = catchError(async (req, res) => {
    const { tz } = dashboardQuerySchema.parse(req.query);
    const stats = await getDashboardStatsService(req.workspaceId, tz);
    return res.status(OK).json(ok({ stats }));
});
