import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { useHost } from "@/hooks/useHost";
import { store } from "@/lib/storage";
import { applyBrandTheme } from "@/utils/contrast";
import { Launcher } from "@/components/Launcher";
import { Header } from "@/components/Header";
import { ConnectionBar } from "@/components/ConnectionBar";
import { MessageThread } from "@/components/MessageThread";
import { ProfilePrompt } from "@/components/ProfilePrompt";
import { Composer } from "@/components/Composer";
import { ChatWindow, CLOSE_ANIMATION_MS } from "@/components/ChatWindow";
import { Preview } from "@/Preview";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  // The admin's live preview loads this same frame with `preview=1` (see Preview.tsx).
  if (params.get("preview") === "1") return <Preview />;

  // The loader puts the workspace's public key in the frame URL. Without one there is nothing to show.
  const publicKey = params.get("key");
  return publicKey ? <Chat publicKey={publicKey} /> : null;
}

function Chat({ publicKey }: { publicKey: string }) {
  const params = new URLSearchParams(window.location.search);
  // The homepage demo embeds this frame itself: `open=1` shows the window at once, `demo=1` lets that page
  // script a question and take the connection down for its "Go offline" button, and hears when we send.
  const opensByDefault = params.get("open") === "1";
  const isDemo = params.get("demo") === "1";

  const [script, setScript] = useState<{ id: number; text: string } | null>(
    null,
  );
  const [hasTypedScript, setHasTypedScript] = useState(false);
  const setNetworkRef = useRef<(isOnline: boolean) => void>(undefined);
  const onDemoMessage = useCallback(
    (message: { type: string; [key: string]: unknown }) => {
      if (!isDemo) return;
      if (message.type === "rd:script" && typeof message.text === "string")
        setScript({ id: Date.now(), text: message.text });
      if (message.type === "rd:network")
        setNetworkRef.current?.(Boolean(message.online));
    },
    [isDemo],
  );

  const { post, pageUrl, isMobile, resize } = useHost(onDemoMessage);

  // `isOpen` is what the visitor asked for; `isMounted` keeps the window in the page until its closing
  // animation has played, and while the iframe is still being resized.
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const chat = useChat({
    publicKey,
    pageUrl,
    isOpen,
    onSent: (clientMessageId) =>
      isDemo && post({ type: "rd:sent", clientMessageId, at: Date.now() }),
  });
  setNetworkRef.current = chat.setNetwork;

  const launcherRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => applyBrandTheme(chat.widget?.widgetColor),
    [chat.widget?.widgetColor],
  );

  const open = useCallback(() => {
    clearTimeout(closeTimer.current);
    // Grow the iframe first, then play the window's entrance inside it.
    resize(isMobile ? "fullscreen" : "open");
    setIsMounted(true);
    requestAnimationFrame(() => {
      setIsOpen(true);
      composerRef.current?.focus();
    });
    store.setOpen(publicKey, true);
  }, [isMobile, publicKey, resize]);

  const close = useCallback(() => {
    setIsOpen(false);
    store.setOpen(publicKey, false);
    launcherRef.current?.focus();
    closeTimer.current = setTimeout(() => {
      setIsMounted(false);
      resize("bubble");
    }, CLOSE_ANIMATION_MS);
  }, [publicKey, resize]);

  // Page changes reload the frame: bring the window back if it was open, once the host has told us
  // whether this is a phone.
  const hasRestored = useRef(false);
  useEffect(() => {
    if (hasRestored.current || chat.phase !== "ready" || !pageUrl) return;
    hasRestored.current = true;
    if (opensByDefault || store.wasOpen(publicKey)) open();
  }, [chat.phase, pageUrl, publicKey, open, opensByDefault]);

  // Rotating a phone (or resizing the host window) while open changes the iframe's size class.
  useEffect(() => {
    if (isMounted && isOpen) resize(isMobile ? "fullscreen" : "open");
  }, [isMobile, isMounted, isOpen, resize]);

  if (chat.phase !== "ready" || !chat.widget) return null; // A broken widget stays silent on the host page.

  const { widget, visitor } = chat;
  const hasWritten =
    chat.messages.some((m) => m.senderType === "visitor") ||
    chat.outbox.length > 0;
  // The homepage demo takes its own team offline on purpose; it never asks for an email.
  const needsEmail = !isDemo && chat.isTeamOnline === false && !visitor?.email;
  const showPrompt =
    hasWritten &&
    !chat.hasDismissedPrompt &&
    chat.isTeamOnline !== false &&
    (!visitor?.name || !visitor?.email);

  return (
    <div
      className="fixed inset-0 flex flex-col items-end justify-end gap-3 p-5"
      onKeyDown={(e) => e.key === "Escape" && isOpen && close()}
    >
      {isMounted && (
        <ChatWindow
          label={`Chat with ${widget.workspaceName}`}
          isOpen={isOpen}
          isMobile={isMobile}
        >
          <Header
            businessName={widget.workspaceName}
            isTeamOnline={chat.isTeamOnline}
            onClose={close}
          />
          <ConnectionBar
            connection={chat.connection}
            lastSync={chat.lastSync}
          />

          <MessageThread
            messages={chat.messages}
            outbox={chat.outbox}
            agentReadSeq={chat.agentReadSeq}
            typingWho={chat.typingWho}
            greeting={widget.greeting}
            awayMessage={widget.awayMessage}
            workspaceName={widget.workspaceName}
            isTeamOnline={chat.isTeamOnline}
            onRetry={(id) => void chat.retry(id)}
          >
            {showPrompt && (
              <ProfilePrompt
                hasName={Boolean(visitor?.name)}
                hasEmail={Boolean(visitor?.email)}
                onSave={async (profile) => {
                  await chat.saveProfile(profile);
                  chat.dismissPrompt();
                }}
                onSkip={chat.dismissPrompt}
              />
            )}
          </MessageThread>

          <Composer
            ref={composerRef}
            cooldown={chat.cooldown}
            needsEmail={needsEmail}
            autoType={script}
            onAutoTyped={() => setHasTypedScript(true)}
            placeholder={
              isDemo && hasTypedScript ? "Your turn. Ask anything." : undefined
            }
            onTyping={chat.setTyping}
            onSend={async (body, email) => {
              if (email) await chat.saveProfile({ email });
              await chat.send(body);
            }}
          />
        </ChatWindow>
      )}

      {!(isMobile && isMounted) && (
        <Launcher
          ref={launcherRef}
          isOpen={isOpen}
          unread={chat.unread}
          onClick={isOpen ? close : open}
        />
      )}
    </div>
  );
}
