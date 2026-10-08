import { Router } from "express";
import {
    listSavedRepliesHandler,
    postSavedReplyHandler,
    patchSavedReplyHandler,
    deleteSavedReplyHandler,
} from "../controllers/savedReply.controller.js";
import authenticate from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";
import { protectedApiLimiter } from "../config/rateLimiter.js";

export const savedReplyRoutes = Router();

// prefix: /saved-replies
savedReplyRoutes.use(authenticate, protectedApiLimiter);

// All workspace members can list saved replies
savedReplyRoutes.get("/", listSavedRepliesHandler);

// Admin-only mutations
savedReplyRoutes.post("/", requireRole("admin"), postSavedReplyHandler);
savedReplyRoutes.patch("/:id", requireRole("admin"), patchSavedReplyHandler);
savedReplyRoutes.delete("/:id", requireRole("admin"), deleteSavedReplyHandler);
