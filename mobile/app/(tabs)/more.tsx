import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MoreScreen() {
  // M3: FAQ, Legal (Terms/Privacy/Copyright/DMCA), app info.
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h}>More</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F14" },
  content: { padding: 20 },
  h: { color: "#F4F7F2", fontSize: 24, fontWeight: "700" },
});
