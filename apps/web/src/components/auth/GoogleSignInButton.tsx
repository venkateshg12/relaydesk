"use client";

import { useEffect, useRef, useState } from "react";
import { useGoogleLogin } from "@/hooks/auth/useGoogleLogin";
import { GOOGLE_CLIENT_ID } from "@/lib/env";
import type { GoogleCredentialResponse } from "@/lib/google/google";
import { loadGoogleSdk } from "@/lib/google/loadGsi";

interface GoogleSignInButtonProps {
  // What a Google account means on this screen: sign in to an existing workspace, create one, or join one.
  mode: "login" | "signup" | "invite";
  // signup: the business to create. The button refuses to start until it is filled in.
  businessName?: string;
  // invite: the invitation being accepted.
  invitationToken?: string;
}

const BUTTON_TEXT = {
  login: "signin_with",
  signup: "signup_with",
  invite: "continue_with",
} as const;

/*
  Google's own button, rendered by Google Identity Services into `div`: the browser gets a signed ID token and
  forwards it to `POST /auth/google`, where the server asks Google whether it is real (the flow, step by step,
  is in the e-commerce `GoogleSignInButton`). Not shown at all when no client id is configured.
 */
export function GoogleSignInButton({
  mode,
  businessName,
  invitationToken,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mutate: signIn, error, isPending, reset } = useGoogleLogin();
  const [missingBusinessName, setMissingBusinessName] = useState(false);

  // Google calls back with the credential long after the button was drawn, so the callback reads the
  // latest props through a ref instead of being redrawn on every keystroke.
  const latest = useRef({ mode, businessName, invitationToken });
  latest.current = { mode, businessName, invitationToken };

  useEffect(() => {
    const clientId = GOOGLE_CLIENT_ID;
    if (!clientId) return;
    let isCurrent = true;

    const onCredential = ({ credential }: GoogleCredentialResponse) => {
      const { mode, businessName, invitationToken } = latest.current;
      if (mode === "signup" && (businessName?.trim().length ?? 0) < 2) {
        setMissingBusinessName(true); // shown below; nothing is sent
        return;
      }
      setMissingBusinessName(false);
      reset();
      signIn({
        idToken: credential,
        businessName: mode === "signup" ? businessName?.trim() : undefined,
        invitationToken: mode === "invite" ? invitationToken : undefined,
      });
    };

    loadGoogleSdk()
      .then(() => {
        if (!isCurrent || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: onCredential,
          auto_select: false,
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          text: BUTTON_TEXT[mode],
          shape: "rectangular",
          width: Math.min(containerRef.current.clientWidth || 320, 400),
        });
      })
      .catch(() => undefined); // The page still works with a password; Google being unreachable isn't an error to show.

    return () => {
      isCurrent = false;
    };
  }, [mode, reset, signIn]);

  // Typing the business name clears the hint.
  useEffect(() => {
    if ((businessName?.trim().length ?? 0) >= 2) setMissingBusinessName(false);
  }, [businessName]);

  if (!GOOGLE_CLIENT_ID) return null;

  // The "or" divider belongs to the button: without a client id both are left out, not a lone "or".
  return (
    <div className="space-y-2">
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <div
        ref={containerRef}
        aria-busy={isPending}
        className="flex min-h-[44px] w-full justify-center"
      />
      {missingBusinessName && (
        <p role="alert" className="text-xs text-destructive">
          Enter your business name above, then continue with Google.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive"
        >
          {error.message}
        </p>
      )}
    </div>
  );
}

export default GoogleSignInButton;
