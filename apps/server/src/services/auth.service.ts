import crypto from "crypto";
import type { ChangePasswordSchema, LoginInSchema, SignUpSchema, UpdateProfileSchema } from "@repo/types";
import { orm, db } from "../prisma/db.js";
import type { Models } from "../prisma/contract.js";
import { appAssert } from "../utils/errors/index.js";
import { BAD_REQUEST, CONFLICT, NOT_FOUND, UNAUTHORIZED } from "../constants/http.js";
import { compareValue, hashValue } from "../utils/auth/password.js";
import { omitPassword } from "../utils/auth/omitPassword.js";
import type { GoogleProfile } from "../utils/auth/google.js";
import { thirtyDaysFromNow } from "../utils/date/date.js";
import { refreshTokenSignOptions, refreshTokenVerifyOptions, signToken, verifyToken } from "../utils/auth/jwt.js";
import type { RefreshTokenPayload } from "../types/auth.types.js";
import { appErrorCode } from "../constants/appErrorCode.js";
import { withDuplicateGuard } from "../utils/db/pgErrors.js";
import { cache, sessionCacheKey } from "../utils/cache/index.js";

const dummyPasswordHash = hashValue(crypto.randomBytes(32).toString("hex"));

const REFRESH_REUSE_GRACE_MS = 30 * 1000;

const newPublicKey = () => "rd_pk_" + crypto.randomBytes(18).toString("base64url");

type SessionMember = Pick<Models.public_Member, "id" | "workspaceId" | "role">;

const signAccessToken = (member: SessionMember, sessionId: Models.public_Session["id"]) =>
    signToken({
        memberId: member.id,
        workspaceId: member.workspaceId,
        role: member.role,
        sessionId
    });

const signRefreshToken = (sessionId: Models.public_Session["id"], jti: string) =>
    signToken({ sessionId, jti }, refreshTokenSignOptions);

export const createSessionAndTokens = async (member: SessionMember, userAgent?: string) => {
    const refreshJti = crypto.randomUUID();

    const session = await orm.Session.create({
        memberId: member.id,
        workspaceId: member.workspaceId,
        userAgent,
        refreshJti,
        expiresAt: thirtyDaysFromNow().toISOString()
    });

    return {
        accessToken: signAccessToken(member, session.id),
        refreshToken: signRefreshToken(session.id, refreshJti)
    };
};

// The one path that ends sessions. `exceptSessionId` exists because the filter only takes the
// equality form of `.where`, so "all of this member's sessions but the current one" can't be expressed
// as a filter.
export const revokeSessions = async (
    filter: Parameters<typeof orm.Session.where>[0],
    exceptSessionId?: Models.public_Session["id"]
) => {
    let query = orm.Session.where(filter);
    if (exceptSessionId) {
        query = query.where((s) => s.id.neq(exceptSessionId));
    }

    const sessions = await query.select("id").all();

    if (sessions.length === 0) return 0;
    const ids = sessions.map((s) => s.id);

    await orm.Session.where((s) => s.id.in(ids)).deleteAll();
    await cache.del(...ids.map(sessionCacheKey));

    return ids.length;
};

export const signUpService = async ({ name, email, password, businessName, userAgent }: SignUpSchema) => {
    // Hashed before the transaction opens, so a pooled connection isn't held for the length of argon2.
    const passwordHash = await hashValue(password);

    const { workspace, member } = await withDuplicateGuard(
        "An account with that email already exists",
        async () => {
            return await db.transaction(async (tx) => {
                const workspace = await tx.orm.public.Workspace.create({
                    name: businessName,
                    publicKey: newPublicKey(),
                    widgetColor: "#2450E6"
                });
                const member = await tx.orm.public.Member.create({
                    workspaceId: workspace.id,
                    name,
                    email,
                    passwordHash,
                    role: "admin"
                });
                return { workspace, member };
            });
        }
    );

    const { accessToken, refreshToken } = await createSessionAndTokens(member, userAgent);

    return {
        member: omitPassword(member),
        workspace,
        accessToken,
        refreshToken
    };
};

