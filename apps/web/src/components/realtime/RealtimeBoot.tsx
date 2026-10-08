"use client";

import { useInboxAlerts } from "@/hooks/realtime/useInboxAlerts";
import { useRealtimeSession } from "@/hooks/realtime/useRealtimeSession";

// Mounted once in the signed-in layout: the agent's connection, presence and alerts live for the whole
// session, whichever page they are on. Renders nothing.
export function RealtimeBoot() {
  useRealtimeSession();
  useInboxAlerts();
  return null;
}
