"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useConnectionState } from "@/hooks/realtime/useConnectionState";

interface ConnectionBarProps {
  // Changes each time a reconnect finished catching up (DESIGN_SYSTEM §10.3 "Back online").
  lastSync?: { count: number } | null;
}

// A blip shorter than this never shows a bar, and neither does the first connection on page load.
const SHOW_AFTER_MS = 800;
const BACK_ONLINE_HOLD_MS = 2000;
const FADE_OUT_MS = 200;

/*
  The one connection bar, shared by the inbox and (later) the widget and the demo. "Reconnecting…" is
  a thin warm bar with a pulsing dot while the socket is down; once the reconnect has synced it turns
  green — "Back online · 3 messages synced" — holds for two seconds and fades out. `role="status"`
  announces both politely.
 */
export function ConnectionBar({ lastSync = null }: ConnectionBarProps) {
  const connection = useConnectionState();
  const [isDown, setIsDown] = useState(false);
  const [backOnline, setBackOnline] = useState<{
    count: number;
    isLeaving: boolean;
  } | null>(null);
  const wasDown = useRef(false);

  useEffect(() => {
    if (connection === "connected") return setIsDown(false);
    const timer = setTimeout(() => {
      wasDown.current = true;
      setIsDown(true);
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [connection]);

  useEffect(() => {
    if (!lastSync || !wasDown.current) return;
    wasDown.current = false;

    setBackOnline({ count: lastSync.count, isLeaving: false });
    const leave = setTimeout(
      () => setBackOnline((bar) => bar && { ...bar, isLeaving: true }),
      BACK_ONLINE_HOLD_MS,
    );
    const remove = setTimeout(
      () => setBackOnline(null),
      BACK_ONLINE_HOLD_MS + FADE_OUT_MS,
    );
    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [lastSync]);

  if (isDown) {
    return (
      <div
        role="status"
        className="flex w-full items-center justify-center gap-2 border-b border-border bg-status-unassigned-soft px-3 py-1.5 text-xs font-medium text-status-unassigned animate-in fade-in duration-200"
      >
        <span
          className="size-1.5 rounded-full bg-status-unassigned animate-pulse motion-reduce:animate-none"
          aria-hidden
        />
        Reconnecting… your messages will send when you&apos;re back
      </div>
    );
  }

  if (backOnline) {
    return (
      <div
        role="status"
        className={cn(
          "flex w-full items-center justify-center gap-2 border-b border-border bg-status-resolved-soft px-3 py-1.5 text-xs font-medium text-status-resolved transition-opacity duration-200 motion-reduce:transition-none",
          backOnline.isLeaving && "opacity-0",
        )}
      >
        <span
          className="size-1.5 rounded-full bg-status-resolved"
          aria-hidden
        />
        Back online
        {backOnline.count > 0 &&
          ` · ${backOnline.count} ${backOnline.count === 1 ? "message" : "messages"} synced`}
      </div>
    );
  }

  return null;
}
