import { Router } from "express";
import {
    listConversationsHandler,
    getConversationDetailsHandler,
    getConversationMessagesHandler,
    postConversationMessageHandler,
    assignConversationHandler,
    unassignConversationHandler,
    resolveConversationHandler,
    reopenConversationHandler,
    getConversationCountsHandler,
} from "../controllers/conversation.controller.js";
import {
    listNotesHandler,
    postNoteHandler,
} from "../controllers/note.controller.js";
import authenticate from "../middleware/authenticate.js";
import { protectedApiLimiter } from "../config/rateLimiter.js";

export const conversationRoutes = Router();

// prefix: /conversations
conversationRoutes.use(authenticate, protectedApiLimiter);

// List & counts
conversationRoutes.get("/counts", getConversationCountsHandler);
conversationRoutes.get("/", listConversationsHandler);

// Detail & messages
conversationRoutes.get("/:id", getConversationDetailsHandler);
conversationRoutes.get("/:id/messages", getConversationMessagesHandler);
conversationRoutes.post("/:id/messages", postConversationMessageHandler);

// Assignment & state
conversationRoutes.post("/:id/assign", assignConversationHandler);
conversationRoutes.post("/:id/unassign", unassignConversationHandler);
conversationRoutes.post("/:id/resolve", resolveConversationHandler);
conversationRoutes.post("/:id/reopen", reopenConversationHandler);

// Internal notes (agent only, never reaches visitor)
conversationRoutes.get("/:id/notes", listNotesHandler);
conversationRoutes.post("/:id/notes", postNoteHandler);