export const loginUser = async ({ email, password, userAgent }: LoginInSchema) => {
    const member = await orm.Member.where({ email }).first();

    // validate the password from the request — against a dummy hash when there's nothing to
    // compare, so an unknown email takes as long to reject as a wrong password
    const isValid = member?.passwordHash
        ? await compareValue(password, member.passwordHash)
        : await compareValue(password, await dummyPasswordHash).then(() => false);

    appAssert(member && isValid, UNAUTHORIZED, "Invalid email or password");
    appAssert(member.status !== "removed", UNAUTHORIZED, "This account is no longer active");

    const workspace = await orm.Workspace.where({ id: member.workspaceId }).first();
    appAssert(workspace, NOT_FOUND, "Workspace not found");

    const { accessToken, refreshToken } = await createSessionAndTokens(member, userAgent);

    return {
        member: omitPassword(member),
        workspace,
        accessToken,
        refreshToken
    };
};

/*
  Signs in with a verified Google identity (see `verifyGoogleIdToken`):
  - a member already linked to this Google account signs in;
  - an email that belongs to a *password* account is refused. RelayDesk sign-up doesn't verify email, so anyone can
    register someone else's address as a workspace admin — linking a Google login to that account would put the
    real owner inside the squatter's workspace. (The e-commerce original takes such an account over; there it
    holds no shared data. Here the account is a tenant, so the owner uses their password.)
  - an unknown email creates a workspace and its admin ("Sign up with Google") when a business name came with it,
    and is otherwise "no account" — accepting an invitation with Google is in team.service.
 */
export const googleSignInService = async (
    profile: GoogleProfile,
    { businessName, userAgent }: { businessName?: string; userAgent?: string }
) => {
    const existing = await orm.Member.where({ email: profile.email }).first();

    if (existing) {
        appAssert(existing.status !== "removed", UNAUTHORIZED, "This account is no longer active");
        appAssert(
            existing.authProvider === "google" && existing.googleId === profile.googleId,
            CONFLICT,
            "This email already has a password account. Log in with your password."
        );
        const member = await orm.Member
            .where({ id: existing.id, workspaceId: existing.workspaceId })
            .update({ avatar: profile.avatar ?? existing.avatar, updatedAt: new Date().toISOString() });
        const workspace = await orm.Workspace.where({ id: existing.workspaceId }).first();
        appAssert(member && workspace, NOT_FOUND, "Workspace not found");

        const tokens = await createSessionAndTokens(member, userAgent);
        return { member: omitPassword(member), workspace, ...tokens };
    }

    appAssert(businessName, NOT_FOUND, "There's no RelayDesk account for this email. Sign up first.");

    const { workspace, member } = await withDuplicateGuard("An account with that email already exists", () =>
        db.transaction(async (tx) => {
            const workspace = await tx.orm.public.Workspace.create({
                name: businessName,
                publicKey: newPublicKey(),
                widgetColor: "#2450E6"
            });
            const member = await tx.orm.public.Member.create({
                workspaceId: workspace.id,
                name: profile.name,
                email: profile.email,
                passwordHash: null,
                googleId: profile.googleId,
                authProvider: "google",
                avatar: profile.avatar,
                role: "admin"
            });
            return { workspace, member };
        })
    );

    const tokens = await createSessionAndTokens(member, userAgent);
    return { member: omitPassword(member), workspace, ...tokens };
};

