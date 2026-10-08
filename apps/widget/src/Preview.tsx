import { useEffect, useState } from "react";
import type { MessageItem, WidgetConfig } from "@repo/types";
import { readHostOrigin } from "@/hooks/useHost";
import { applyBrandTheme } from "@/utils/contrast";
import { ChatWindow } from "@/components/ChatWindow";
import { Header } from "@/components/Header";
import { MessageThread } from "@/components/MessageThread";
import { Composer } from "@/components/Composer";
import { Launcher } from "@/components/Launcher";

/*
  The admin's live preview: this same frame, loaded with `preview=1`, drawing the real components with the
  settings being edited and a short made-up conversation. No session, no socket, no storage. The settings
  page posts `rd:preview` on every change; only that page — the origin in the frame URL, and the parent
  window — is listened to.
 */
export interface PreviewMessage {
  type: "rd:preview";
  widget: WidgetConfig;
  isTeamOnline: boolean;
  view: "window" | "launcher";
}

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

const sample = (
  seq: number,
  senderType: "visitor" | "agent",
  body: string,
  minutes: number,
): MessageItem => ({
  id: `preview-${seq}`,
  workspaceId: "preview",
  conversationId: "preview",
  seq,
  clientMessageId: `preview-${seq}`,
  senderType,
  senderMemberId: senderType === "agent" ? "preview-agent" : null,
  senderName: senderType === "agent" ? "Priya" : null,
  body,
  createdAt: minutesAgo(minutes),
});

const MESSAGES = [
  sample(1, "visitor", "Do you deliver on Sundays?", 3),
  sample(2, "agent", "Yes! We deliver from 9 to 1 on Sundays.", 2),
];

const noop = () => undefined;

export function Preview() {
  const [state, setState] = useState<Omit<PreviewMessage, "type"> | null>(null);

  useEffect(() => {
    const hostOrigin = readHostOrigin();
    const onMessage = (event: MessageEvent<PreviewMessage>) => {
      if (
        event.origin !== hostOrigin ||
        event.source !== window.parent ||
        event.data?.type !== "rd:preview"
      )
        return;
      setState(event.data);
      applyBrandTheme(event.data.widget.widgetColor);
    };
    window.addEventListener("message", onMessage);
    if (hostOrigin) window.parent.postMessage({ type: "rd:ready" }, hostOrigin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!state) return null;
  const { widget, isTeamOnline, view } = state;

  return (
    <div className="pointer-events-none fixed inset-0 flex flex-col items-end justify-end gap-3 p-5">
      {view === "window" && (
        <ChatWindow label="Widget preview" isOpen isMobile={false}>
          <Header
            businessName={widget.workspaceName}
            isTeamOnline={isTeamOnline}
            onClose={noop}
          />
          <MessageThread
            messages={MESSAGES}
            outbox={[]}
            agentReadSeq={1}
            typingWho={null}
            greeting={widget.greeting}
            awayMessage={widget.awayMessage}
            workspaceName={widget.workspaceName}
            isTeamOnline={isTeamOnline}
            onRetry={noop}
          />
          {/* A picture of the composer, not a working one. */}
          <div inert>
            <Composer
              onSend={async () => undefined}
              onTyping={noop}
              cooldown={0}
              needsEmail={false}
            />
          </div>
        </ChatWindow>
      )}
      <Launcher isOpen={view === "window"} unread={0} onClick={noop} />
    </div>
  );
}
