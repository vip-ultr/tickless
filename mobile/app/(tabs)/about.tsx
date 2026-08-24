import { View, Text, StyleSheet, ScrollView } from "react-native";
import { BRAND, SPACING } from "@/lib/brand";
import { Panel, Wordmark } from "@/components/ui/primitives";

// About tab: verbatim locked copy from docs/content.md section 4.
export default function AboutScreen() {
  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Wordmark size={34} />
        <Text style={styles.h}>About Tickless</Text>

        <Text style={styles.body}>
          Tickless started with a simple annoyance: saving a TikTok meant getting a video stamped with a watermark, or handing your link to a sketchy site covered in pop-ups. We wanted the clean file and nothing else.
        </Text>
        <Text style={styles.body}>
          So Tickless does one thing and does it well. You paste a link, you get the video the way it was meant to look, and we do not ask for your email or keep a log of what you saved.
        </Text>
        <Text style={styles.body}>
          It is built to grow. TikTok is the first platform. Support for more is planned under the same roof, so one tool covers the places you actually post and watch.
        </Text>

        <Panel style={{ marginTop: SPACING.section }}>
          <Text style={styles.sub}>Who builds this</Text>
          <Text style={styles.body2}>
            Tickless is built by Optivis Labs, an independent software studio that ships real products, not demos.
          </Text>
        </Panel>

        <Text style={styles.foot}>
          The clean way to save TikTok videos.{"\n"}(c) 2026 Tickless by Optivis Labs. Not affiliated with TikTok or ByteDance.
        </Text>
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
  body: {
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 16,
  },
  sub: { color: BRAND.green, fontSize: 15, fontWeight: "700" },
  body2: { color: BRAND.muted, fontSize: 14, lineHeight: 22, marginTop: 8 },
  foot: {
    color: BRAND.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: SPACING.section,
    textAlign: "center",
    opacity: 0.7,
  },
});
