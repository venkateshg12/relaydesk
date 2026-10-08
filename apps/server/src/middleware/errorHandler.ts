import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors/appError.js";
import { fail, type ApiEnvelope } from "../utils/api/apiEnvelope.js";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from "../constants/http.js";
import z from "zod";
import { clearAuthCookies, REFRESH_PATH } from "../utils/auth/cookies.js";

// Validation errors use the same envelope as every other error, one entry per invalid field, so
// the client reads one shape everywhere.
const handleZodError = (res: Response, error: z.ZodError) => {
    const body: ApiEnvelope<null> = {
        status: "error",
        data: null,
        errors: error.issues.map((issue) => ({
            message: issue.message,
            code: "VALIDATION_ERROR",
            path: issue.path.join(".")
        }))
    };
    return res.status(BAD_REQUEST).json(body);
};

export function errorHandler(
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    if (req.path === REFRESH_PATH) {
        clearAuthCookies(res);
    }

    if (error instanceof z.ZodError) {
        return handleZodError(res, error);
    }

    if (error instanceof AppError) {
        return res.status(error.statusCode).json(fail(error.message, error.errorCode ?? "APP_ERROR"));
    }
    console.error("error", error);

    return res.status(INTERNAL_SERVER_ERROR).json(fail("Internal Server Error", "INTERNAL_SERVER_ERROR"));
}