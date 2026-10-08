import type { CookieParams } from "@repo/types";
import type { CookieOptions, Response } from "express";
import { NODE_ENV } from "../../constants/env.js";
import { fifteenMinutesFromNow, thirtyDaysFromNow } from "../date/date.js";

const isProduction = NODE_ENV === "production";
export const REFRESH_PATH = "/auth/refresh";

const defaults: CookieOptions = {
    sameSite: isProduction ? "none" : "lax",
    httpOnly: true,
    secure: isProduction
};

export const getAccessTokenCookieOptions = (): CookieOptions => ({
    ...defaults,
    expires: fifteenMinutesFromNow()
});

export const getRefreshTokenCookieOptions = (): CookieOptions => ({
    ...defaults,
    expires: thirtyDaysFromNow(),
    path: REFRESH_PATH
});

export const setAuthCookies = ({ res, accessToken, refreshToken }: CookieParams) =>
    res
        .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
        .cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

export const clearAuthCookies = (res: Response) =>
    res
        .clearCookie("accessToken", defaults)
        .clearCookie("refreshToken", { ...defaults, path: REFRESH_PATH });
