// Mirror of the backend /api/extract response shape (web frontend contract).
export interface ExtractResult {
  title: string | null;
  author: string | null;
  duration: number | null;
  thumbnail: string | null;
  video_url: string | null;
  audio_url?: string | null;
  width?: number | null;
  height?: number | null;
  platform: string;
  gallery?: string[] | null;
  gallery_types?: string[] | null;
  photo_urls?: string[] | null;
}

export type ExtractErrorKind =
  | "unsupported"
  | "no_media"
  | "ig_blocked"
  | "unavailable"
  | "extract_failed"
  | "extractor_waking"
  | "rate_limited"
  | "network"
  | "unknown";

export interface ApiError {
  kind: ExtractErrorKind;
  message: string;
  retryAfter?: number;
}

const API_URL_KEY_HEADER = "X-Tickless-Key";

import { authHeaders } from "./config";

export async function extract(url: string): Promise<ExtractResult> {
  const res = await fetch(`${apiBase()}/api/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ url }),
  });
  return handleResponse<ExtractResult>(res);
}

function apiBase(): string {
  // lazy import to avoid cycle at module load
  const { API_URL } = require("./config");
  return API_URL as string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;

  let detail = "";
  try {
    const body = await res.json();
    detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body);
  } catch {
    detail = res.statusText;
  }

  const err: ApiError = { kind: classify(res.status, detail), message: friendly(res.status, detail), retryAfter: numHeader(res, "retry-after") };
  throw err;
}

function numHeader(res: Response, name: string): number | undefined {
  const raw = res.headers.get(name);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function classify(status: number, detail: string): ApiError["kind"] {
  const d = detail.toLowerCase();
  if (status === 429) return "rate_limited";
  if (d.includes("waking") || d.includes("warming")) return "extractor_waking";
  if (d.includes("ig_blocked") || (d.includes("instagram") && d.includes("block"))) return "ig_blocked";
  if (d.includes("not supported") || d.includes("unsupported") || d.includes("tiktok, instagram")) return "unsupported";
  if (d.includes("no media") || d.includes("no_media")) return "no_media";
  if (d.includes("country") || d.includes("region") || d.includes("available in your")) return "unavailable";
  if (status === 400) return "unsupported";
  if (status === 503) return "extractor_waking";
  if (status >= 500) return "extract_failed";
  return "unknown";
}

function friendly(status: number, detail: string): string {
  switch (classify(status, detail)) {
    case "rate_limited":
      return "Slow down a bit. Try again in under a minute.";
    case "extractor_waking":
      return "Our servers are waking up. Retrying shortly.";
    case "ig_blocked":
      return "Instagram is blocking our servers right now. This usually passes.";
    case "unsupported":
      return "That link is not supported. Paste a TikTok or Instagram link.";
    case "no_media":
      return "No downloadable media found on that link.";
    case "unavailable":
      return "This content is region locked and cannot be downloaded.";
    case "extract_failed":
      return "Extraction failed. The link may be private or deleted.";
    default:
      return detail || "Something went wrong. Try again.";
  }
}
