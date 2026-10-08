"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  createSavedReplySchema,
  type CreateSavedReplySchema,
  type SavedReplyItem,
} from "@repo/types";
import { useSavedReplies } from "@/hooks/inbox/useSavedReplies";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY: CreateSavedReplySchema = { title: "", shortcut: "", body: "" };

// One dialog for both: `reply` set means editing it, `null` with `isOpen` means writing a new one.
export function SavedReplyDialog({
  isOpen,
  reply,
  onClose,
}: {
  isOpen: boolean;
  reply: SavedReplyItem | null;
  onClose: () => void;
}) {
  const { create, update } = useSavedReplies();
  const mutation = reply ? update : create;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSavedReplySchema>({
    resolver: zodResolver(createSavedReplySchema),
    defaultValues: EMPTY,
  });

  // Each time the dialog opens it starts from the reply being edited, or empty.
  useEffect(() => {
    if (isOpen) {
      reset(
        reply
          ? { title: reply.title, shortcut: reply.shortcut, body: reply.body }
          : EMPTY,
      );
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [isOpen, reply, reset]);

  const onSubmit = (data: CreateSavedReplySchema) => {
    const options = { onSuccess: onClose };
    if (reply) update.mutate({ id: reply.id, data }, options);
    else create.mutate(data, options);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {reply ? "Edit saved reply" : "New saved reply"}
          </DialogTitle>
          <DialogDescription>
            Agents type / and the shortcut to insert it. They can edit the text
            before sending.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="saved-reply-title">Title</Label>
            <Input
              id="saved-reply-title"
              placeholder="Opening hours"
              autoComplete="off"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="saved-reply-shortcut">Shortcut</Label>
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-sm text-muted-foreground"
                aria-hidden
              >
                /
              </span>
              <Input
                id="saved-reply-shortcut"
                placeholder="hours"
                autoComplete="off"
                className="font-mono"
                {...register("shortcut")}
              />
            </div>
            {errors.shortcut && (
              <p className="text-xs text-destructive">
                {errors.shortcut.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="saved-reply-body">Reply</Label>
            <Textarea
              id="saved-reply-body"
              rows={5}
              placeholder="We're open Monday to Saturday, 9 to 5."
              {...register("body")}
            />
            {errors.body && (
              <p className="text-xs text-destructive">{errors.body.message}</p>
            )}
          </div>

          {mutation.error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              {mutation.error.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              {reply ? "Save changes" : "Create reply"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
