import { OAuth2Client } from "google-auth-library";
import { GOOGLE_CLIENT_ID } from "../../constants/env.js";
import { UNAUTHORIZED, INTERNAL_SERVER_ERROR } from "../../constants/http.js";
import appAssert from "../errors/appAssert.js";

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface GoogleProfile {
    googleId: string;
    email: string;
    name: string;
    avatar?: string;
}

/*
  Asks Google whether an ID token is real, was issued for *this* app (`audience`) and is unexpired, and returns
  what is inside. Only a verified email is accepted: an unverified address proves nothing about who owns it.
 */
export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleProfile> => {
    appAssert(GOOGLE_CLIENT_ID, INTERNAL_SERVER_ERROR, "Google sign-in is not configured on the server");

    const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID }).catch(() => null);
    const payload = ticket?.getPayload();
    appAssert(payload, UNAUTHORIZED, "Invalid Google credential");

    const { email, email_verified: isVerified, name, sub: googleId, picture: avatar } = payload;
    appAssert(email && isVerified, UNAUTHORIZED, "Your Google account has no verified email");

    return { googleId, email: email.trim().toLowerCase(), name: name || email.split("@")[0] || "User", avatar };
};
