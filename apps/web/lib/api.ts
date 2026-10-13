import type {
  ApiError,
  Citation,
  CreatedTicket,
  DocumentDetail,
  DocumentItem,
  PendingTicket,
  StreamResult,
  TicketDraft,
  UploadResult,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function errorMessage(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status})`;
  try {
    const payload = (await response.json()) as ApiError;
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/health`, { signal, cache: "no-store" });
  return response.ok;
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/documents`, { cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response));
  return ((await response.json()) as { items: DocumentItem[] }).items;
}

export async function uploadDocument(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/v1/documents`, { method: "POST", body });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<UploadResult>;
}

export async function getDocument(documentId: string): Promise<DocumentDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v1/documents/${documentId}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<DocumentDetail>;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/documents/${documentId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await errorMessage(response));
}

export async function prepareTicket(draft: TicketDraft): Promise<PendingTicket> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<PendingTicket>;
}

export async function confirmTicket(pendingActionId: string): Promise<CreatedTicket> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pending_action_id: pendingActionId, confirmed: true }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<CreatedTicket>;
}

type EventBlock = { event: string; data: string };

function parseBlock(block: string): EventBlock | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return data.length ? { event, data: data.join("\n") } : null;
}

export async function streamChat(
  message: string,
  documentIds: string[],
  onToken: (token: string) => void,
  signal: AbortSignal,
  onStatus?: (stage: string) => void,
): Promise<StreamResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, document_ids: documentIds }),
    signal,
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  if (!response.body) throw new Error("The response stream was empty.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let citations: Citation[] = [];
  let route = "rag";
  let abstained = false;
  let latencyMs = 0;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const rawBlock of blocks) {
      const parsed = parseBlock(rawBlock);
      if (!parsed) continue;
      const payload = JSON.parse(parsed.data) as Record<string, unknown> | Citation[];
      if (parsed.event === "token" && !Array.isArray(payload)) {
        const token = String(payload.text ?? "");
        answer += token;
        onToken(answer);
      } else if (parsed.event === "replace" && !Array.isArray(payload)) {
        answer = String(payload.text ?? "");
        onToken(answer);
      } else if (parsed.event === "status" && !Array.isArray(payload)) {
        onStatus?.(String(payload.stage ?? "answering"));
      } else if (parsed.event === "citations" && Array.isArray(payload)) {
        citations = payload;
      } else if (parsed.event === "done" && !Array.isArray(payload)) {
        route = String(payload.route ?? route);
        abstained = Boolean(payload.abstained);
        latencyMs = Number(payload.latency_ms ?? 0);
        answer = String(payload.answer ?? answer);
      } else if (parsed.event === "error" && !Array.isArray(payload)) {
        throw new Error(String(payload.message ?? "The answer service is unavailable."));
      }
    }
    if (done) break;
  }
  return { answer: answer.trim(), citations, route, abstained, latencyMs };
}
