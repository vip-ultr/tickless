import { useState } from "react";
import { View, Text, Image, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import type { ExtractResult, ApiError } from "@/lib/types";
import { downloadToCache } from "@/lib/download";
import { saveToGallery } from "@/lib/gallery";
import { tap, success as hapticSuccess, error as hapticError } from "@/lib/haptics";
import { showToast } from "@/app/_layout";
import { BRAND } from "@/lib/brand";
import { Panel, Button, Muted } from "@/components/ui/primitives";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving"; label: string; progress: number }
  | { kind: "saved" }
  | { kind: "failed"; message: string };

// Web-parity gallery behavior (locked): Download (selected) + Download all
// only when it is a multi-item carousel. No per-item buttons.
export function ResultCard({ data }: { data: ExtractResult }) {
  const [selected, setSelected] = useState(0);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  const gallery = data.gallery ?? [];
  const types = data.gallery_types ?? [];
  const isCarousel = gallery.length > 1;
  const selectedType = types[selected] ?? "video";

  async function saveOne(index: number) {
    if (save.kind === "saving") return;
    tap();
    const itemUrl = isCarousel ? gallery[index] : data.video_url;
    if (!itemUrl) {
      setSave({ kind: "failed", message: "No media found for this item." });
      return;
    }
    const isPhoto = (types[index] ?? "") === "photo";
    setSave({
      kind: "saving",
      label: isPhoto ? "Saving photo..." : "Downloading...",
      progress: 0,
    });
    try {
      // /api/download infers media type server-side; kind=video streams either
      // video or photo bytes for IG/TikTok items (web does the same).
      const file = await downloadToCache(
        { result: { ...data, url: data.url }, kind: "video", galleryIndex: isCarousel ? index : undefined },
        (f) => setSave((s) => (s.kind === "saving" ? { ...s, progress: f } : s)),
      );
      await saveToGallery(file.uri, file.mimeType);
      hapticSuccess();
      showToast({ kind: "success", message: "Saved to your Tickless album" });
      setSave({ kind: "saved" });
    } catch (e: unknown) {
      const err = e as ApiError;
      hapticError();
      showToast({ kind: "error", message: err.message ?? "Could not save the file." });
      setSave({ kind: "failed", message: err.message ?? "Could not save the file. Try again." });
    }
  }

  async function onSaveSelected() {
    if (save.kind === "saving") return;
    await saveOne(selected);
  }

  async function onSaveAll() {
    if (save.kind === "saving" || !isCarousel) return;
    try {
      for (let i = 0; i < gallery.length; i++) {
        setSave({ kind: "saving", label: `Saving ${i + 1} of ${gallery.length}...`, progress: i / gallery.length });
        await saveOneSilent(i);
      }
      setSave({ kind: "saved" });
    } catch (e: unknown) {
      const err = e as ApiError;
      setSave({ kind: "failed", message: err.message ?? `Saved some items but one failed. Check your album.` });
    }
  }

  async function saveOneSilent(index: number) {
    const file = await downloadToCache({
      result: { ...data, url: data.url },
      kind: "video",
      galleryIndex: index,
    });
    await saveToGallery(file.uri, file.mimeType);
  }

  async function onSaveAudio() {
    if (save.kind === "saving") return;
    if (selectedType !== "video" && !isCarousel) {
      setSave({ kind: "failed", message: "Audio is only available for videos." });
      return;
    }
    setSave({ kind: "saving", label: "Extracting audio...", progress: 0 });
    try {
      const file = await downloadToCache(
        { result: { ...data, url: data.url }, kind: "audio", galleryIndex: isCarousel ? selected : undefined },
        (f) => setSave((s) => (s.kind === "saving" ? { ...s, progress: f } : s)),
      );
      await saveToGallery(file.uri, file.mimeType);
      setSave({ kind: "saved" });
    } catch (e: unknown) {
      const err = e as ApiError;
      setSave({ kind: "failed", message: err.message ?? "Could not extract the audio. Try again." });
    }
  }

  const savingPct =
    save.kind === "saving" && save.progress > 0 ? `${Math.round(save.progress * 100)}%` : null;

  return (
    <Panel style={{ marginTop: 20 }}>
      {data.thumbnail ? (
        (() => {
          const previewUri = isCarousel && types[selected] === "photo" ? gallery[selected] : data.thumbnail;
          return (
            <Image source={{ uri: previewUri ?? data.thumbnail }} style={styles.thumb} resizeMode="cover" />
          );
        })()
      ) : null}
      <Text style={styles.title} numberOfLines={2}>
        {data.title ?? "Untitled"}
      </Text>
      <Muted style={{ marginTop: 2 }}>
        {[data.author, data.platform].filter(Boolean).join(" - ")}
        {isCarousel ? ` - ${gallery.length} items` : ""}
      </Muted>

      {isCarousel && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}
        >
          {types.map((t, i) => (
            <ChipButton
              key={`${t}-${i}`}
              label={`${t === "photo" ? "Photo" : "Video"} ${i + 1}`}
              active={selected === i}
              onPress={() => {
                setSelected(i);
                setSave({ kind: "idle" });
              }}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <Button
          title={save.kind === "saving" ? (savingPct ? `Saving ${savingPct}` : save.label) : isCarousel ? "Download" : data.video_url || !isCarousel ? "Download video" : "Download"}
          onPress={onSaveSelected}
          disabled={save.kind === "saving"}
        />
        {isCarousel && (
          <Button title={`Download all ${gallery.length}`} variant="ghost" onPress={onSaveAll} disabled={save.kind === "saving"} style={{ marginTop: 10 }} />
        )}
        {!isCarousel && (selectedType === "video" || data.audio_url) && (
          <Button title="Audio only" variant="ghost" onPress={onSaveAudio} disabled={save.kind === "saving"} style={{ marginTop: 10 }} />
        )}
      </View>

      {save.kind === "saving" && save.progress > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(save.progress * 100)}%` }]} />
        </View>
      )}
      {save.kind === "saving" && save.progress === 0 && (
        <View style={styles.progressRow}>
          <ActivityIndicator color={BRAND.green} size="small" />
          <Text style={styles.progressLabel}>{save.label}</Text>
        </View>
      )}

      {save.kind === "saved" && (
        <View style={styles.savedRow}>
          <CheckCircle2 color={BRAND.green} size={18} />
          <Text style={styles.savedText}>Saved to your Tickless album</Text>
        </View>
      )}

      {save.kind === "failed" && <Text style={styles.failText}>{save.message}</Text>}
    </Panel>
  );
}

function ChipButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={[
        styles.chip,
        active && styles.chipActive,
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: "100%",
    height: 190,
    borderRadius: 18,
    marginBottom: 14,
    backgroundColor: BRAND.midnightElevated,
  },
  title: { color: BRAND.white, fontSize: 17, fontWeight: "600", lineHeight: 23 },
  chipsRow: { marginTop: 12, flexGrow: 0 },
  chipsContent: { gap: 8 },
  chip: {
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
    overflow: "hidden",
    backgroundColor: BRAND.glassTint,
  },
  chipActive: {
    color: BRAND.greenText,
    backgroundColor: BRAND.green,
    borderColor: BRAND.green,
  },
  actions: { marginTop: 16 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  progressLabel: { color: BRAND.muted, fontSize: 13 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 14,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: BRAND.green, borderRadius: 2 },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  savedText: { color: BRAND.green, fontSize: 14, fontWeight: "600" },
  failText: { color: BRAND.danger, fontSize: 13, marginTop: 12, lineHeight: 19 },
});
