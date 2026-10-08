// Everything the widget remembers lives in its own origin's storage — never a cookie, because third-party
// cookies are blocked inside an iframe. Storage itself can be blocked too (private modes, strict
// settings), so every access is guarded and the widget works without it, just without memory.
export interface StoredOutboxItem {
  clientMessageId: string;
  body: string;
}

const read = (storage: Storage, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const write = (storage: Storage, key: string, value: string | null) => {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // Storage is blocked or full: carry on without it.
  }
};

export const store = {
  getToken: (publicKey: string) => read(localStorage, `rd_visitor_token_${publicKey}`),
  setToken: (publicKey: string, token: string | null) => write(localStorage, `rd_visitor_token_${publicKey}`, token),

  // Replies not yet confirmed by the server, so a page change or a closed tab doesn't lose them.
  getOutbox: (publicKey: string): StoredOutboxItem[] => {
    try {
      const parsed: unknown = JSON.parse(read(localStorage, `rd_outbox_${publicKey}`) ?? "[]");
      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is StoredOutboxItem =>
              typeof item?.clientMessageId === "string" && typeof item?.body === "string"
          )
        : [];
    } catch {
      return [];
    }
  },
  setOutbox: (publicKey: string, items: StoredOutboxItem[]) =>
    write(localStorage, `rd_outbox_${publicKey}`, items.length ? JSON.stringify(items) : null),

  // The window stays open across the host site's page changes, for this tab only.
  wasOpen: (publicKey: string) => read(sessionStorage, `rd_open_${publicKey}`) === "1",
  setOpen: (publicKey: string, isOpen: boolean) => write(sessionStorage, `rd_open_${publicKey}`, isOpen ? "1" : null),

  hasDismissedPrompt: (publicKey: string) => read(localStorage, `rd_prompt_dismissed_${publicKey}`) === "1",
  dismissPrompt: (publicKey: string) => write(localStorage, `rd_prompt_dismissed_${publicKey}`, "1"),
};
