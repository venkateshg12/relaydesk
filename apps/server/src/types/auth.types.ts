import type { Models } from "../prisma/contract";

export type RefreshTokenPayload = {
    sessionId: Models.public_Session["id"];
    jti: string;
};

export type AccessTokenPayload = {
    memberId: Models.public_Member["id"];
    workspaceId: Models.public_Workspace["id"];
    role: Models.public_Member["role"];
    sessionId: Models.public_Session["id"];
};
