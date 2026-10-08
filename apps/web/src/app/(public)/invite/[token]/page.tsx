"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { acceptInvitationSchema, type AcceptInvitationSchema } from "@repo/types";
import { useAcceptInvitation, useInvitationDetails } from "@/hooks/team/useInvitation";
import { Button } from "@/components/ui/button";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: invitation, isLoading, error } = useInvitationDetails(token);
  const accept = useAcceptInvitation(token);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInvitationSchema>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { name: "", password: "" },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // An expired or used link gets one sentence and no form (DESIGN_SYSTEM §11, phase 05).
  if (error || !invitation) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-[32px] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance text-foreground font-expanded">This invite can&apos;t be used</h1>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? "This invitation has expired or was already used."} Ask your admin for a new one.
        </p>
        <Link href="/login" className="inline-block text-sm font-medium text-foreground hover:underline">
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-[32px] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance text-foreground font-expanded">Join {invitation.workspaceName}</h1>
        <p className="mt-3 text-[15px] leading-[1.55] text-muted-foreground">
          Set up your account for <span className="font-medium text-foreground">{invitation.email}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit((data) => accept.mutate(data))} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-[13px] font-medium text-foreground">
            Your name
          </Label>
          <Input id="name" autoComplete="name" placeholder="Tom Crust" className="h-11 text-[15px]" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[13px] font-medium text-foreground">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="h-11 pr-10 text-[15px]"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {accept.error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive leading-relaxed">
            {accept.error.message}
          </div>
        )}

        <Button type="submit" disabled={accept.isPending} className="h-11 w-full text-[15px] font-medium">
          {accept.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Join {invitation.workspaceName}
        </Button>
      </form>

      <GoogleSignInButton mode="invite" invitationToken={token} />
    </div>
  );
}
