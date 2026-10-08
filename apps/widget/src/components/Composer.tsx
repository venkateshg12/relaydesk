import { useEffect, useRef, useState } from "react";
import { SendIcon } from "./icons";

interface ComposerProps {
  onSend: (body: string, email?: string) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  // Seconds left of a rate limit; the box is disabled and says so (DESIGN_SYSTEM §9).
  cooldown: number;
  // The team is away and we don't have the visitor's email yet: ask for it with the message.
  needsEmail: boolean;
  // The homepage demo's one scripted moment: a sample question types itself, then sends.
  autoType?: { id: number; text: string } | null;
  // After the scripted question: "Your turn. Ask anything."
  placeholder?: string;
  onAutoTyped?: () => void;
  ref?: React.Ref<HTMLTextAreaElement>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPING_STOP_MS = 2000;
const TYPING_CHARACTER_MS = 45;

export function Composer({
  onSend,
  onTyping,
  cooldown,
  needsEmail,
  autoType,
  placeholder = "Type your message…",
  onAutoTyped,
  ref,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isTyping = useRef(false);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const stopTyping = () => {
    clearTimeout(typingTimer.current);
    if (isTyping.current) onTyping(false);
    isTyping.current = false;
  };

  const handleChange = (value: string) => {
    setText(value);
    // Tell the team once when typing starts, and once two seconds after it stops.
    if (!isTyping.current) onTyping(true);
    isTyping.current = true;
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, TYPING_STOP_MS);

    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  // Types the scripted question one character at a time, like a person, then sends it.
  useEffect(() => {
    if (!autoType) return;
    // An empty script means "skip it" (reduced motion, or already played): just show the hint.
    if (!autoType.text) return onAutoTyped?.();
    let shown = 0;
    let sendTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      shown += 1;
      setText(autoType.text.slice(0, shown));
      if (shown < autoType.text.length) return;
      clearInterval(timer);
      sendTimer = setTimeout(() => {
        void onSend(autoType.text).then(() => {
          setText("");
          onAutoTyped?.();
        });
      }, 400);
    }, TYPING_CHARACTER_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(sendTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the script runs once per `id`, whatever else changes
  }, [autoType?.id]);

  const isLimited = cooldown > 0;
  const canSend =
    text.trim().length > 0 &&
    !isLimited &&
    (!needsEmail || EMAIL_PATTERN.test(email.trim()));

  const handleSend = async () => {
    if (!canSend) return;
    const body = text.trim();
    setError("");
    stopTyping();
    // The box empties before the server answers, so the button is disabled (nothing left to send) and a second
    // click or Enter can't send the same text again. The message is already in the thread as "sending", and the
    // outbox keeps it until the server confirms. Waiting for the answer first left the text in the box for as long
    // as the round trip took, and every click in that time created another message.
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    try {
      await onSend(body, needsEmail ? email.trim() : undefined);
    } catch {
      // Only the email step can throw. Give the visitor their text back so nothing they typed is lost.
      setText(body);
      setError("We couldn't save your email. Check it and try again.");
    }
  };

  return (
    <div className="border-t border-hairline bg-panel p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {needsEmail && (
        <div className="mb-2">
          <label
            htmlFor="rd-email"
            className="mb-1 block text-xs font-medium text-ink-muted"
          >
            Your email, so we can reply
          </label>
          <input
            id="rd-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
          />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
      )}

      {isLimited ? (
        <p
          role="status"
          className="rounded-lg bg-danger-soft px-3 py-2.5 text-center text-xs font-medium text-danger"
        >
          You can send again in {cooldown}s
        </p>
      ) : (
        // The send button (32px) sets the row height, and one line of text (22px + 5px padding above and below) is
        // exactly as tall, so a single line sits centred next to it. A longer message grows upward and the button
        // stays at the bottom, as in any chat box.
        <div className="flex items-end gap-2 rounded-xl border border-hairline bg-canvas py-1.5 pr-1.5 pl-3 focus-within:border-ink">
          <textarea
            ref={(node) => {
              textareaRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            rows={1}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter is a new line.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            aria-label="Message"
            placeholder={placeholder}
            className="max-h-[120px] min-h-8 flex-1 resize-none bg-transparent py-1.25 leading-[1.4] text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            aria-label="Send message"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-brand text-brand-foreground transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendIcon className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
