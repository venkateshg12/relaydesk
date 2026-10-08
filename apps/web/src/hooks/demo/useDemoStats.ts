"use client";

import { useEffect, useState } from "react";
import { getDemoStatsApi, type DemoLiveStats } from "@/api/demo";
import { getSocket } from "@/lib/socket";

// The homepage's live numbers, both real: the server's delivered-messages counter and the number of people
// connected to the demo right now. Fetched once, then pushed over the socket every few seconds when they change.
// `null` until the first answer — the strip shows a dash, never an invented number.
export function useDemoStats() {
  const [stats, setStats] = useState<DemoLiveStats | null>(null);

  useEffect(() => {
    let isCurrent = true;
    getDemoStatsApi()
      .then((response) => isCurrent && setStats(response.data))
      .catch(() => undefined);

    const socket = getSocket();
    socket.on("stats:update", setStats);
    return () => {
      isCurrent = false;
      socket.off("stats:update", setStats);
    };
  }, []);

  return stats;
}
