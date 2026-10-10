import { Router } from "express";
import {
    changePasswordHandler,
    getProfileData,
    loginHandler,
    logoutHandler,
    refreshHandler,
    resendVerificationHandler,
    signUpHandler,
    updateProfileHandler,
    verifyEmailHandler
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
    resendVerificationLimiter,
    resendVerificationSourceLimiter,
    signupSourceLimiter,
    verifyEmailLimiter
} from "../config/rateLimiter.js";

export const authRoutes = Router();

// prefix: /auth

authRoutes.post("/signup", signupSourceLimiter, signUpHandler);
// POST, not GET: mail scanners fetch links in an email, and a GET would let them use up the single-use token.
authRoutes.post("/verify-email", verifyEmailLimiter, verifyEmailHandler);
authRoutes.post("/verify-email/resend", resendVerificationSourceLimiter, resendVerificationLimiter, resendVerificationHandler);
// Three axes, cheapest first: this source, this account, then the (source, account) pair.
authRoutes.post("/login", loginSourceLimiter, loginAccountLimiter, loginLimiter, loginHandler);
// Same budget as a password login: it is a login (and, with `businessName`, a sign-up).
authRoutes.post("/google", loginSourceLimiter, googleAuthHandler);
authRoutes.get("/refresh", refreshTokenSourceLimiter, refreshTokenLimiter, refreshHandler);
authRoutes.get("/logout", logoutHandler);
authRoutes.get("/me", authenticate, protectedApiLimiter, getProfileData);
authRoutes.patch("/me", authenticate, protectedApiLimiter, updateProfileHandler);
authRoutes.post("/me/password", authenticate, protectedApiLimiter, changePasswordHandler);
