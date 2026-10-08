"use client";

import { useState } from "react";
import { Bookmark, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { SavedReplyItem } from "@repo/types";
import { useSavedReplies } from "@/hooks/inbox/useSavedReplies";
import { SavedReplyDialog } from "@/components/admin/SavedReplyDialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminSavedRepliesPage() {
  const { savedReplies, isLoading, remove } = useSavedReplies();
  const [search, setSearch] = useState("");
  // `isDialogOpen` with no `editing` is "new"; `editing` is the reply whose edit dialog is open.
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavedReplyItem | null>(null);
  const [deleting, setDeleting] = useState<SavedReplyItem | null>(null);

  const query = search.toLowerCase();
  const visible = savedReplies.filter(
    (reply) =>
      reply.shortcut.includes(query) ||
      reply.title.toLowerCase().includes(query) ||
      reply.body.toLowerCase().includes(query),
  );

  const openDialog = (reply: SavedReplyItem | null) => {
    setEditing(reply);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.025em] text-foreground font-expanded sm:text-[34px]">
            Saved replies
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Answers your team can insert by typing{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              /
            </kbd>{" "}
            in a reply.
          </p>
        </div>
        <Button onClick={() => openDialog(null)}>
          <Plus />
          New saved reply
        </Button>
      </div>

      {savedReplies.length > 0 && (
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Search saved replies"
            placeholder="Search replies"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Bookmark className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {search
                ? "No saved reply matches that."
                : "No saved replies yet."}
            </p>
            {!search && (
              <Button variant="outline" onClick={() => openDialog(null)}>
                Write a saved reply
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Shortcut</TableHead>
                <TableHead className="w-48">Title</TableHead>
                <TableHead>Reply</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((reply) => (
                <TableRow key={reply.id}>
                  <TableCell className="font-mono text-sm">
                    /{reply.shortcut}
                  </TableCell>
                  <TableCell className="font-medium">{reply.title}</TableCell>
                  <TableCell className="max-w-0 truncate text-muted-foreground">
                    {reply.body}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit /${reply.shortcut}`}
                      onClick={() => openDialog(reply)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete /${reply.shortcut}`}
                      onClick={() => setDeleting(reply)}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <SavedReplyDialog
        isOpen={isDialogOpen}
        reply={editing}
        onClose={() => setIsDialogOpen(false)}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete /{deleting?.shortcut}?</DialogTitle>
            <DialogDescription>
              Agents will no longer find it when they type /. This can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() =>
                deleting &&
                remove.mutate(deleting.id, {
                  onSuccess: () => setDeleting(null),
                })
              }
            >
              {remove.isPending && <Loader2 className="animate-spin" />}
              Delete reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
