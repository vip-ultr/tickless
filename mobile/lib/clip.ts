import type { ApiError } from "./types";
import { API_URL, authHeaders } from "./config";

// Clip API client. Mirrors the web ClipEditor request shapes exactly:
// - POST /api/clip/upload (multipart file) -> {token, duration, title}
// - POST /api/clip {token|source_url, start, end, audio_only} -> streamed clip

export interface UploadResult {
  token: string;
  duration: number;
  title: string;
}

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // matches backend CLIP_MAX_UPLOAD_BYTES

export async function uploadSource(
  fileUri: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
): Promise<UploadResult> {
  if (fileSize > MAX_UPLOAD_BYTES) {
    const err: ApiError = {
      kind: "unsupported",
      message: `File too large. The limit is 500 MB.`,
    };
    throw err;
  }

  const FileSystem = require("expo-file-system");
  const form = new FormData();
  // @ts-ignore React Native FormData accepts {uri, name, type}
  form.append("file", { uri: fileUri, name: fileName, type: mimeType || "video/mp4" });

  const res = await fetch(`${API_URL}/api/clip/upload`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });

  return handleClipResponse<UploadResult>(res);
}

// Trim one segment and save into cache. Returns local file info for the
// gallery save step.
export async function trimSegment(opts: {
  token?: string;
  sourceUrl?: string;
  start: number;
  end: number;
  audioOnly?: boolean;
}): Promise<{ uri: string; mimeType: string; suggestedName: string }> {
  const res = await fetch(`${API_URL}/api/clip`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      ...(opts.token ? { token: opts.token } : {}),
      ...(opts.sourceUrl ? { source_url: opts.sourceUrl } : {}),
      start: opts.start,
      end: opts.end,
      audio_only: !!opts.audioOnly,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : "";
    } catch {}
    const err: ApiError = {
      kind: "download_failed",
      message: detail || "The clip failed to render. Try a different range.",
    };
    throw err;
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/);
  const asciiMatch = disposition.match(/filename="?([^";]+)"?/);
  const suggestedName = utf8Match
    ? decodeURIComponent(utf8Match[1])
    : asciiMatch
      ? asciiMatch[1]
      : `tickless-clip.${opts.audioOnly ? "mp3" : "mp4"}`;

  const mimeType =
    res.headers.get("content-type") ?? (opts.audioOnly ? "audio/mpeg" : "video/mp4");

  const total = Number(res.headers.get("content-length") ?? 0);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("no response body");

  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const FileSystem = require("expo-file-system");
  const safeName = suggestedName.replace(/[^a-zA-Z0-9._ -]/g, "_");
  const fileUri = FileSystem.cacheDirectory + safeName;

  const parts: BlobPart[] = chunks.map(
    (c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer,
  );
  const blob = new Blob(parts, { type: mimeType });
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { uri: fileUri, mimeType, suggestedName };
}

async function handleClipResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : "";
    } catch {}
    const err: ApiError = {
      kind: res.status === 413 ? "unsupported" : "download_failed",
      message:
        detail ||
        (res.status === 413
          ? "File too large. The limit is 500 MB."
          : "The upload failed. Check your connection and try again."),
    };
    throw err;
  }
  return (await res.json()) as T;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
