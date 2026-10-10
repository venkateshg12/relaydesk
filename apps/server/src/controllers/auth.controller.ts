import {
    changePasswordSchema,
    loginInSchema,
    resendVerificationSchema,
    signUpSchema,
    updateProfileSchema,
    verifyEmailSchema
} from "@repo/types";
import { CREATED, OK, UNAUTHORIZED } from "../constants/http.js";
import { ok } from "../utils/api/apiEnvelope.js";
import {
    changePasswordService,
    loginUser,
    refreshUserAccessToken,
    resendVerificationEmailService,
    revokeSessions,
    signUpService,
    updateProfileService,
    getProfileService,
    verifyEmailService
} from "../services/auth.service.js";
import {
    clearAuthCookies,
    getAccessTokenCookieOptions,
    getRefreshTokenCookieOptions,
    setAuthCookies
} from "../utils/auth/cookies.js";
import { verifyAccessTokenIgnoringExpiry } from "../utils/auth/jwt.js";
import { appAssert, catchError } from "../utils/errors/index.js";

export const signUpHandler = catchError(async (req, res) => {
    const request = signUpSchema.parse({
        ...req.body,
        userAgent: req.headers["user-agent"]
    });

    const { email } = await signUpService(request);

    // No cookies: the person is not signed in until they open the emailed link (`verifyEmailHandler`).
    return res
        .status(CREATED)
        .json(ok({ email, requiresVerification: true, message: "Check your email to finish creating your workspace." }));
});

export const verifyEmailHandler = catchError(async (req, res) => {
    const request = verifyEmailSchema.parse({
        ...req.body,
        userAgent: req.headers["user-agent"]
    });

    const { member, workspace, accessToken, refreshToken } = await verifyEmailService(request.token, request.userAgent);

    return setAuthCookies({ res, accessToken, refreshToken })
        .status(OK)
        .json(ok({ member, workspace, message: "Email verified!" }));
});

export const resendVerificationHandler = catchError(async (req, res) => {
    const { email } = resendVerificationSchema.parse(req.body);

    return res.status(OK).json(ok(await resendVerificationEmailService(email)));
});

export const loginHandler = catchError(async (req, res) => {
    const request = loginInSchema.parse({
        ...req.body,
        userAgent: req.headers["user-agent"]
    });

    const { member, workspace, accessToken, refreshToken } = await loginUser(request);

    return setAuthCookies({ res, accessToken, refreshToken })
        .status(OK)
        .json(ok({ member, workspace, message: "Login Successful!" }));
});

export const logoutHandler = catchError(async (req, res) => {
    const accessToken = req.cookies.accessToken as string | undefined;
    const { payload } = accessToken ? verifyAccessTokenIgnoringExpiry(accessToken) : {};
    if (payload) {
        await revokeSessions({ id: payload.sessionId });
    }

    clearAuthCookies(res).status(OK).json(ok({ message: "Logout Successful!" }));
});

export const refreshHandler = catchError(async (req, res) => {
    const refreshToken = req.cookies.refreshToken as string | undefined;
    appAssert(refreshToken, UNAUTHORIZED, "Missing refresh token");

    const { accessToken, newRefreshToken } = await refreshUserAccessToken(refreshToken);

    return res
        .status(OK)
        .cookie("refreshToken", newRefreshToken, getRefreshTokenCookieOptions())
        .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
        .json(ok({
            message: "Access token refreshed"
        }));
});

export const getProfileData = catchError(async (req, res) => {
    const profile = await getProfileService(req.memberId, req.workspaceId);
    return res.status(OK).json(ok(profile));
});

export const updateProfileHandler = catchError(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);
    const member = await updateProfileService(req.memberId, req.workspaceId, data);
    return res.status(OK).json(ok({ member }));
});

export const changePasswordHandler = catchError(async (req, res) => {
    const data = changePasswordSchema.parse(req.body);
    const result = await changePasswordService(req.memberId, req.workspaceId, req.sessionId, data);
    return res.status(OK).json(ok(result));
});
