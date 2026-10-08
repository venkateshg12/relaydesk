"use client";

import { useEffect } from "react";
import { connectSocket, setPresenceStatus } from "@/lib/socket";
import { preferences } from "@/lib/preferences";

// The agent's connection belongs to the signed-in app, not to one page: they count as online (or away,
// if they chose so) wherever they are, and the choice is applied again after every reconnect.
export function useRealtimeSession() {
  useEffect(() => {
    const socket = connectSocket();
    const applyPresence = () => {
      if (preferences.isAway()) setPresenceStatus("away");
    };

    socket.on("connect", applyPresence);
    if (socket.connected) applyPresence();
    return () => void socket.off("connect", applyPresence);
  }, []);
}
