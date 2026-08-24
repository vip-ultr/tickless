import * as MediaLibrary from "expo-media-library";
import type { ApiError } from "./types";

const ALBUM_NAME = "Tickless";

// Ensures gallery permission, saves the cached file into the "Tickless"
// album (Android) / Photos album (iOS). Returns the asset.
export async function saveToGallery(fileUri: string, mimeType: string): Promise<string> {
  const { granted } = await MediaLibrary.requestPermissionsAsync();
  if (!granted) {
    const err: ApiError = {
      kind: "save_failed",
      message: "We need photo and video permission to save downloads. Allow it in settings.",
    };
    throw err;
  }

  const asset = await MediaLibrary.createAssetAsync(fileUri);
  // Album is created on first save; reused afterwards.
  const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
  if (album == null) {
    await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
  } else {
    await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
  }
  return asset.id;
}

export function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}
