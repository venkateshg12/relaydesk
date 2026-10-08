import type { MessageItem, UpdateVisitorProfileSchema, VisitorSummary, WidgetSessionData } from "@repo/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface Envelope<T> {
  status: "success" | "error";
  data: T;
  message?: string;
}

// The visitor token goes in `Authorization: Bearer` — there is no cookie to rely on in an iframe.
const call = async <T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> => {
  const { token, ...options } = init;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || body?.status !== "success") {
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  return body.data;
};

export const createSession = (publicKey: string, visitorToken?: string | null) =>
  call<WidgetSessionData>("/widget/session", {
    method: "POST",
    body: JSON.stringify({ publicKey, visitorToken: visitorToken ?? undefined }),
  });

export const getMessages = async (token: string, afterSeq: number) =>
  (await call<{ messages: MessageItem[] }>(`/widget/messages?afterSeq=${afterSeq}&limit=50`, { token })).messages;

export const updateProfile = async (token: string, profile: UpdateVisitorProfileSchema) =>
  (
    await call<{ visitor: VisitorSummary }>("/widget/visitor", {
      method: "PATCH",
      body: JSON.stringify(profile),
      token,
    })
  ).visitor;
