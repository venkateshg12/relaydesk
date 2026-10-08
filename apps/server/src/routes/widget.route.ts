import { Router } from "express";
import {
    postWidgetSessionHandler,
    getWidgetMessagesHandler,
    postWidgetMessageHandler,
    patchVisitorProfileHandler
} from "../controllers/widget.controller.js";
import { authenticateVisitor } from "../middleware/authenticateVisitor.js";
import {
    widgetSessionLimiter,
    widgetMessageLimiter
} from "../config/rateLimiter.js";

export const widgetRoutes = Router();

// prefix: /widget
widgetRoutes.post("/session", widgetSessionLimiter, postWidgetSessionHandler);
widgetRoutes.get("/messages", authenticateVisitor, widgetMessageLimiter, getWidgetMessagesHandler);
widgetRoutes.post("/messages", authenticateVisitor, widgetMessageLimiter, postWidgetMessageHandler);
widgetRoutes.patch("/visitor", authenticateVisitor, patchVisitorProfileHandler);
