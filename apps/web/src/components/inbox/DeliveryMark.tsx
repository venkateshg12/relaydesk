import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react";

export type DeliveryStatus = "sending" | "sent" | "seen" | "failed";

/*
  The mark under the agent's own messages (DESIGN_SYSTEM §8): sending is a muted clock, sent a muted
  check, seen a signal double check, failed a red alert with a Retry link. Never colour alone — every
  state has an icon and a label for screen readers.
 */
export function DeliveryMark({
  status,
  onRetry,
}: {
  status: DeliveryStatus;
  onRetry?: () => void;
}) {
  if (status === "failed") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-destructive hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <AlertCircle className="size-3.5" aria-hidden />
        Not sent. Retry
      </button>
    );
  }

  if (status === "seen")
    return (
      <CheckCheck
        className="size-3.5 text-signal"
        role="img"
        aria-label="Seen"
      />
    );
  if (status === "sent")
    return (
      <Check
        className="size-3.5 text-muted-foreground"
        role="img"
        aria-label="Sent"
      />
    );
  return (
    <Clock
      className="size-3.5 text-muted-foreground"
      role="img"
      aria-label="Sending"
    />
  );
}
