import { Router } from "express";
import {
    changePasswordHandler,
    getProfileData,
    loginHandler,
    logoutHandler,
    refreshHandler,
    signUpHandler,
    updateProfileHandler
} from "../controllers/auth.controller.js";
import { googleAuthHandler } from "../controllers/googleAuth.controller.js";
import authenticate from "../middleware/authenticate.js";
import {
    loginAccountLimiter,
    loginLimiter,
    loginSourceLimiter,
    protectedApiLimiter,
    refreshTokenLimiter,
    refreshTokenSourceLimiter,
    signupSourceLimiter
} from "../config/rateLimiter.js";

export const authRoutes = Router();

// prefix: /auth

authRoutes.post("/signup", signupSourceLimiter, signUpHandler);
// Three axes, cheapest first: this source, this account, then the (source, account) pair.
authRoutes.post("/login", loginSourceLimiter, loginAccountLimiter, loginLimiter, loginHandler);
// Same budget as a password login: it is a login (and, with `businessName`, a sign-up).
authRoutes.post("/google", loginSourceLimiter, googleAuthHandler);
authRoutes.get("/refresh", refreshTokenSourceLimiter, refreshTokenLimiter, refreshHandler);
authRoutes.get("/logout", logoutHandler);
authRoutes.get("/me", authenticate, protectedApiLimiter, getProfileData);
authRoutes.patch("/me", authenticate, protectedApiLimiter, updateProfileHandler);
authRoutes.post("/me/password", authenticate, protectedApiLimiter, changePasswordHandler);
