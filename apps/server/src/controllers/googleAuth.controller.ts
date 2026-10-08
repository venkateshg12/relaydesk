import { googleAuthSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError.js";
import { OK } from "../constants/http.js";
import { ok } from "../utils/api/apiEnvelope.js";
import { googleSignInService } from "../services/auth.service.js";
import { acceptInvitationWithGoogleService } from "../services/team.service.js";
import { setAuthCookies } from "../utils/auth/cookies.js";
import { verifyGoogleIdToken } from "../utils/auth/google.js";

// One endpoint for "Continue with Google": login, sign-up (with `businessName`) and invitation acceptance
// (with `invitationToken`) — the Google token is verified first, then the service decides which it is.
export const googleAuthHandler = catchError(async (req, res) => {
    const { idToken, businessName, invitationToken } = googleAuthSchema.parse(req.body);
    const profile = await verifyGoogleIdToken(idToken);
    const userAgent = req.headers["user-agent"];

    const { member, workspace, accessToken, refreshToken } = invitationToken
        ? await acceptInvitationWithGoogleService(invitationToken, profile, userAgent)
        : await googleSignInService(profile, { businessName, userAgent });

    return setAuthCookies({ res, accessToken, refreshToken })
        .status(OK)
        .json(ok({ member, workspace, message: "Google login successful!" }));
});
