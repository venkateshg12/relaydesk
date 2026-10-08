"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

const OFFLINE_SECONDS = 5;

/*
  "Go offline for 5 seconds": really closes the inbox's socket and asks the widget (through the page, which
  hosts it) to close its own, counts down, then brings both back. Whatever was typed meanwhile waits in each
  side's outbox, and the reconnect syncs and replays it — the viewer watches nothing get lost or doubled.
 */
export function useOfflineSimulation(
  setWidgetOnline: (isOnline: boolean) => void,
) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);

  const start = useCallback(() => {
    getSocket().disconnect();
    setWidgetOnline(false);
    setSecondsLeft(OFFLINE_SECONDS);

    let left = OFFLINE_SECONDS;
    timer.current = setInterval(() => {
      left -= 1;
      setSecondsLeft(left);
      if (left > 0) return;
      clearInterval(timer.current);
      getSocket().connect();
      setWidgetOnline(true);
    }, 1000);
  }, [setWidgetOnline]);

  return { isOffline: secondsLeft > 0, secondsLeft, start };
}
