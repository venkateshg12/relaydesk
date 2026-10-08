import type { Models } from "../prisma/contract.js";
import { appErrorCode } from "../constants/appErrorCode.js";
import { FORBIDDEN } from "../constants/http.js";
import { appAssert } from "../utils/errors/index.js";
import { catchError } from "../utils/errors/catchError.js";

type Role = Models.public_Member["role"];

export const requireRole = (...roles: Role[]) =>
    catchError(async (req, _res, next) => {
        appAssert(
            roles.includes(req.role),
            FORBIDDEN,
            "Access forbidden: insufficient role permissions",
            appErrorCode.Forbidden
        );
        next();
    });

export default requireRole;
