import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import { deleteSessionHandler, getSessionHandler } from "../controllers/session.controller.js";
import { protectedApiLimiter } from "../config/rateLimiter.js";

export const sessionRoutes = Router();

sessionRoutes.use(authenticate, protectedApiLimiter);

sessionRoutes.get("/", getSessionHandler);
sessionRoutes.delete("/:id", deleteSessionHandler);
