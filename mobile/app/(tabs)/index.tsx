import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { extract } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { GlassCard, Input, Muted } from "@/components/ui/primitives";

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
      setState({ kind: "error", message: err.message ?? "Something went wrong." });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.wordmark}>
          <Text style={styles.white}>Tick</Text>
          <Text style={styles.green}>less</Text>
        </Text>
        <Muted>Save TikTok and Instagram videos without the watermark.</Muted>

        <GlassCard style={{ marginTop: 20 }}>
          <Input
            value={url}
            onChangeText={setUrl}
            placeholder="Paste a TikTok or Instagram link"
            placeholderTextColor={BRAND.muted}
            onSubmitEditing={onExtract}
            returnKeyType="go"
          />
          <Pressable
            onPress={onExtract}
            disabled={state.kind === "loading"}
            style={({ pressed }) => [
              styles.button,
              state.kind === "loading" && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {state.kind === "loading" ? (
              <ActivityIndicator color={BRAND.greenText} />
            ) : (
              <Text style={styles.buttonLabel}>Extract</Text>
            )}
          </Pressable>
        </GlassCard>

        {state.kind === "done" && (
          <GlassCard style={{ marginTop: 16 }}>
            <Text style={styles.title}>{state.data.title ?? "Untitled"}</Text>
            <Muted>{[state.data.author, state.data.platform].filter(Boolean).join(" - ")}</Muted>
            {/* M1: thumbnail + download buttons + save to gallery */}
          </GlassCard>
        )}

        {state.kind === "error" && (
          <GlassCard style={[{ marginTop: 16 }, styles.errorCard]}>
            <Text style={styles.errorText}>{state.message}</Text>
          </GlassCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.midnight },
  content: { padding: 20, paddingBottom: 40 },
  wordmark: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  white: { color: BRAND.white },
  green: { color: BRAND.green },
  title: { color: BRAND.white, fontSize: 16, fontWeight: "600", lineHeight: 22 },
  button: {
    marginTop: 12,
    backgroundColor: BRAND.green,
    borderRadius: 14,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonLabel: { color: BRAND.greenText, fontSize: 16, fontWeight: "700" },
  errorCard: { borderColor: "rgba(255,107,107,0.4)" },
  errorText: { color: BRAND.danger, fontSize: 14, lineHeight: 20 },
});
