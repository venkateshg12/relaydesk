import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SendMessageAck } from "@repo/types";
import { toast } from "sonner";
import { retryMessage, sendRealtimeMessage } from "@/lib/socket";
import { mergeMessages } from "@/lib/conversationCache";

/*
  An agent's reply. It goes into the outbox first, so the bubble shows at once as "sending"; the
  server's ack replaces it with the stored message (which carries the real `seq`). Offline, it waits
  in the outbox and is replayed after the reconnect has synced.
 */
export const useSendReply = (conversationId: string | null) => {
  const queryClient = useQueryClient();

  const settle = useCallback(
    (ack: SendMessageAck | null) => {
      if (!ack) return;
      if (ack.ok) return mergeMessages(queryClient, ack.message.conversationId, [ack.message]);
      if (ack.error === "RATE_LIMITED") toast.error(`You're sending too fast. Try again in ${ack.retryAfter ?? 60}s.`);
    },
    [queryClient]
  );

  const send = useCallback(
    async (body: string) => {
      if (!conversationId) return;
      settle(await sendRealtimeMessage({ conversationId, clientMessageId: crypto.randomUUID(), body }));
    },
    [conversationId, settle]
  );

  const retry = useCallback(async (clientMessageId: string) => settle(await retryMessage(clientMessageId)), [settle]);

  return { send, retry };
};
