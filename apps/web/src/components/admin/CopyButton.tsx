"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COPIED_MS = 1500;

// "Copy" turns into a check and "Copied" for a moment, then back (DESIGN_SYSTEM §10.3).
export function CopyButton({
  text,
  label = "Copy",
  variant = "outline",
  disabled,
}: {
  text: string;
  label?: string;
  variant?: "outline" | "ghost";
  disabled?: boolean;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // Clipboard access denied: the text stays selectable in the block above.
    }
    setIsCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setIsCopied(false), COPIED_MS);
  };

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={copy}
      disabled={disabled}
      className="shrink-0"
    >
      {isCopied ? <Check className="text-status-resolved" /> : <Copy />}
      <span
        className={cn(isCopied && "text-status-resolved")}
        aria-live="polite"
      >
        {isCopied ? "Copied" : label}
      </span>
    </Button>
  );
}
