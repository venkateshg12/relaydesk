import z from "zod";
import { acceptInvitationSchema, inviteMemberSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError.js";
import {
    acceptInvitationService,
    getInvitationDetailsService,
    getTeamService,
    inviteMemberService,
    listMemberOptionsService,
    removeMemberService,
    revokeInvitationService
} from "../services/team.service.js";
import { CREATED, OK } from "../constants/http.js";
import { ok } from "../utils/api/index.js";
import { setAuthCookies } from "../utils/auth/cookies.js";

// Ids are uuid columns: a malformed one is a 400 here instead of a Postgres error (500) later.
const idSchema = z.string().uuid({ message: "Invalid id" });
const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/, { message: "Invalid invitation link" });

export const listMembersHandler = catchError(async (req, res) => {
    return res.status(OK).json(ok({ members: await listMemberOptionsService(req.workspaceId) }));
});

export const getTeamHandler = catchError(async (req, res) => {
    const team = await getTeamService(req.workspaceId);
    return res.status(OK).json(ok(team));
});

export const inviteMemberHandler = catchError(async (req, res) => {
    const data = inviteMemberSchema.parse(req.body);
    const invitation = await inviteMemberService(req.workspaceId, req.memberId, data);
    return res.status(CREATED).json(ok(invitation));
});

export const revokeInvitationHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const result = await revokeInvitationService(req.workspaceId, id);
    return res.status(OK).json(ok(result));
});

export const removeMemberHandler = catchError(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const result = await removeMemberService(req.workspaceId, req.memberId, id);
    return res.status(OK).json(ok(result));
});

export const getInvitationDetailsHandler = catchError(async (req, res) => {
    const token = tokenSchema.parse(req.params.token);
    const details = await getInvitationDetailsService(token);
    return res.status(OK).json(ok(details));
});

export const acceptInvitationHandler = catchError(async (req, res) => {
    const token = tokenSchema.parse(req.params.token);
    const data = acceptInvitationSchema.parse({ ...req.body, userAgent: req.headers["user-agent"] });

    const { member, workspace, accessToken, refreshToken } = await acceptInvitationService(token, data);

    return setAuthCookies({ res, accessToken, refreshToken })
        .status(CREATED)
        .json(ok({ member, workspace }));
});
