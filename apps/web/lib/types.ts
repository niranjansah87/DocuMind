export type DocumentItem = {
  document_id: string;
  filename: string;
  status: "processing" | "ready" | "failed";
  created_at: string;
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
