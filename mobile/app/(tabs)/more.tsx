import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { BRAND, SPACING } from "@/lib/brand";
import { Panel, Wordmark } from "@/components/ui/primitives";

// More tab: FAQ (verbatim from docs/content.md section 3) + Legal links +
// app info. Legal page screens arrive with M3 navigation.
const FAQ: [string, string][] = [
  ["Is Tickless free?", "Yes. There is no charge, no trial, and no card required. If ads appear later they are only there to cover server costs."],
  ["Do I need an account or an app?", "No. Tickless runs in your browser. There is nothing to sign up for and nothing to install."],
  ["How does the no-watermark part work?", "TikTok stores a clean version of every video on its own servers, which is the copy its app plays. Tickless fetches that clean version for you. Nothing is edited or re-recorded, so quality stays intact."],
  ["What links are supported?", "Full links like tiktok.com/@user/video/123, short links like vm.tiktok.com/xxxx, and links copied straight from the Share menu."],
  ["Can I download the audio only?", "Yes. When a video is ready you can choose to save just the audio as an MP3."],
  ["Do you store the videos I download?", "No. Tickless does not keep the videos or a record of what you download. The file goes from TikTok to your device."],
  ["Why is the first download sometimes slow?", "On the free server plan the backend sleeps after a quiet period and takes a few seconds to wake up. After that first request it is fast."],
  ["Is this legal?", "Tickless is a tool. Download content you own or have permission to use, and respect the rights of creators."],
];

export default function MoreScreen() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Wordmark size={34} />
        <Text style={styles.h}>More</Text>

        <Text style={styles.section}>Questions, answered.</Text>
        <Panel style={{ marginTop: 12, paddingVertical: 6 }}>
          {FAQ.map(([q, a], i) => (
            <View key={q}>
              <Pressable
                onPress={() => setOpen(open === i ? null : i)}
                style={({ pressed }) => [styles.qRow, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.q}>{q}</Text>
                <ChevronDown
                  color={BRAND.muted}
                  size={18}
                  style={{ transform: [{ rotate: open === i ? "180deg" : "0deg" }] }}
                />
              </Pressable>
              {open === i && <Text style={styles.a}>{a}</Text>}
              {i < FAQ.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </Panel>

        <Text style={styles.section}>Legal</Text>
        <Panel style={{ marginTop: 12, paddingVertical: 6 }}>
          {["Terms of Use", "Privacy", "Copyright"].map((l) => (
            <Pressable key={l} style={({ pressed }) => [styles.qRow, pressed && { opacity: 0.8 }]}>
              <Text style={[styles.q, { color: BRAND.green }]}>{l}</Text>
            </Pressable>
          ))}
        </Panel>

        <Text style={styles.section}>App</Text>
        <Panel style={{ marginTop: 12 }}>
          <Text style={styles.appLine}>Version 0.1.0 (development)</Text>
          <Text style={styles.appLine}>Downloads save to your Tickless album.</Text>
          <Text style={styles.appLine}>Made by Optivis Labs.</Text>
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
  section: {
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: SPACING.section,
  },
  qRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  q: { color: BRAND.white, fontSize: 15, fontWeight: "500", flex: 1, paddingRight: 10 },
  a: {
    color: BRAND.muted,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  divider: { height: 1, backgroundColor: BRAND.glassBorder, marginHorizontal: 16 },
  appLine: { color: BRAND.muted, fontSize: 14, lineHeight: 24 },
});
