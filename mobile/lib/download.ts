import { BRAND } from "@/lib/brand";
import type { ExtractResult, ApiError } from "./types";

import { API_URL, authHeaders } from "./config";

export interface DownloadInput {
  result: ExtractResult;
  kind: "video" | "audio";
  galleryIndex?: number;
}

// Streams the file from our backend into the app's cache, then hands the
// local file to the caller for saving via media-library.
export async function downloadToCache(
  input: DownloadInput,
  onProgress?: (fraction: number) => void,
): Promise<{ uri: string; mimeType: string; suggestedName: string }> {
  const params = new URLSearchParams({ url: input.result.url ?? "", kind: input.kind });
  if (input.galleryIndex != null) params.set("gallery_index", String(input.galleryIndex));

  const res = await fetch(`${API_URL}/api/download?${params.toString()}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const err: ApiError = {
      kind: "download_failed",
      message: "The download failed. Give it another try in a moment.",
    };
    throw err;
  }

  // Content-Disposition filename (backend names files like
  // "<uploader> - <title> - Tickless.mp4")
  const disposition = res.headers.get("content-disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/);
  const asciiMatch = disposition.match(/filename="?([^";]+)"?/);
  const suggestedName = utf8Match
    ? decodeURIComponent(utf8Match[1])
    : asciiMatch
      ? asciiMatch[1]
      : `tickless-download.${input.kind === "audio" ? "mp3" : "mp4"}`;

  const mimeType =
    res.headers.get("content-type") ??
    (input.kind === "audio" ? "audio/mpeg" : "video/mp4");

  const total = Number(res.headers.get("content-length") ?? 0);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("no response body");

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0 && onProgress) onProgress(received / total);
  }

  // Write to cache via expo-file-system (base64 write is the reliable RN path)
  const FileSystem = require("expo-file-system");
  const safeName = suggestedName.replace(/[^a-zA-Z0-9._ -]/g, "_");
  const fileUri = FileSystem.cacheDirectory + safeName;

  const parts: BlobPart[] = chunks.map((c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer);
  const blob = new Blob(parts, { type: mimeType });
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { uri: fileUri, mimeType, suggestedName };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000; // avoid call-stack overflow on big files
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
