import { Router } from "express";
import { acceptInvitationHandler, getInvitationDetailsHandler } from "../controllers/team.controller.js";
import { signupSourceLimiter } from "../config/rateLimiter.js";

export const invitationRoutes = Router();

// prefix: /invitations — public: the token in the link is the credential.

invitationRoutes.get("/:token", getInvitationDetailsHandler);
// Accepting creates an account (and runs argon2), so it shares the sign-up budget per source.
invitationRoutes.post("/:token/accept", signupSourceLimiter, acceptInvitationHandler);
