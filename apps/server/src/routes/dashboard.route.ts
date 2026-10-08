import { Router } from "express";
import { getDashboardStatsHandler } from "../controllers/dashboard.controller.js";
import authenticate from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";
import { protectedApiLimiter } from "../config/rateLimiter.js";

export const dashboardRoutes = Router();

// prefix: /dashboard
dashboardRoutes.use(authenticate, protectedApiLimiter, requireRole("admin"));

dashboardRoutes.get("/", getDashboardStatsHandler);
