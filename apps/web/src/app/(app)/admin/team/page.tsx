"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, UserPlus } from "lucide-react";
import {
  inviteMemberSchema,
  type InviteMemberSchema,
  type TeamMember,
} from "@repo/types";
import { useTeam } from "@/hooks/team/useTeam";
import { useInviteMember } from "@/hooks/team/useInviteMember";
import { useRevokeInvitation } from "@/hooks/team/useRevokeInvitation";
import { useRemoveMember } from "@/hooks/team/useRemoveMember";
import { useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function TeamPage() {
  const { data: team, isLoading, error, refetch } = useTeam();
  const currentMemberId = useAppSelector((state) => state.auth.member?.id);
  const revokeInvitation = useRevokeInvitation();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <p className="text-sm text-foreground">
          The team couldn&apos;t be loaded. {error?.message}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const handleRevoke = (id: string, email: string) =>
    revokeInvitation.mutate(id, {
      onSuccess: () => toast(`Invite to ${email} revoked`),
      onError: (err) => toast.error(err.message),
    });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.025em] text-foreground font-expanded sm:text-[34px]">
            Team
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The agents who answer chats for your business.
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)}>
          <UserPlus />
          Invite agent
        </Button>
      </div>

      <section className="rounded-2xl border border-border bg-card">
        <h2 className="px-4 py-3 text-base font-semibold text-foreground border-b border-border">
          Members ({team.members.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.members.map((member) => {
              const isSelf = member.id === currentMemberId;
              return (
                <TableRow key={member.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-muted">
                          {initialsOf(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">
                        {member.name}
                        {isSelf && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            (you)
                          </span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {member.role === "admin" ? "Admin" : "Agent"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(member.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {!isSelf && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${member.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setMemberToRemove(member)}
                          >
                            Remove from team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <h2 className="px-4 py-3 text-base font-semibold text-foreground border-b border-border">
          Pending invites ({team.pendingInvitations.length})
        </h2>
        {team.pendingInvitations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No pending invites. Invited agents show up here until they accept.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Email</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.pendingInvitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="pl-4 font-medium text-foreground">
                    {invitation.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(invitation.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(invitation.expiresAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={
                        revokeInvitation.isPending &&
                        revokeInvitation.variables === invitation.id
                      }
                      onClick={() =>
                        handleRevoke(invitation.id, invitation.email)
                      }
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <InviteDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
      <RemoveMemberDialog
        member={memberToRemove}
        onClose={() => setMemberToRemove(null)}
      />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invite = useInviteMember();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberSchema>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "" },
  });

  const close = (next: boolean) => {
    if (!next) {
      reset();
      invite.reset();
    }
    onOpenChange(next);
  };

  const onSubmit = (data: InviteMemberSchema) =>
    invite.mutate(data, {
      onSuccess: (invitation) => {
        toast(`Invite sent to ${invitation.email}`);
        close(false);
      },
    });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite an agent</DialogTitle>
          <DialogDescription>
            They&apos;ll get an email with a link to join. The link works once,
            for two days.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="tom@sweetcrumbs.test"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          {invite.error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              {invite.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending && <Loader2 className="animate-spin" />}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveMemberDialog({
  member,
  onClose,
}: {
  member: TeamMember | null;
  onClose: () => void;
}) {
  const remove = useRemoveMember();

  const close = () => {
    remove.reset();
    onClose();
  };

  const confirm = () => {
    if (!member) return;
    remove.mutate(member.id, {
      onSuccess: () => {
        toast(`${member.name} removed from the team`);
        close();
      },
    });
  };

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {member?.name}?</DialogTitle>
          <DialogDescription>
            They&apos;ll be logged out at once, and the conversations assigned
            to them go back to Unassigned.
          </DialogDescription>
        </DialogHeader>
        {remove.error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {remove.error.message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={remove.isPending}
            onClick={confirm}
          >
            {remove.isPending && <Loader2 className="animate-spin" />}
            Remove {member?.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
