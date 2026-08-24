import { useState } from "react";
import { View, Text, Image, StyleSheet, ActivityIndicator } from "react-native";
import { Download, Music, CheckCircle2 } from "lucide-react-native";
import type { ExtractResult, ApiError } from "@/lib/types";
import { downloadToCache } from "@/lib/download";
import { saveToGallery } from "@/lib/gallery";
import { BRAND, SPACING } from "@/lib/brand";
import { Panel, Button, Muted } from "@/components/ui/primitives";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving"; label: string; progress: number }
  | { kind: "saved" }
  | { kind: "failed"; message: string };

export function ResultCard({ data }: { data: ExtractResult }) {
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  async function onSave(kind: "video" | "audio") {
    if (save.kind === "saving") return;
    setSave({ kind: "saving", label: kind === "audio" ? "Extracting audio..." : "Downloading...", progress: 0 });
    try {
      const file = await downloadToCache(
        { result: data, kind },
        (f) => setSave((s) => (s.kind === "saving" ? { ...s, progress: f } : s)),
      );
      await saveToGallery(file.uri, file.mimeType);
      setSave({ kind: "saved" });
    } catch (e: unknown) {
      const err = e as ApiError;
      setSave({ kind: "failed", message: err.message ?? "Could not save the file. Try again." });
    }
  }

  return (
    <Panel style={{ marginTop: 20 }}>
      {data.thumbnail ? (
        <Image source={{ uri: data.thumbnail }} style={styles.thumb} resizeMode="cover" />
      ) : null}
      <Text style={styles.title} numberOfLines={2}>
        {data.title ?? "Untitled"}
      </Text>
      <Muted style={{ marginTop: 2 }}>
        {[data.author, data.platform].filter(Boolean).join(" - ")}
      </Muted>

      <View style={styles.actions}>
        {data.video_url && (
          <Button
            title={save.kind === "saving" && save.label.includes("Downloading") ? `Saving ${Math.round(save.progress * 100)}%` : "Download video"}
            onPress={() => onSave("video")}
            disabled={save.kind === "saving"}
          />
        )}
        {data.audio_url && (
          <Button
            title={save.kind === "saving" && save.label.includes("audio") ? save.label : "Audio only"}
            variant="ghost"
            onPress={() => onSave("audio")}
            disabled={save.kind === "saving"}
            style={{ marginTop: 10 }}
          />
        )}
      </View>

      {save.kind === "saving" && !save.label.includes("%") && !save.label.includes("audio") && (
        <View style={styles.progressRow}>
          <ActivityIndicator color={BRAND.green} size="small" />
          <Text style={styles.progressLabel}>{save.label}</Text>
        </View>
      )}
      {save.kind === "saving" && save.progress > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(save.progress * 100)}%` }]} />
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

const styles = StyleSheet.create({
  thumb: {
    width: "100%",
    height: 190,
    borderRadius: 18,
    marginBottom: 14,
    backgroundColor: BRAND.midnightElevated,
  },
  title: { color: BRAND.white, fontSize: 17, fontWeight: "600", lineHeight: 23 },
  actions: { marginTop: SPACING.cardPadding },
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
