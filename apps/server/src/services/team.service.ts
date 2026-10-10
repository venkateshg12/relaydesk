import type { AcceptInvitationSchema, InviteMemberSchema, MemberOption } from "@repo/types";
import { orm, db } from "../prisma/db.js";
import { appAssert } from "../utils/errors/index.js";
import { BAD_REQUEST, CONFLICT, FORBIDDEN, NOT_FOUND } from "../constants/http.js";
import { createVerificationToken, hashVerificationToken } from "../utils/auth/verificationToken.js";
import { twoDaysFromNow } from "../utils/date/date.js";
import { withDuplicateGuard } from "../utils/db/pgErrors.js";
import { EmailProducer } from "../jobs/producers/email.producer.js";
import { hashValue } from "../utils/auth/password.js";
import { omitPassword } from "../utils/auth/omitPassword.js";
import type { GoogleProfile } from "../utils/auth/google.js";
import { createSessionAndTokens, revokeSessions } from "./auth.service.js";
import { disconnectMember, emitConversationUpdated, emitPresence } from "../realtime/emit.js";
import { presence } from "../realtime/presence.js";

const INVITE_EXPIRED_OR_USED = "This invitation has expired or was already used";

// For the "Assign to…" menu, which agents use too: names and roles only, no emails.
export const listMemberOptionsService = async (workspaceId: string): Promise<MemberOption[]> =>
    await orm.Member
        .where({ workspaceId, status: "active" })
        .select("id", "name", "role")
        .orderBy((m) => m.name.asc())
        .all();

export const getTeamService = async (workspaceId: string) => {
    const members = await orm.Member
        .where({ workspaceId, status: "active" })
        .select("id", "name", "email", "role", "status", "createdAt")
        .orderBy((m) => m.createdAt.asc())
        .all();

    const pendingInvitations = await orm.Invitation
        .where({ workspaceId })
        .where((i) => i.acceptedAt.isNull())
        .where((i) => i.expiresAt.gt(new Date().toISOString()))
        .select("id", "email", "expiresAt", "createdAt")
        .orderBy((i) => i.createdAt.desc())
        .all();

    return { members, pendingInvitations };
};

export const inviteMemberService = async (
    workspaceId: string,
    inviterMemberId: string,
    { email }: InviteMemberSchema
) => {
    // Demo workspaces are public playgrounds: nobody may be invited from one (it would send real email).
    const target = await orm.Workspace.where({ id: workspaceId }).select("isDemo").first();
    appAssert(!target?.isDemo, FORBIDDEN, "Invitations are turned off in the demo");

    // One email, one workspace in v1. This check only gives a clear message early; the unique email
    // index still decides when the invitation is accepted.
    const existingMember = await orm.Member.where({ email }).select("id").first();
    appAssert(!existingMember, CONFLICT, "An account with that email already exists");

    const inviter = await orm.Member.where({ id: inviterMemberId, workspaceId }).select("name").first();
    const workspace = await orm.Workspace.where({ id: workspaceId }).select("name").first();
    appAssert(inviter && workspace, NOT_FOUND, "Workspace not found");

    const { token, tokenHash } = createVerificationToken();

    // The unique (workspaceId, lower(email)) index allows one invitation per address. An expired or
    // already-accepted one is dead, so it is replaced; a live one makes the insert fail → 409.
    const invitation = await withDuplicateGuard("An invitation for that email is already pending", () =>
        db.transaction(async (tx) => {
            const nowIso = new Date().toISOString();
            await tx.orm.public.Invitation
                .where({ workspaceId, email })
                .where((i) => i.expiresAt.lte(nowIso))
                .deleteAll();
            await tx.orm.public.Invitation
                .where({ workspaceId, email })
                .where((i) => i.acceptedAt.isNotNull())
                .deleteAll();

            return tx.orm.public.Invitation.create({
                workspaceId,
                email,
                tokenHash,
                expiresAt: twoDaysFromNow().toISOString(),
                invitedById: inviterMemberId
            });
        })
    );

    // Enqueued after the commit, so the worker always finds the row. If the queue is unreachable the
    // invitation is withdrawn, so the admin can simply try again instead of hitting "already pending".
    try {
        await EmailProducer.addSendInvitationJob({
            invitationId: invitation.id,
            email,
            workspaceName: workspace.name,
            inviterName: inviter.name,
            token
        });
    } catch (error) {
        await orm.Invitation.where({ id: invitation.id, workspaceId }).deleteAll();
        throw error;
    }

    return {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt
    };
};

export const revokeInvitationService = async (workspaceId: string, invitationId: string) => {
    const deleted = await orm.Invitation.where({ id: invitationId, workspaceId }).deleteAll();
    appAssert(deleted.length > 0, NOT_FOUND, "Invitation not found");
    return { message: "Invitation revoked" };
};

export const getInvitationDetailsService = async (token: string) => {
    const invitation = await orm.Invitation
        .where({ tokenHash: hashVerificationToken(token) })
        .where((i) => i.expiresAt.gt(new Date().toISOString()))
        .where((i) => i.acceptedAt.isNull())
        .select("email", "workspaceId")
        .first();
    appAssert(invitation, BAD_REQUEST, INVITE_EXPIRED_OR_USED);

    const workspace = await orm.Workspace.where({ id: invitation.workspaceId }).select("name").first();
    appAssert(workspace, NOT_FOUND, "Workspace not found");

    return { email: invitation.email, workspaceName: workspace.name };
};

