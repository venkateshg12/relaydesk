import { cn } from "@/lib/utils";

// The relay mark (DESIGN_SYSTEM §11, phase 13): two offset speech bubbles in a signal-blue square — the same
// drawing as `app/icon.tsx`, so the tab icon and the wordmark match.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("size-8 shrink-0", className)}
    >
      {/* A logo is a fixed asset, so it keeps the light-theme signal blue in both themes. */}
      <rect width="32" height="32" rx="9" fill="#2450E6" />
      <path d="M6 10a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H7a1 1 0 0 1-1-1z" fill="#fff" />
      <path
        d="M26 22a4 4 0 0 1-4 4h-5a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4h8a1 1 0 0 1 1 1z"
        fill="#fff"
        fillOpacity="0.72"
      />
    </svg>
  );
}

// Mark plus wordmark. `tone="stage"` is for the dark indigo surfaces, where the word turns light.
export function Logo({
  tone = "default",
  className,
}: {
  tone?: "default" | "stage";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-display text-[17px] font-extrabold tracking-[-0.02em] font-expanded",
          tone === "stage" ? "text-stage-foreground" : "text-foreground",
        )}
      >
        RelayDesk
      </span>
    </span>
  );
}
