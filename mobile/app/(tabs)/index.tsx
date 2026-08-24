import { useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Image, Pressable } from "react-native";
import { extract } from "@/lib/api";
import { BRAND, SPACING } from "@/lib/brand";
import { Panel, Input, Button, Muted, Wordmark } from "@/components/ui/primitives";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; data: Awaited<ReturnType<typeof extract>> }
  | { kind: "error"; message: string };

export default function DownloadScreen() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onExtract() {
    if (!url.trim()) return;
    setState({ kind: "loading" });
    try {
      const data = await extract(url.trim());
      setState({ kind: "done", data });
    } catch (e: unknown) {
      const err = e as { message?: string };
      setState({ kind: "error", message: err.message ?? "Something went wrong on our side. Give it another try in a moment." });
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Wordmark />
        <Text style={styles.heroSub}>
          Save any TikTok without the watermark. Paste the link and the clean video lands on your device.
        </Text>

        <Panel style={{ marginTop: 32 }}>
          <Input
            value={url}
            onChangeText={setUrl}
            placeholder="Paste a TikTok or Instagram link"
            onSubmitEditing={onExtract}
            returnKeyType="go"
          />
          <Button
            title="Get video"
            onPress={onExtract}
            disabled={state.kind === "loading"}
            style={{ marginTop: 14 }}
          />
          {state.kind === "idle" && !url && (
            <Muted style={{ marginTop: 12 }}>
              Works with tiktok.com, vm.tiktok.com, instagram.com and short links.
            </Muted>
          )}
        </Panel>

        {state.kind === "loading" && <SkeletonCard />}

        {state.kind === "done" && <ResultCard data={state.data} />}

        {state.kind === "error" && (
          <Panel style={[{ marginTop: 20 }, styles.errorPanel]}>
            <Text style={styles.errorText}>{state.message}</Text>
          </Panel>
        )}
      </ScrollView>
    </View>
  );
}

function ResultCard({ data }: { data: Awaited<ReturnType<typeof extract>> }) {
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
      {/* M1 next iteration: real download buttons (video/audio/gallery) saving to the Tickless album */}
      <Text style={styles.soonNote}>Download buttons arrive in the next update.</Text>
    </Panel>
  );
}

function SkeletonCard() {
  return (
    <Panel style={{ marginTop: 20 }}>
      <View style={[styles.skeletonBlock, styles.skeletonThumb]} />
      <View style={[styles.skeletonBlock, { width: "80%", height: 16, marginTop: 16 }]} />
      <View style={[styles.skeletonBlock, { width: "45%", height: 12, marginTop: 10 }]} />
      <Muted style={{ marginTop: 16 }}>Reading the video...</Muted>
    </Panel>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.midnight },
  content: {
    padding: SPACING.screen,
    paddingTop: 72,
    paddingBottom: 140,
  },
  heroSub: {
    color: BRAND.muted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 320,
  },
  thumb: {
    width: "100%",
    height: 190,
    borderRadius: 18,
    marginBottom: 14,
    backgroundColor: BRAND.midnightElevated,
  },
  title: { color: BRAND.white, fontSize: 17, fontWeight: "600", lineHeight: 23 },
  soonNote: { color: BRAND.blue, fontSize: 13, marginTop: 14 },
  skeletonBlock: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
  },
  skeletonThumb: { width: "100%", height: 160 },
  errorPanel: { backgroundColor: BRAND.dangerTint },
  errorText: { color: BRAND.danger, fontSize: 14, lineHeight: 20 },
});
