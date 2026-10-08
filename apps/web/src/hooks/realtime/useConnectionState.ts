import { useSyncExternalStore } from "react";
import { connectionStore, type ConnectionState } from "@/lib/socket";

export const useConnectionState = (): ConnectionState =>
  useSyncExternalStore(
    connectionStore.subscribe,
    connectionStore.getSnapshot,
    () => "disconnected",
  );
