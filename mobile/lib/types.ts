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
  // The source URL this result came from (needed to call /api/download)
  url?: string;
  gallery?: string[] | null;
  gallery_types?: string[] | null;
  photo_urls?: string[] | null;
}

export type ApiErrorKind =
  | "unsupported"
  | "no_media"
  | "ig_blocked"
  | "unavailable"
  | "extract_failed"
  | "extractor_waking"
  | "rate_limited"
  | "network"
  | "download_failed"
  | "save_failed"
  | "unknown";

export interface ApiError {
  kind: ApiErrorKind;
  message: string;
  retryAfter?: number;
}
