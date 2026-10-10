"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wifi, WifiOff } from "lucide-react";
import { useDemoSession } from "@/hooks/demo/useDemoSession";
import { useDemoStats } from "@/hooks/demo/useDemoStats";
import { useDeliveryLatency } from "@/hooks/demo/useDeliveryLatency";
import { useOfflineSimulation } from "@/hooks/demo/useOfflineSimulation";
import { DemoWidgetHost } from "@/components/demo/DemoWidgetHost";
import { InboxView } from "@/components/inbox/InboxView";
import { RealtimeBoot } from "@/components/realtime/RealtimeBoot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The one scripted moment: a sample question types itself, sends, and lands in the inbox. Once per browser
// session, and never under reduced motion (DESIGN_SYSTEM §11, Phase 11).
const SCRIPTED_QUESTION = "Do you have vegan brownies?";
const SCRIPT_DELAY_MS = 2500;
const SCRIPT_PLAYED_KEY = "rd_demo_script_played";

const hasPlayedScript = () => {
  try {
    return sessionStorage.getItem(SCRIPT_PLAYED_KEY) === "1";
  } catch {
    return false;
  }
};

// A number that tints for a moment when it changes (`animate-arrival`), never counts up.
function LiveNumber({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit?: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="truncate text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <p
        key={value}
        className={cn(
          "inline-block rounded-md font-display text-[28px] leading-[1.1] font-bold tracking-[-0.02em] text-foreground tabular-nums sm:text-[32px]",
          value !== null && "animate-arrival",
        )}
      >
        {value === null ? "—" : `${value.toLocaleString()}${unit ?? ""}`}
      </p>
    </div>
  );
}

// A small caption above each half of the demo, like a tab on the frame.
function PaneLabel({
  children,
  isLive,
}: {
  children: React.ReactNode;
  isLive?: boolean;
}) {
  return (
    <h2 className="flex items-center gap-2 px-1 text-[13px] font-medium text-muted-foreground">
      {isLive && (
        <span aria-hidden className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-presence-online opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-presence-online" />
        </span>
      )}
      {children}
    </h2>
  );
}

// The live demo: the bakery site with the real widget on the left, the real inbox on the right, and the live
// numbers underneath. It sits inside the hero's frame on the homepage.
export function HomeDemo() {
  const { state, retry } = useDemoSession();
  const router = useRouter();

  // Someone with a real account has no use for the landing page: straight to their inbox. (A demo visitor is also
  // "signed in", but to the demo workspace; `useDemoSession` tells the two apart and only reports `signedIn` for a
  // real member.) The page stays visible until `/auth/me` answers, so a visitor who isn't signed in never waits.
  useEffect(() => {
    if (state.status === "signedIn") router.replace("/inbox");
  }, [state.status, router]);
  const stats = useDemoStats();
  const { latencyMs, recordSent } = useDeliveryLatency();

  const [script, setScript] = useState<{ id: number; text: string } | null>(
    null,
  );
  const [isWidgetOnline, setIsWidgetOnline] = useState(true);
  const {
    isOffline,
    secondsLeft,
    start: goOffline,
  } = useOfflineSimulation(setIsWidgetOnline);

  // Once the demo is up, play the scripted question — or, if it already played or the visitor prefers
  // reduced motion, send an empty script, which only shows the "Your turn" hint.
  const hasScheduledScript = useRef(false);
  useEffect(() => {
    if (state.status !== "ready" || hasScheduledScript.current) return;
    hasScheduledScript.current = true;
    const skip =
      hasPlayedScript() ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(
      () => {
        setScript({ id: Date.now(), text: skip ? "" : SCRIPTED_QUESTION });
        try {
          sessionStorage.setItem(SCRIPT_PLAYED_KEY, "1");
        } catch {
          // Without storage it may play again on a reload; harmless.
        }
      },
      skip ? 0 : SCRIPT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [state.status]);

  const handleSent = useCallback(
    (clientMessageId: string, at: number) => recordSent(clientMessageId, at),
    [recordSent],
  );

  if (state.status === "failed") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <p className="text-[15px] text-foreground">
          The demo didn&apos;t start. {state.message}
        </p>
        <Button variant="outline" size="lg" onClick={() => void retry()}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.status === "starting" || state.status === "signedIn") {
    return (
      <div
        aria-busy="true"
        aria-label="Starting your private demo"
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[5fr_7fr]">
          <Skeleton className="h-[580px] rounded-2xl" />
          <Skeleton className="h-[580px] rounded-2xl" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {state.status === "signedIn"
            ? "Taking you to your inbox…"
            : "Starting your private demo… the first visit after a quiet spell can take up to a minute while the server wakes up."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RealtimeBoot />
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[5fr_7fr]">
        <section aria-label="Visitor view" className="flex flex-col gap-2">
          <PaneLabel>What your visitor sees</PaneLabel>
          <DemoWidgetHost
            publicKey={state.workspace.publicKey}
            script={script}
            isOnline={isWidgetOnline}
            onSent={handleSent}
          />
        </section>

        <section aria-label="Agent inbox" className="flex flex-col gap-2">
          <PaneLabel isLive>
            What your team sees, signed in as {state.member.name}
          </PaneLabel>
          <InboxView isEmbedded />
        </section>
      </div>

      <section
        aria-label="Live numbers"
        className="flex flex-col gap-5 rounded-2xl bg-background p-5 md:flex-row md:items-center md:justify-between"
      >
        <div className="grid flex-1 grid-cols-3 gap-4 sm:gap-8">
          <LiveNumber
            label="Messages delivered"
            value={stats?.messagesDelivered ?? null}
          />
          <LiveNumber label="Last delivery" value={latencyMs} unit=" ms" />
          <LiveNumber label="People online" value={stats?.onlineNow ?? null} />
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={goOffline}
          disabled={isOffline}
          className="shrink-0"
        >
          {isOffline ? <WifiOff /> : <Wifi />}
          {isOffline
            ? `Offline. Back in ${secondsLeft}s`
            : "Go offline for 5 seconds"}
        </Button>
      </section>
    </div>
  );
}
