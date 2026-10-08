import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";
import { inviteLimiter, protectedApiLimiter } from "../config/rateLimiter.js";
import {
    getTeamHandler,
    listMembersHandler,
    inviteMemberHandler,
    removeMemberHandler,
    revokeInvitationHandler
} from "../controllers/team.controller.js";

export const teamRoutes = Router();

teamRoutes.use(authenticate, protectedApiLimiter);

// Any member: the list behind "Assign to…".
teamRoutes.get("/members", listMembersHandler);

// Everything below is the admin's: the full team, invitations, removing people.
teamRoutes.use(requireRole("admin"));

teamRoutes.get("/", getTeamHandler);
teamRoutes.post("/invitations", inviteLimiter, inviteMemberHandler);
teamRoutes.delete("/invitations/:id", revokeInvitationHandler);
teamRoutes.delete("/members/:id", removeMemberHandler);
