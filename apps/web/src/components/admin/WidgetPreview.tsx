"use client";

import { useEffect, useRef, useState } from "react";
import type { WidgetConfig } from "@repo/types";
import { WIDGET_ORIGIN } from "@/lib/env";

interface WidgetPreviewProps {
  widget: WidgetConfig;
  isTeamOnline: boolean;
  view: "window" | "launcher";
}

/*
  The real widget, not a copy: the widget's own frame, loaded in preview mode inside an iframe over a plain
  mock page, drawing the real components with the settings being edited. Every change is posted to it
  (`rd:preview`), pinned to the widget's origin; it answers `rd:ready` when it can listen. Nothing is animated
  on a keystroke — the frame just redraws.
 */
export function WidgetPreview({
  widget,
  isTeamOnline,
  view,
}: WidgetPreviewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin === WIDGET_ORIGIN &&
        event.source === frameRef.current?.contentWindow &&
        event.data?.type === "rd:ready"
      ) {
        setIsReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (isReady)
      frameRef.current?.contentWindow?.postMessage(
        { type: "rd:preview", widget, isTeamOnline, view },
        WIDGET_ORIGIN,
      );
  }, [isReady, widget, isTeamOnline, view]);

  return (
    <div
      className="relative h-[640px] overflow-hidden rounded-lg border border-border bg-background"
      aria-hidden={false}
    >
      {/* A stand-in for the business's page: grey lines, so nothing competes with the widget. */}
      <div className="space-y-3 p-5" aria-hidden>
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-6 w-2/3 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((card) => (
            <div key={card} className="h-24 rounded-lg bg-muted" />
          ))}
        </div>
      </div>

      <iframe
        ref={frameRef}
        title="Widget preview"
        src={`${WIDGET_ORIGIN}/frame.html?preview=1&origin=${encodeURIComponent(typeof window === "undefined" ? "" : window.location.origin)}`}
        className="absolute right-0 bottom-0 h-full w-[420px] max-w-full border-0 bg-transparent"
        style={{ colorScheme: "normal" }}
      />
    </div>
  );
}