export const refreshUserAccessToken = async (refreshToken: string) => {
    const { payload } = verifyToken<RefreshTokenPayload>(refreshToken, {
        ...refreshTokenVerifyOptions
    });
    appAssert(payload, UNAUTHORIZED, "Invalid refresh token", appErrorCode.InvalidAccessToken);

    const session = await orm.Session.where({ id: payload.sessionId }).first();

    const now = Date.now();
    appAssert(
        session && new Date(session.expiresAt).getTime() > now,
        UNAUTHORIZED,
        "Session expired",
        appErrorCode.InvalidAccessToken
    );

    const member = await orm.Member.where({
        id: session.memberId,
        workspaceId: session.workspaceId
    })
        .select("id", "workspaceId", "role", "status")
        .first();

    appAssert(member, UNAUTHORIZED, "Member not found", appErrorCode.InvalidAccessToken);
    appAssert(member.status !== "removed", UNAUTHORIZED, "Member account removed", appErrorCode.InvalidAccessToken);

    // Rotate only if the presented token is still the current one. Doing it as a conditional update
    // means two concurrent refreshes can't both rotate and leave one of them holding a dead token.
    const newJti = crypto.randomUUID();

    const rotated = await orm.Session.where({
        id: session.id,
        refreshJti: payload.jti
    }).update({
        refreshJti: newJti,
        prevRefreshJti: payload.jti,
        rotatedAt: new Date(now).toISOString(),
        expiresAt: thirtyDaysFromNow().toISOString()
    });

    let currentJti: string;

    if (rotated) {
        currentJti = newJti;
    } else {
        // Lost the race, or the token is stale. Re-read to see which.
        const latest = await orm.Session.where({ id: session.id })
            .select("refreshJti", "prevRefreshJti", "rotatedAt")
            .first();

        const isRecentlyReplaced =
            latest?.refreshJti &&
            latest.prevRefreshJti === payload.jti &&
            latest.rotatedAt &&
            now - new Date(latest.rotatedAt).getTime() < REFRESH_REUSE_GRACE_MS;

        if (!isRecentlyReplaced) {
            await revokeSessions({ id: session.id });
            appAssert(false, UNAUTHORIZED, "Session revoked", appErrorCode.InvalidAccessToken);
        }

        currentJti = latest!.refreshJti;
    }

    return {
        accessToken: signAccessToken(member, session.id),
        newRefreshToken: signRefreshToken(session.id, currentJti)
    };
};

export const updateProfileService = async (
    memberId: string,
    workspaceId: string,
    data: UpdateProfileSchema
) => {
    const member = await orm.Member.where({ id: memberId, workspaceId }).update({
        name: data.name,
        updatedAt: new Date().toISOString()
    });

    appAssert(member, NOT_FOUND, "Member not found");

    return omitPassword(member);
};

export const changePasswordService = async (
    memberId: string,
    workspaceId: string,
    currentSessionId: string,
    data: ChangePasswordSchema
) => {
    const member = await orm.Member.where({ id: memberId, workspaceId })
        .select("id", "passwordHash")
        .first();

    appAssert(member, NOT_FOUND, "Member not found");
    appAssert(
        member.passwordHash,
        BAD_REQUEST,
        "Password change is not available for accounts signed in with Google"
    );

    const isValid = await compareValue(data.currentPassword, member.passwordHash);
    appAssert(isValid, UNAUTHORIZED, "Current password is incorrect");

    const newPasswordHash = await hashValue(data.newPassword);
    await orm.Member.where({ id: member.id, workspaceId }).update({
        passwordHash: newPasswordHash,
        updatedAt: new Date().toISOString()
    });

    // Sign out of every other device/session, keep the current one active
    await revokeSessions({ memberId: member.id, workspaceId }, currentSessionId);

    return { message: "Password changed successfully. You've been signed out of all other devices." };
};

// The logged-in member and their workspace, for `GET /auth/me`.
export const getProfileService = async (memberId: string, workspaceId: string) => {
    const member = await orm.Member.where({ id: memberId, workspaceId }).first();
    appAssert(member, NOT_FOUND, "Member not found!");

    const workspace = await orm.Workspace
        .where({ id: workspaceId })
        .select("id", "name", "publicKey", "widgetColor", "isDemo")
        .first();
    appAssert(workspace, NOT_FOUND, "Workspace not found!");

    return { member: omitPassword(member), workspace };
};

// The member's own unexpired sessions, newest first, with the current one marked.
export const listSessionsService = async (memberId: string, workspaceId: string, currentSessionId: string) => {
    const sessions = await orm.Session
        .where({ memberId, workspaceId })
        .where((s) => s.expiresAt.gt(new Date().toISOString()))
        .select("id", "userAgent", "createdAt")
        .orderBy((s) => s.createdAt.desc())
        .all();

    return sessions.map((session) => ({ ...session, isCurrent: session.id === currentSessionId }));
};
