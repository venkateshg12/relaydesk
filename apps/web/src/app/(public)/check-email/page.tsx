"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { useResendVerification } from "@/hooks/auth/useResendVerification";
import { Button } from "@/components/ui/button";

// The server does not mail a new link more often than this per account, so the button waits the same time.
const RESEND_COOLDOWN_SECONDS = 60;

function CheckEmail() {
  const email = useSearchParams().get("email") ?? "";
  const { mutate: resend, isPending, isSuccess, error, reset } = useResendVerification();
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  // Sign-up has just mailed the first link, so the first resend is available after the cooldown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleResend = () => {
    reset();
    resend(email, { onSuccess: () => setSecondsLeft(RESEND_COOLDOWN_SECONDS) });
  };

  return (
    <div>
      <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-signal-soft text-signal">
        <MailCheck className="size-6" aria-hidden />
      </div>

      <h1 className="font-display text-[32px] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance text-foreground font-expanded">
        Check your email
      </h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-muted-foreground">
        {email ? (
          <>
            We sent a verification link to{" "}
            <span className="font-medium break-all text-foreground">{email}</span>.
          </>
        ) : (
          "We sent you a verification link."
        )}{" "}
        Open it to finish creating your workspace. It works once and expires in 24 hours.
      </p>
      <p className="mt-3 text-[14px] leading-[1.55] text-muted-foreground">
        Nothing there? Look in your spam folder: a message from a new sender can land there.
      </p>

      <div className="mt-8 space-y-3" aria-live="polite">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full text-[15px] font-medium"
          disabled={!email || isPending || secondsLeft > 0}
          onClick={handleResend}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>Sending...</span>
            </span>
          ) : secondsLeft > 0 ? (
            `Resend the email in ${secondsLeft}s`
          ) : (
            "Resend the email"
          )}
        </Button>

        {isSuccess && (
          <p role="status" className="text-xs text-muted-foreground">
            If that account is waiting for verification, a new link is on its way.
          </p>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
            {error.message || "We couldn't send the email. Please try again in a few minutes."}
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-[14px] text-muted-foreground">
        Wrong address?{" "}
        <Link href="/signup" className="font-medium text-foreground hover:underline">
          Start again
        </Link>
        {" · "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Log in
        </Link>
      </div>
    </div>
  );
}

// `useSearchParams` needs a Suspense boundary so the page can still be prerendered.
export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmail />
    </Suspense>
  );
}
