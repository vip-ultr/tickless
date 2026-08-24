import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BRAND } from "@/lib/brand";

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: BRAND.midnight }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          // transparent stack screens so content scrolls edge-to-edge under
          // the OS chrome; each screen owns its own background
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
