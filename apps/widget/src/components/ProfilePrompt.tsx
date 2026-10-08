import { useState } from "react";

interface ProfilePromptProps {
  hasName: boolean;
  hasEmail: boolean;
  onSave: (profile: { name?: string; email?: string }) => Promise<void>;
  onSkip: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// An inline card in the thread after the first message — never a modal, so the visitor keeps chatting (DESIGN_SYSTEM §9).
export function ProfilePrompt({ hasName, hasEmail, onSave, onSkip }: ProfilePromptProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() && !email.trim()) return onSkip();
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) return setError("Enter a valid email address.");

    setError("");
    setIsSaving(true);
    try {
      await onSave({ name: name.trim() || undefined, email: email.trim() || undefined });
    } catch {
      setError("We couldn't save that. Try again, or skip.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="my-4 rounded-xl border border-hairline bg-canvas p-3.5">
      <p className="text-[13px] leading-snug font-medium">Leave your details so we can reach you if you leave the page</p>

      <div className="mt-2.5 space-y-2">
        {!hasName && (
          <input
            type="text"
            autoComplete="name"
            aria-label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full rounded-lg border border-hairline bg-panel px-3 py-1.5 text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
          />
        )}
        {!hasEmail && (
          <input
            type="email"
            autoComplete="email"
            aria-label="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-lg border border-hairline bg-panel px-3 py-1.5 text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
          />
        )}
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button type="button" onClick={onSkip} className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink">
          Skip
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="cursor-pointer rounded-lg bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
