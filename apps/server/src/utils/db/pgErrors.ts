import { z } from "zod";
import appAssert from "../errors/appAssert.js";
import { CONFLICT } from "../../constants/http.js";

/*
  Postgres reports a unique-index violation as SQLSTATE 23505 — Prisma 8 normalises it onto
  `sqlState`, a raw pg error carries it on `code`.
 */
export const isDuplicateKeyError = (error: unknown): boolean => {
    const err = error as { sqlState?: string; code?: string } | null;
    return err?.sqlState === "23505" || err?.code === "23505";
};

export const withDuplicateGuard = async <T>(message: string, run: () => Promise<T>): Promise<T> => {
    try {
        return await run();
    } catch (error) {
        appAssert(!isDuplicateKeyError(error), CONFLICT, message);
        throw error;
    }
};

// Postgres reports "rows still reference this one" as SQLSTATE 23503.
export const isForeignKeyError = (error: unknown): boolean => {
    const err = error as { sqlState?: string; code?: string } | null;
    return err?.sqlState === "23503" || err?.code === "23503";
};

// Ids are uuid columns: a malformed one would make Postgres throw (a 500) instead of a clean 400.
export const isUuid = (value: string): boolean => z.string().uuid().safeParse(value).success;
