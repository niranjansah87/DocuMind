export type DocumentItem = {
  document_id: string;
  filename: string;
  status: "processing" | "ready" | "failed";
  created_at: string;
  byte_size: number;
  mime_type: string;
  page_count: number | null;
};

export type DocumentChunk = {
  chunk_id: string;
  chunk_index: number;
  text: string;
  token_count: number;
  section: string | null;
  page_start: number | null;
  page_end: number | null;
};

export type DocumentDetail = DocumentItem & {
  chunk_count: number;
  chunk_size_tokens: number | null;
  overlap_tokens: number | null;
  chunks: DocumentChunk[];
};

export type UploadResult = {
  document_id: string;
  filename: string;
  status: string;
  duplicate: boolean;
  chunk_count: number;
};

export type Citation = {
  document_id: string;
  document_name: string;
  chunk_id: string;
  chunk_index: number;
  section: string | null;
  page_start: number | null;
  page_end: number | null;
  quote: string;
};

export type StreamResult = {
  answer: string;
  citations: Citation[];
  route: string;
  abstained: boolean;
  latencyMs: number;
};

export type ApiError = { error: { code: string; message: string; request_id: string } };

export type TicketDraft = { subject: string; description: string; order_number?: string };
export type PendingTicket = { pending_action_id: string; summary: string; expires_at: string };
export type CreatedTicket = { ticket_id: string; ticket_number: string; status: string };
