import { useEffect, useRef, useState } from "react";
import type { ConnectionState } from "@/lib/socket";

interface ConnectionBarProps {
  connection: ConnectionState;
  // Changes each time a reconnect finished catching up.
  lastSync: { count: number } | null;
}

const SHOW_AFTER_MS = 800;
const BACK_ONLINE_HOLD_MS = 2000;
const FADE_OUT_MS = 200;

// The same bar as the inbox (DESIGN_SYSTEM §10.3), drawn with the widget's tokens: "Reconnecting…" with a
// pulsing dot, then green "Back online · N messages synced" that fades after two seconds.
export function ConnectionBar({ connection, lastSync }: ConnectionBarProps) {
  const [isDown, setIsDown] = useState(false);
  const [backOnline, setBackOnline] = useState<{ count: number; isLeaving: boolean } | null>(null);
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
    const leave = setTimeout(() => setBackOnline((bar) => bar && { ...bar, isLeaving: true }), BACK_ONLINE_HOLD_MS);
    const remove = setTimeout(() => setBackOnline(null), BACK_ONLINE_HOLD_MS + FADE_OUT_MS);
    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [lastSync]);

  if (isDown) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 bg-warn-soft px-3 py-1.5 text-xs font-medium text-warn">
        <span className="size-1.5 animate-pulse rounded-full bg-warn motion-reduce:animate-none" aria-hidden />
        Reconnecting… your messages will send when you&apos;re back
      </div>
    );
  }

  if (backOnline) {
    return (
      <div
        role="status"
        className={`flex items-center justify-center gap-2 bg-ok-soft px-3 py-1.5 text-xs font-medium text-ok transition-opacity duration-200 ${backOnline.isLeaving ? "opacity-0" : ""}`}
      >
        <span className="size-1.5 rounded-full bg-ok" aria-hidden />
        Back online
        {backOnline.count > 0 && ` · ${backOnline.count} ${backOnline.count === 1 ? "message" : "messages"} synced`}
      </div>
    );
  }

  return null;
}
