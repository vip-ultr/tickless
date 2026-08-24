import { View, Text, StyleSheet, ScrollView } from "react-native";
import { BRAND, SPACING } from "@/lib/brand";
import { Panel, Wordmark } from "@/components/ui/primitives";

// Clip tab: M2 placeholder with honest scope note (locked decision 10:
// online-only in v1).
export default function ClipScreen() {
  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Wordmark size={34} />
        <Text style={styles.h}>Clip</Text>
        <Text style={styles.p}>
          Cut any video into short clips, right here. Paste a link or pick a video from your phone, mark the parts you want, and export them as video or audio.
        </Text>

        <Panel style={{ marginTop: SPACING.section }}>
          <Text style={styles.soonTitle}>Arriving in the next update</Text>
          <Text style={styles.p2}>
            The clip editor needs one more app build before it works on your device. Everything else in Tickless is ready today.
          </Text>
        </Panel>

        <Panel style={{ marginTop: 16 }}>
          <Text style={styles.featTitle}>What it will do</Text>
          {[
            "Paste a TikTok or Instagram link, or choose a video from your phone",
            "Mark multiple start and end points on one timeline",
            "Export each cut as a video clip or audio-only file",
            "Saves straight to your Tickless album",
          ].map((line) => (
            <View key={line} style={styles.featRow}>
              <Text style={styles.bullet}>{"\u2022"}</Text>
              <Text style={styles.featLine}>{line}</Text>
            </View>
          ))}
        </Panel>
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
  p: { color: BRAND.muted, fontSize: 16, lineHeight: 23, marginTop: 8 },
  soonTitle: { color: BRAND.green, fontSize: 15, fontWeight: "700" },
  p2: { color: BRAND.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  featTitle: { color: BRAND.white, fontSize: 15, fontWeight: "700" },
  featRow: { flexDirection: "row", marginTop: 10 },
  bullet: { color: BRAND.blue, marginRight: 10, fontSize: 14 },
  featLine: { color: BRAND.muted, fontSize: 14, lineHeight: 21, flex: 1 },
});
