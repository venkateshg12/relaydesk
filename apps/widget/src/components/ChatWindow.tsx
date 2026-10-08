// The window itself — one component for the live widget and for the admin's preview, so what the admin
// sees while editing is the real thing. Desktop: a 380px card that grows from the launcher's corner;
// phones: a fullscreen sheet that slides up (DESIGN_SYSTEM §10.3). Under reduced motion only the fade stays.
interface ChatWindowProps {
  label: string;
  isOpen: boolean;
  isMobile: boolean;
  children: React.ReactNode;
}

const OPEN_MS = 240;
const CLOSE_MS = 180;

export function ChatWindow({
  label,
  isOpen,
  isMobile,
  children,
}: ChatWindowProps) {
  return (
    <section
      role="dialog"
      aria-label={label}
      aria-modal={isMobile}
      inert={!isOpen}
      className={`flex min-h-0 flex-col overflow-hidden bg-panel transition-[opacity,transform] ease-out motion-reduce:scale-100 motion-reduce:translate-y-0 ${
        isMobile
          ? "fixed inset-0 rounded-none"
          : "w-full max-w-[380px] flex-1 origin-bottom-right rounded-2xl shadow-widget"
      } ${isOpen ? "scale-100 translate-y-0 opacity-100" : `opacity-0 ${isMobile ? "translate-y-full" : "scale-95"}`}`}
      style={{ transitionDuration: `${isOpen ? OPEN_MS : CLOSE_MS}ms` }}
    >
      {children}
    </section>
  );
}

export const CLOSE_ANIMATION_MS = CLOSE_MS;