/*
  Consumes an invitation and creates the member it was for, in one transaction. Find-and-consume is one
  conditional update — of two clicks on the same link only one matches. `fields` is what differs between
  accepting with a password and accepting with Google; `requiredEmail` (Google) must be the invited address.
 */
const createMemberFromInvitation = (
    token: string,
    fields: { name: string; passwordHash: string | null; googleId?: string; authProvider?: "local" | "google"; avatar?: string },
    requiredEmail?: string
) =>
    withDuplicateGuard("An account with that email already exists", () =>
        db.transaction(async (tx) => {
            const nowIso = new Date().toISOString();
            const invitation = await tx.orm.public.Invitation
                .where({ tokenHash: hashVerificationToken(token) })
                .where((i) => i.expiresAt.gt(nowIso))
                .where((i) => i.acceptedAt.isNull())
                .update({ acceptedAt: nowIso });
            appAssert(invitation, BAD_REQUEST, INVITE_EXPIRED_OR_USED);
            // Throwing rolls back the update above, so a wrong Google account doesn't burn the invitation.
            appAssert(
                !requiredEmail || invitation.email.toLowerCase() === requiredEmail,
                FORBIDDEN,
                "This invitation was sent to a different email address"
            );

            const member = await tx.orm.public.Member.create({
                workspaceId: invitation.workspaceId,
                email: invitation.email,
                role: "agent",
                // The invitation link was mailed to this address, and opening it is the proof.
                emailVerified: true,
                ...fields
            });

            const workspace = await tx.orm.public.Workspace.where({ id: invitation.workspaceId }).first();
            appAssert(workspace, NOT_FOUND, "Workspace not found");

            return { member, workspace };
        })
    );

export const acceptInvitationService = async (
    token: string,
    { name, password, userAgent }: AcceptInvitationSchema
) => {
    // Hashed before the transaction opens, so a pooled connection isn't held for the length of argon2.
    const passwordHash = await hashValue(password);
    const { member, workspace } = await createMemberFromInvitation(token, { name, passwordHash });

    const { accessToken, refreshToken } = await createSessionAndTokens(member, userAgent);

    return { member: omitPassword(member), workspace, accessToken, refreshToken };
};

// The same, with a Google account: no password, and the Google email must be the one invited.
export const acceptInvitationWithGoogleService = async (token: string, profile: GoogleProfile, userAgent?: string) => {
    const { member, workspace } = await createMemberFromInvitation(
        token,
        { name: profile.name, passwordHash: null, googleId: profile.googleId, authProvider: "google", avatar: profile.avatar },
        profile.email
    );

    const { accessToken, refreshToken } = await createSessionAndTokens(member, userAgent);

    return { member: omitPassword(member), workspace, accessToken, refreshToken };
};

export const removeMemberService = async (
    workspaceId: string,
    adminMemberId: string,
    targetMemberId: string
) => {
    // A valid id from another workspace is simply not found — never 403, which would confirm it exists.
    const target = await orm.Member
        .where({ id: targetMemberId, workspaceId, status: "active" })
        .select("id", "role")
        .first();
    appAssert(target, NOT_FOUND, "Member not found");
    appAssert(target.id !== adminMemberId, BAD_REQUEST, "You can't remove yourself");

    if (target.role === "admin") {
        const admins = await orm.Member.where({ workspaceId, role: "admin", status: "active" }).select("id").all();
        appAssert(admins.length > 1, BAD_REQUEST, "A workspace needs at least one admin");
    }

    // The conversations the removed agent held, read in the same transaction that frees them, so the
    // agents' lists can be told about each one after the commit.
    const freed = await db.transaction(async (tx) => {
        const nowIso = new Date().toISOString();
        await tx.orm.public.Member
            .where({ id: target.id, workspaceId })
            .update({ status: "removed", updatedAt: nowIso });

        // `updateAll`, not `update`: `update` changes one row, and an agent can hold many conversations.
        const held = await tx.orm.public.Conversation
            .where({ workspaceId, assigneeId: target.id, status: "assigned" })
            .select("id", "visitorId", "lastMessageAt", "lastMessagePreview")
            .all();
        await tx.orm.public.Conversation
            .where({ workspaceId, assigneeId: target.id, status: "assigned" })
            .updateAll({ assigneeId: null, status: "unassigned", updatedAt: nowIso });
        return held;
    });

    // Deletes the sessions and clears their cache entries, so access ends on the next request.
    await revokeSessions({ memberId: target.id, workspaceId });

    // Real time, after the commit: end their live connections, show them offline, and move each
    // conversation they held to "unassigned" in everyone's list.
    disconnectMember(target.id);
    emitPresence(workspaceId, {
        memberId: target.id,
        status: "offline",
        workspaceOnline: await presence.isWorkspaceOnline(workspaceId),
    });
    for (const conversation of freed) {
        emitConversationUpdated(workspaceId, {
            id: conversation.id,
            visitorId: conversation.visitorId,
            status: "unassigned",
            assigneeId: null,
            assignee: null,
            lastMessageAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toISOString() : null,
            preview: conversation.lastMessagePreview,
        });
    }

    return { message: "Member removed" };
};
