import { useSyncExternalStore } from "react";
import { outboxStore, type OutboxItem } from "@/lib/socket";

const NONE: OutboxItem[] = [];

// The replies of one conversation that the server hasn't confirmed yet.
export const useOutbox = (conversationId: string | null): OutboxItem[] => {
  const all = useSyncExternalStore(
    outboxStore.subscribe,
    outboxStore.getSnapshot,
    () => NONE,
  );
  return all.filter((item) => item.conversationId === conversationId);
};
