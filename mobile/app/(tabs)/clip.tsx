import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ClipScreen() {
  // M2: full clip editor (link or device upload, multi-segment, audio-only).
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.center}>
        <Text style={styles.h}>Clip</Text>
        <Text style={styles.p}>Coming in phase M2.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F14" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  h: { color: "#F4F7F2", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  p: { color: "#8B95A1", fontSize: 14 },
});
