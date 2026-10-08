import React from "react";
import Link from "next/link";
import { Pin } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

// The right half of the auth pages: one conversation as the product draws it — a visitor's question, the
// team's reply, the yellow note only the team sees, and someone typing. Decorative, so hidden from screen
// readers.
function AuthStagePanel() {
  return (
    <div
      aria-hidden
      className="relative isolate hidden overflow-hidden rounded-[40px] bg-stage p-12 lg:flex lg:flex-col lg:justify-between xl:p-16"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,color-mix(in_oklch,var(--color-signal)_55%,transparent),transparent_70%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(var(--color-stage-line)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent)] bg-size-[28px_28px]" />

      <p className="max-w-[13ch] font-display text-[52px] leading-[0.92] font-extrabold tracking-[-0.03em] text-stage-foreground font-expanded xl:text-[64px]">
        Every chat, one owner.
      </p>

      <div className="mx-auto w-full max-w-[420px] space-y-3">
        <p className="w-fit max-w-[85%] rounded-3xl rounded-bl-md bg-card px-4 py-2.5 text-[15px] text-foreground">
          Do you deliver to Gajuwaka?
        </p>
        <p className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-md bg-signal px-4 py-2.5 text-[15px] text-white dark:text-stage">
          Yes! We deliver there from 9 to 1 on Sundays.
        </p>
        <div className="rounded-2xl border border-note-border bg-note p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-note-foreground">
            <Pin className="size-3.5" />
            Note from Priya
          </p>
          <p className="mt-1 text-[14px] text-foreground">
            Checked with the driver, Gajuwaka is on the Sunday route.
          </p>
        </div>
        <p className="flex items-center gap-2 pt-1 text-[13px] text-stage-muted">
          <span className="flex gap-0.5">
            <span className="size-1.5 animate-typing-dot rounded-full bg-stage-muted" />
            <span className="size-1.5 animate-typing-dot rounded-full bg-stage-muted [animation-delay:150ms]" />
            <span className="size-1.5 animate-typing-dot rounded-full bg-stage-muted [animation-delay:300ms]" />
          </span>
          Visitor is typing…
        </p>
      </div>

      <p className="max-w-[40ch] text-[15px] leading-[1.6] text-stage-muted">
        One bubble on your website, one shared inbox for your team, and notes
        your visitors never see.
      </p>
    </div>
  );
}

// Reference: Glow (docs/design-references/glow.md) — the product cradled in a 40px-radius panel beside plain
// white, the wordmark top left and nothing else in the chrome. Changed: the cradle is the indigo stage from the
// homepage instead of porcelain grey, so signing in feels like the same site. Below 1024px only the form shows.
export default function PublicAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-card p-3 lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link
          href="/"
          aria-label="RelayDesk home"
          className="w-fit rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>
      <AuthStagePanel />
    </div>
  );
}
