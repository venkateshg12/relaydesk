"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket";
import { playNotificationSound } from "@/lib/sound";
import { preferences } from "@/lib/preferences";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectConversation } from "@/store/slices/inboxUiSlice";
import { useConversationCounts } from "@/hooks/inbox/useConversationCounts";
import { useMembers } from "@/hooks/team/useMembers";

const APP_TITLE = "RelayDesk";
const MIN_SOUND_GAP_MS = 1500;

/*
  What reaches an agent who is not looking at the right conversation (DESIGN_SYSTEM §10.3):
  - the tab title carries the unread count — "(3) RelayDesk" — across Mine and Unassigned;
  - a short chime for a visitor's message when the tab is hidden or that conversation isn't open
    (unless they muted it on the account page);
  - a toast when a colleague hands a conversation over to them, with a way straight to it.
 */
export function useInboxAlerts() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const openConversationId = useAppSelector(
    (state) => state.inboxUi.selectedConversationId,
  );
  const { data: counts } = useConversationCounts();
  const { data: members = [] } = useMembers();

  const openIdRef = useRef(openConversationId);
  openIdRef.current = openConversationId;
  const membersRef = useRef(members);
  membersRef.current = members;
  const lastSoundAt = useRef(0);

  const unread = (counts?.unreadMine ?? 0) + (counts?.unreadUnassigned ?? 0);
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${APP_TITLE}` : APP_TITLE;
    return () => void (document.title = APP_TITLE);
  }, [unread]);

  useEffect(() => {
    const socket = getSocket();

    const onMessage = (message: {
      senderType: string;
      conversationId: string;
    }) => {
      const isWatching =
        !document.hidden && openIdRef.current === message.conversationId;
      if (
        message.senderType !== "visitor" ||
        isWatching ||
        !preferences.isSoundEnabled()
      )
        return;
      if (Date.now() - lastSoundAt.current < MIN_SOUND_GAP_MS) return;
      lastSoundAt.current = Date.now();
      playNotificationSound();
    };

    const onAssigned = ({
      conversationId,
      assignedBy,
    }: {
      conversationId: string;
      assignedBy: string;
    }) => {
      const colleague =
        membersRef.current.find((member) => member.id === assignedBy)?.name ??
        "A colleague";
      toast(`${colleague} assigned a conversation to you`, {
        action: {
          label: "Open",
          onClick: () => {
            dispatch(selectConversation(conversationId));
            router.push("/inbox");
          },
        },
      });
    };

    socket.on("message:new", onMessage);
    socket.on("conversation:assigned", onAssigned);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("conversation:assigned", onAssigned);
    };
  }, [dispatch, router]);
}
