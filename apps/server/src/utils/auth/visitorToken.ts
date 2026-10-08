import jwt from "jsonwebtoken";
import { VISITOR_TOKEN_SECRET } from "../../constants/env.js";

export interface VisitorTokenPayload {
    visitorId: string;
    workspaceId: string;
}

const ALGORITHM = "HS256";
const AUDIENCE = "visitor";
const EXPIRES_IN = "180d";

export const signVisitorToken = (payload: VisitorTokenPayload): string => {
    return jwt.sign(payload, VISITOR_TOKEN_SECRET, {
        algorithm: ALGORITHM,
        audience: AUDIENCE,
        expiresIn: EXPIRES_IN,
    });
};

export const verifyVisitorToken = (
    token: string
): { payload?: VisitorTokenPayload; error?: string } => {
    try {
        const payload = jwt.verify(token, VISITOR_TOKEN_SECRET, {
            algorithms: [ALGORITHM],
            audience: AUDIENCE,
        }) as VisitorTokenPayload;

        return { payload };
    } catch (error: unknown) {
        if (error instanceof Error) {
            return { error: error.message };
        }
        return { error: "Invalid visitor token" };
    }
};
