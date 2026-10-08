"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WIDGET_ORIGIN } from "@/lib/env";
import { SweetCrumbsBackdrop } from "./SweetCrumbsBackdrop";

type FrameState = "bubble" | "open" | "fullscreen";

interface DemoWidgetHostProps {
  publicKey: string;
  // The one scripted question, played once per browser session (empty text means "skip it").
  script: { id: number; text: string } | null;
  // False while the demo's "Go offline" is in effect.
  isOnline: boolean;
  onSent: (clientMessageId: string, at: number) => void;
}

// The loader's job, done inside a card: `loader.js` sizes a *fixed* iframe against the browser window, which
// can't live in the middle of a page, so this component speaks the same `rd:*` protocol to the real widget
// frame — `rd:ready`/`rd:resize` in, `rd:context` out, origin-pinned both ways — and sizes an absolutely
// positioned iframe within the card. It is the real widget on the real origin, not a copy of it.
export function DemoWidgetHost({
  publicKey,
  script,
  isOnline,
  onSent,
}: DemoWidgetHostProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameState, setFrameState] = useState<FrameState>("open");
  const [isReady, setIsReady] = useState(false);
  const onSentRef = useRef(onSent);
  onSentRef.current = onSent;

  const post = useCallback(
    (message: object) =>
      frameRef.current?.contentWindow?.postMessage(message, WIDGET_ORIGIN),
    [],
  );
  const sendContext = useCallback(
    () =>
      post({
        type: "rd:context",
        url: window.location.href,
        viewport: cardRef.current?.clientWidth ?? window.innerWidth,
      }),
    [post],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== WIDGET_ORIGIN ||
        event.source !== frameRef.current?.contentWindow
      )
        return;
      const { type, state, clientMessageId, at } = event.data ?? {};
      if (type === "rd:ready") {
        setIsReady(true);
        sendContext();
      } else if (
        type === "rd:resize" &&
        ["bubble", "open", "fullscreen"].includes(state)
      ) {
        setFrameState(state);
      } else if (
        type === "rd:sent" &&
        typeof clientMessageId === "string" &&
        typeof at === "number"
      ) {
        onSentRef.current(clientMessageId, at);
      }
    };
    window.addEventListener("message", onMessage);

    // The card's width is what decides "phone": narrower than 640px the widget takes the whole card.
    const observer = new ResizeObserver(sendContext);
    if (cardRef.current) observer.observe(cardRef.current);
    return () => {
      window.removeEventListener("message", onMessage);
      observer.disconnect();
    };
  }, [sendContext]);

  useEffect(() => {
    if (isReady && script) post({ type: "rd:script", text: script.text });
  }, [isReady, script, post]);

  useEffect(() => {
    if (isReady) post({ type: "rd:network", online: isOnline });
  }, [isReady, isOnline, post]);

  const frameClass =
    frameState === "bubble"
      ? "right-0 bottom-0 h-24 w-24"
      : frameState === "fullscreen"
        ? "inset-0 h-full w-full"
        : "right-0 bottom-0 h-full w-[420px] max-w-full";

  return (
    <div
      ref={cardRef}
      className="relative h-[580px] overflow-hidden rounded-xl border border-border bg-card"
    >
      <SweetCrumbsBackdrop />
      <iframe
        ref={frameRef}
        title="Sweet Crumbs Bakery chat widget"
        src={`${WIDGET_ORIGIN}/frame.html?key=${encodeURIComponent(publicKey)}&origin=${encodeURIComponent(
          typeof window === "undefined" ? "" : window.location.origin,
        )}&open=1&demo=1`}
        className={`absolute border-0 bg-transparent ${frameClass}`}
        style={{ colorScheme: "normal" }}
      />
    </div>
  );
}
