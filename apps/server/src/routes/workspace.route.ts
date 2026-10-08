import { Router } from "express";
import {
    getWorkspaceSettingsHandler,
    patchWorkspaceWidgetHandler,
} from "../controllers/workspace.controller.js";
import authenticate from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";
import { protectedApiLimiter } from "../config/rateLimiter.js";

export const workspaceRoutes = Router();

// prefix: /workspace
workspaceRoutes.use(authenticate, protectedApiLimiter);

workspaceRoutes.get("/settings", getWorkspaceSettingsHandler);
workspaceRoutes.patch("/widget", requireRole("admin"), patchWorkspaceWidgetHandler);
