"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { Loader2, MailX } from "lucide-react";
import { useVerifyEmail } from "@/hooks/auth/useVerifyEmail";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { mutate: verify, error } = useVerifyEmail();

  // The link works once, so it must be sent exactly once: React runs effects twice in development, and a second
  // request would find the token already used and show an error for a link that had just worked.
  const hasStarted = useRef(false);
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    verify(token);
  }, [token, verify]);

  if (error) {
    return (
      <div>
        <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <MailX className="size-6" aria-hidden />
        </div>
        <h1 className="font-display text-[32px] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance text-foreground font-expanded">
          This link didn&apos;t work
        </h1>
        <p role="alert" className="mt-3 text-[15px] leading-[1.55] text-muted-foreground">
          {error.message || "The verification link has expired or was already used."} Log in with your email and
          password and we&apos;ll send you a new one.
        </p>
        <Button asChild className="mt-8 h-11 w-full text-[15px] font-medium">
          <Link href="/login">Log in</Link>
        </Button>
        <div className="mt-6 text-center text-[14px] text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-foreground hover:underline">
            Create a workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite">
      <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-signal-soft text-signal">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
      <h1 className="font-display text-[32px] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance text-foreground font-expanded">
        Verifying your email
      </h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-muted-foreground">
        One moment. You&apos;ll land in your inbox as soon as this is done.
      </p>
    </div>
  );
}
