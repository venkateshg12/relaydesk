import { ChatIcon, CloseIcon } from "./icons";

interface LauncherProps {
  isOpen: boolean;
  unread: number;
  onClick: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}

// 56px circle in the brand colour. The badge is white with ink text and a 2px brand ring, so it
// stands out on any brand colour and any host page (DESIGN_SYSTEM §9).
export function Launcher({ isOpen, unread, onClick, ref }: LauncherProps) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "Close chat" : unread > 0 ? `Open chat, ${unread} unread` : "Open chat"}
      aria-expanded={isOpen}
      className="relative flex size-14 cursor-pointer items-center justify-center rounded-full bg-brand text-brand-foreground shadow-widget transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {/* `key` restarts the 2px nudge once per new reply — a bounce, never a loop. */}
      <span key={unread} className={unread > 0 && !isOpen ? "motion-safe:animate-nudge" : undefined}>
        {isOpen ? <CloseIcon className="size-6" /> : <ChatIcon className="size-6" />}
      </span>

      {!isOpen && unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 animate-pop items-center justify-center rounded-full bg-panel px-1.5 text-xs font-semibold text-ink tabular-nums ring-2 ring-brand">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
