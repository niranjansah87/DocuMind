import type { Citation } from "./types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  route?: string;
  citations?: Citation[];
  latencyMs?: number;
  time?: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  documentId?: string;
  documentName?: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "documind_conversations";
const ACTIVE_CONV_KEY = "documind_active_conversation_id";

function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("documind:conversations-changed"));
  }
}

export function listConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export function getActiveConversationId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_CONV_KEY);
}

export function setActiveConversationId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_CONV_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_CONV_KEY);
  }
  notifyChange();
}

export function getConversation(id: string): Conversation | null {
  const all = listConversations();
  return all.find((c) => c.id === id) || null;
}

export function saveConversation(
  id: string,
  messages: ChatMessage[],
  doc?: { id?: string; name?: string },
): Conversation {
  const all = listConversations();
  const existingIdx = all.findIndex((c) => c.id === id);
  const now = new Date().toISOString();

  // Derive title from first user message if available
  let title = "New Conversation";
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (firstUserMsg && firstUserMsg.text.trim()) {
    const raw = firstUserMsg.text.trim();
    title = raw.length > 40 ? raw.slice(0, 38) + "..." : raw;
  } else if (existingIdx >= 0) {
    title = all[existingIdx].title;
  }

  let conversation: Conversation;
  if (existingIdx >= 0) {
    conversation = {
      ...all[existingIdx],
      title: title !== "New Conversation" ? title : all[existingIdx].title,
      messages,
      documentId: doc?.id ?? all[existingIdx].documentId,
      documentName: doc?.name ?? all[existingIdx].documentName,
      updatedAt: now,
    };
    all[existingIdx] = conversation;
  } else {
    conversation = {
      id,
      title,
      messages,
      documentId: doc?.id,
      documentName: doc?.name,
      createdAt: now,
      updatedAt: now,
    };
    all.unshift(conversation);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    localStorage.setItem(ACTIVE_CONV_KEY, id);
  } catch {
    // localStorage quota protection
  }

  notifyChange();
  return conversation;
}

export function deleteConversation(id: string): void {
  if (typeof window === "undefined") return;
  const all = listConversations().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  if (getActiveConversationId() === id) {
    localStorage.removeItem(ACTIVE_CONV_KEY);
  }
  notifyChange();
}

export function clearAllConversations(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACTIVE_CONV_KEY);
  notifyChange();
}

