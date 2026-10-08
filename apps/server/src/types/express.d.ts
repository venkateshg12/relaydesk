import type { Models } from "../prisma/contract";

declare global {
    namespace Express {
        interface Request {
            memberId: Models.public_Member["id"];
            workspaceId: Models.public_Workspace["id"];
            sessionId: Models.public_Session["id"];
            role: Models.public_Member["role"];
            visitorId?: string;
        }
    }
}

export {};
