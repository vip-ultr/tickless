import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Link2, ShieldCheck, Zap, Music } from "lucide-react-native";
import { BRAND, SPACING } from "@/lib/brand";
import { Panel } from "@/components/ui/primitives";
import { Logo } from "@/components/Logo";

// "Why Tickless" feature strip for the Download tab idle state.
// Copy verbatim from docs/content.md section 2 (abridged to the 4 that fit mobile).
const FEATURES = [
  {
    icon: ShieldCheck,
    title: "No watermark",
    body: "The same clean file TikTok serves inside its own app.",
  },
  {
    icon: Zap,
    title: "Real HD",
    body: "When a high-resolution version exists, that is what you get.",
  },
  {
    icon: Link2,
    title: "Nothing to install",
    body: "You are already here. No accounts, no sign-up.",
  },
  {
    icon: Music,
    title: "Audio too",
    body: "Grab just the sound as an MP3 when that is all you need.",
  },
];

export function FeatureStrip() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Why Tickless</Text>
      <View style={styles.grid}>
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <Panel key={title} style={styles.card}>
            <Icon color={BRAND.green} size={20} strokeWidth={2} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </Panel>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: SPACING.section + 8 },
  heading: {
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 14,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47.5%", flexGrow: 1, padding: 16 },
  title: { color: BRAND.white, fontSize: 15, fontWeight: "700", marginTop: 10 },
  body: { color: BRAND.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
