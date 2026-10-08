import { useCallback, useEffect, useMemo, useState } from "react";

export type FrameState = "bubble" | "open" | "fullscreen";

const MOBILE_BREAKPOINT = 640;

// The loader passes the host page's origin in the frame URL; anything that isn't a plain origin is ignored.
export const readHostOrigin = (): string | null => {
  try {
    const origin = new URL(
      new URLSearchParams(window.location.search).get("origin") ?? "",
    ).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
};

/*
  The conversation with the loader on the host page (the `rd:*` postMessage protocol). Both directions
  are pinned to the host's origin and, for incoming messages, to the parent window: nothing is ever
  posted to "*" and nothing from another window or origin is believed.
    in   rd:context  { url, viewport }   the page the visitor is on, and how wide the window is
    out  rd:ready                        the frame is up — send the context
    out  rd:resize   { state }           ask the loader to size the iframe
 */
export function useHost(
  onDemoMessage?: (message: { type: string; [key: string]: unknown }) => void,
) {
  const hostOrigin = useMemo(readHostOrigin, []);
  const [pageUrl, setPageUrl] = useState("");
  // The frame's own width is the iframe's (96px as a bubble), so "is this a phone?" must come from the host.
  const [viewportWidth, setViewportWidth] = useState(0);

  const post = useCallback(
    (message: { type: string; [key: string]: unknown }) => {
      if (hostOrigin && window.parent !== window)
        window.parent.postMessage(message, hostOrigin);
    },
    [hostOrigin],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== hostOrigin || event.source !== window.parent) return;
      const { type, url, viewport } = event.data ?? {};
      if (type === "rd:context") {
        if (typeof url === "string") setPageUrl(url);
        if (typeof viewport === "number") setViewportWidth(viewport);
      } else if (typeof type === "string" && type.startsWith("rd:")) {
        // Anything else is for the homepage demo (`rd:script`, `rd:network`); the caller decides.
        onDemoMessage?.(event.data);
      }
    };
    window.addEventListener("message", onMessage);
    post({ type: "rd:ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [hostOrigin, post, onDemoMessage]);

  return {
    post,
    pageUrl,
    isMobile: viewportWidth > 0 && viewportWidth < MOBILE_BREAKPOINT,
    resize: (state: FrameState) => post({ type: "rd:resize", state }),
  };
}
