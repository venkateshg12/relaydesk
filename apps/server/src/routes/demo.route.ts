import { Router } from "express";
import {
    postDemoSessionHandler,
    getDemoStatsHandler,
} from "../controllers/demo.controller.js";
import { demoSessionLimiter } from "../config/rateLimiter.js";

export const demoRoutes = Router();

// prefix: /demo
demoRoutes.post("/session", demoSessionLimiter, postDemoSessionHandler);
demoRoutes.get("/stats", getDemoStatsHandler);
