"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

/*
  How long a message takes from the visitor's text box to the agent's inbox, measured honestly: the widget
  (in its iframe) reports the instant it sends (`rd:sent`, a clock reading), and when the same message
  arrives on the inbox's socket this page subtracts. Both halves are in one browser, so one clock — no
  server timestamps, no guessing. A message that was queued offline measures its whole wait, which is the
  truth too.
 */
export function useDeliveryLatency() {
  const sentAt = useRef(new Map<string, number>());
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const recordSent = useCallback((clientMessageId: string, at: number) => {
    sentAt.current.set(clientMessageId, at);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const onMessage = (message: {
      clientMessageId: string;
      senderType: string;
    }) => {
      const at = sentAt.current.get(message.clientMessageId);
      if (message.senderType !== "visitor" || at === undefined) return;
      sentAt.current.delete(message.clientMessageId);
      setLatencyMs(Math.max(0, Date.now() - at));
    };
    socket.on("message:new", onMessage);
    return () => void socket.off("message:new", onMessage);
  }, []);

  return { latencyMs, recordSent };
}
