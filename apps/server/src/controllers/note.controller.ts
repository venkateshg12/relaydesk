import z from "zod";
import { createNoteSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError.js";
import {
    listNotesService,
    createNoteService,
} from "../services/note.service.js";
import { CREATED, OK } from "../constants/http.js";
import { ok } from "../utils/api/index.js";

const idSchema = z.string().uuid({ message: "Invalid conversation id" });

export const listNotesHandler = catchError(async (req, res) => {
    const conversationId = idSchema.parse(req.params.id);

    const notes = await listNotesService({
        workspaceId: req.workspaceId,
        conversationId,
    });

    return res.status(OK).json(ok({ notes }));
});

export const postNoteHandler = catchError(async (req, res) => {
    const conversationId = idSchema.parse(req.params.id);
    const data = createNoteSchema.parse(req.body);

    const note = await createNoteService({
        workspaceId: req.workspaceId,
        conversationId,
        authorId: req.memberId,
        data,
    });

    return res.status(CREATED).json(ok({ note }));
});
