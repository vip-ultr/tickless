import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput as RNTextInput,
  Pressable,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { FolderUp, Plus, Trash2, Scissors } from "lucide-react-native";
import { uploadSource, trimSegment, type UploadResult } from "@/lib/clip";
import { saveToGallery } from "@/lib/gallery";
import type { ApiError } from "@/lib/types";
import { BRAND, SPACING } from "@/lib/brand";
import { Panel, Input, Button, Muted, Wordmark } from "@/components/ui/primitives";

interface Segment {
  id: number;
  start: string;
  end: string;
}

let nextId = 1;

type Phase =
  | { kind: "pick" }
  | { kind: "uploading"; pct: number }
  | { kind: "editing"; token?: string; sourceUrl?: string; duration: number; title: string }
  | { kind: "exporting"; label: string }
  | { kind: "exported"; message: string };

export default function ClipScreen() {
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [url, setUrl] = useState("");
  const [segments, setSegments] = useState<Segment[]>([{ id: 0, start: "", end: "" }]);
  const [audioOnly, setAudioOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickDeviceVideo() {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: "video/*",
      copyToCacheDirectory: true,
    });
    if (res.canceled || res.assets.length === 0) return;
    const asset = res.assets[0];
    setPhase({ kind: "uploading", pct: 0 });
    try {
      const uploaded = await uploadSource(
        asset.uri,
        asset.name ?? "video.mp4",
        asset.mimeType ?? "video/mp4",
        asset.size ?? 0,
      );
      setSegments([{ id: nextId++, start: "0", end: String(Math.floor(uploaded.duration)) }]);
      setPhase({ kind: "editing", token: uploaded.token, duration: uploaded.duration, title: uploaded.title });
    } catch (e: unknown) {
      const err = e as ApiError;
      setError(err.message ?? "Upload failed.");
      setPhase({ kind: "pick" });
    }
  }

  function useLink() {
    if (!url.trim()) return;
    // Duration unknown until the backend fetches it; the editor allows
    // free-form times and the backend clamps.
    setError(null);
    setSegments([{ id: nextId++, start: "", end: "" }]);
    setPhase({ kind: "editing", sourceUrl: url.trim(), duration: 0, title: url.trim() });
  }

  function updateSegment(id: number, field: "start" | "end", value: string) {
    setSegments((segs) => segs.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function addSegment() {
    setSegments((segs) => [...segs, { id: nextId++, start: "", end: "" }]);
  }

  function removeSegment(id: number) {
    setSegments((segs) => (segs.length > 1 ? segs.filter((s) => s.id !== id) : segs));
  }

  async function exportAll() {
    if (phase.kind !== "editing") return;
    const exportToken = phase.token;
    const exportSourceUrl = phase.sourceUrl;
    const exportDuration = phase.duration;
    const exportTitle = phase.title;
    const parsed = segments
      .map((s) => ({ start: parseFloat(s.start), end: parseFloat(s.end) }))
      .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);
    if (parsed.length === 0) {
      setError("Fill in a valid start and end for at least one segment.");
      return;
    }
    setError(null);
    try {
      let savedCount = 0;
      for (let i = 0; i < parsed.length; i++) {
        setPhase({ kind: "exporting", label: `Rendering clip ${i + 1} of ${parsed.length}...` });
        const file = await trimSegment({
          token: phase.token,
          sourceUrl: phase.sourceUrl,
          start: parsed[i].start,
          end: parsed[i].end,
          audioOnly,
        });
        await saveToGallery(file.uri, file.mimeType);
        savedCount++;
      }
      setPhase({
        kind: "exported",
        message:
          savedCount === 1
            ? "Clip saved to your Tickless album."
            : `${savedCount} clips saved to your Tickless album.`,
      });
    } catch (e: unknown) {
      const err = e as ApiError;
      setError(err.message ?? "Export failed. Try again.");
      // Re-derive editing phase from what we were exporting
      setPhase((p) =>
        p.kind === "exporting"
          ? { kind: "editing", token: exportToken, sourceUrl: exportSourceUrl, duration: exportDuration, title: exportTitle }
          : p,
      );
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Wordmark size={34} />
        <Text style={styles.h}>Clip</Text>
        <Text style={styles.p}>
          Cut a video into short clips. Paste a link or pick a video from your phone, mark your parts, and save each cut as video or audio. Needs internet.
        </Text>

        {phase.kind === "pick" && (
          <>
            <Panel style={{ marginTop: SPACING.section }}>
              <Input
                value={url}
                onChangeText={setUrl}
                placeholder="Paste a TikTok or Instagram link"
                returnKeyType="done"
              />
              <Button title="Use this link" onPress={useLink} style={{ marginTop: 12 }} />
            </Panel>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Muted>or</Muted>
              <View style={styles.orLine} />
            </View>
            <Panel style={{ padding: 16 }}>
              <Button title="Pick a video from my phone" variant="ghost" onPress={pickDeviceVideo} />
              <View style={styles.hintRow}>
                <FolderUp color={BRAND.muted} size={16} />
                <Muted style={{ flex: 1 }}>Videos up to 500 MB.</Muted>
              </View>
            </Panel>
            {error && (
              <Panel style={[{ marginTop: 16 }, styles.errorPanel]}>
                <Text style={styles.errorText}>{error}</Text>
              </Panel>
            )}
          </>
        )}

        {phase.kind === "uploading" && (
          <Panel style={{ marginTop: SPACING.section }}>
            <View style={styles.progressRow}>
              <ActivityIndicator color={BRAND.green} size="small" />
              <Text style={styles.uploadLabel}>Uploading your video...</Text>
            </View>
            <Muted style={{ marginTop: 8 }}>Large files take a while. Keep the app open.</Muted>
          </Panel>
        )}

        {(phase.kind === "editing" || phase.kind === "exporting") && (
          <>
            <Panel style={{ marginTop: SPACING.section }}>
              <View style={styles.sourceRow}>
                <Scissors color={BRAND.green} size={18} />
                <Text style={styles.sourceTitle} numberOfLines={1}>
                  {phase.kind === "editing" ? phase.title : "Working..."}
                </Text>
              </View>
              {phase.kind === "editing" && phase.duration > 0 && (
                <Muted style={{ marginTop: 4 }}>
                  Length: {Math.floor(phase.duration / 60)}:{String(Math.round(phase.duration % 60)).padStart(2, "0")}
                </Muted>
              )}
            </Panel>

            <Text style={styles.section}>Segments</Text>
            {segments.map((seg, idx) => (
              <Panel key={seg.id} style={{ marginTop: idx === 0 ? 12 : 10, padding: 14 }}>
                <View style={styles.segHead}>
                  <Text style={styles.segLabel}>Clip {idx + 1}</Text>
                  {segments.length > 1 && (
                    <Text onPress={() => removeSegment(seg.id)} style={styles.removeBtn}>
                      <Trash2 color={BRAND.danger} size={16} />
                    </Text>
                  )}
                </View>
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Muted>Start (sec)</Muted>
                    <RNTextInput
                      value={seg.start}
                      onChangeText={(v) => updateSegment(seg.id, "start", v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={BRAND.muted}
                      style={styles.timeInput}
                    />
                  </View>
                  <View style={styles.timeField}>
                    <Muted>End (sec)</Muted>
                    <RNTextInput
                      value={seg.end}
                      onChangeText={(v) => updateSegment(seg.id, "end", v)}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 15"
                      placeholderTextColor={BRAND.muted}
                      style={styles.timeInput}
                    />
                  </View>
                </View>
              </Panel>
            ))}

            <Pressable onPress={addSegment} style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.7 }]}>
              <Plus color={BRAND.blue} size={18} />
              <Text style={styles.addText}>Add another clip</Text>
            </Pressable>

            <Pressable
              onPress={() => setAudioOnly(!audioOnly)}
              style={({ pressed }) => [styles.audioRow, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.checkbox, audioOnly && styles.checkboxOn]}>
                {audioOnly && <Text style={styles.checkMark}>{"\u2713"}</Text>}
              </View>
              <Text style={styles.audioLabel}>Save as audio only (MP3)</Text>
            </Pressable>

            {error && (
              <Panel style={[{ marginTop: 16 }, styles.errorPanel]}>
                <Text style={styles.errorText}>{error}</Text>
              </Panel>
            )}

            {phase.kind === "editing" ? (
              <Button title={`Render ${segments.length > 1 ? `${segments.length} clips` : "clip"}`} onPress={exportAll} style={{ marginTop: 20 }} />
            ) : (
              <Panel style={{ marginTop: 20 }}>
                <View style={styles.progressRow}>
                  <ActivityIndicator color={BRAND.green} size="small" />
                  <Text style={styles.uploadLabel}>{(phase as { label: string }).label}</Text>
                </View>
                <Muted style={{ marginTop: 8 }}>The server is cutting and encoding. Keep the app open.</Muted>
              </Panel>
            )}
          </>
        )}

        {phase.kind === "exported" && (
          <Panel style={{ marginTop: SPACING.section }}>
            <Text style={styles.doneTitle}>{phase.message}</Text>
            <Button
              title="Clip something else"
              variant="ghost"
              onPress={() => {
                setPhase({ kind: "pick" });
                setUrl("");
                setSegments([{ id: nextId++, start: "", end: "" }]);
                setAudioOnly(false);
                setError(null);
              }}
              style={{ marginTop: 14 }}
            />
          </Panel>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.midnight },
  content: {
    padding: SPACING.screen,
    paddingTop: 72,
    paddingBottom: 140,
  },
  h: { color: BRAND.white, fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginTop: 18 },
  p: { color: BRAND.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  section: {
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: SPACING.section,
  },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: BRAND.glassBorder },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sourceTitle: { color: BRAND.white, fontSize: 15, fontWeight: "600", flex: 1 },
  segHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  segLabel: { color: BRAND.green, fontSize: 14, fontWeight: "700" },
  removeBtn: { padding: 4 },
  timeRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  timeField: { flex: 1, gap: 6 },
  timeInput: {
    backgroundColor: "rgba(11,15,20,0.6)",
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
    borderRadius: 12,
    color: BRAND.white,
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, alignSelf: "flex-start" },
  addText: { color: BRAND.blue, fontSize: 15, fontWeight: "600" },
  audioRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: BRAND.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: BRAND.green, borderColor: BRAND.green },
  checkMark: { color: BRAND.greenText, fontSize: 14, fontWeight: "800" },
  audioLabel: { color: BRAND.white, fontSize: 15 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  uploadLabel: { color: BRAND.white, fontSize: 15, fontWeight: "600" },
  doneTitle: { color: BRAND.green, fontSize: 16, fontWeight: "700" },
  errorPanel: { backgroundColor: BRAND.dangerTint },
  errorText: { color: BRAND.danger, fontSize: 14, lineHeight: 20 },
});
