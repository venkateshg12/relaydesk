import { CloseIcon } from "./icons";

interface HeaderProps {
  businessName: string;
  // `null` while the server hasn't said yet.
  isTeamOnline: boolean | null;
  onClose: () => void;
}

export function Header({ businessName, isTeamOnline, onClose }: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-2 bg-brand px-4 py-3 text-brand-foreground">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] leading-tight font-semibold tracking-tight">{businessName}</h2>
        {isTeamOnline !== null && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs leading-tight">
            <span className={`size-2 shrink-0 rounded-full ${isTeamOnline ? "bg-online" : "bg-away"}`} aria-hidden />
            {isTeamOnline ? "Online now" : "Away, we'll reply by email"}
          </p>
        )}
      </div>

      {/* A 44px target on every screen (DESIGN_SYSTEM §12). */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close chat"
        className="-mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg opacity-90 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-current"
      >
        <CloseIcon className="size-5" />
      </button>
    </header>
  );
}
