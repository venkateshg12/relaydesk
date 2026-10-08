import { AlertIcon, CheckCheckIcon, CheckIcon, ClockIcon } from "./icons";

export type DeliveryStatus = "sending" | "sent" | "seen" | "failed";

// Under the visitor's own messages (DESIGN_SYSTEM §8): a muted clock, a muted check, a signal double
// check, or a red alert with a Retry link. Every state has an icon and a label, never colour alone.
export function DeliveryMark({ status, onRetry }: { status: DeliveryStatus; onRetry?: () => void }) {
  if (status === "failed") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-danger hover:underline focus-visible:outline-2 focus-visible:outline-danger"
      >
        <AlertIcon className="size-3.5" />
        Not sent. Retry
      </button>
    );
  }
  if (status === "seen") return <CheckCheckIcon className="size-3.5 text-signal" role="img" aria-label="Seen" aria-hidden={false} />;
  if (status === "sent") return <CheckIcon className="size-3.5" role="img" aria-label="Sent" aria-hidden={false} />;
  return <ClockIcon className="size-3.5" role="img" aria-label="Sending" aria-hidden={false} />;
}
