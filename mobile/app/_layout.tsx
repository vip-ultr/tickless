import { useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { BRAND } from "@/lib/brand";
import { applyGlobalFont } from "@/components/ui/globalFont";
import { Toast, type ToastData } from "@/components/Toast";

// App-wide toast context so any screen can push a notification.
let pushToast: ((t: ToastData) => void) | null = null;
export function showToast(t: ToastData) {
  pushToast?.(t);
}

export default function RootLayout() {
  const [toast, setToast] = useState<ToastData | null>(null);
  pushToast = setToast;

  const [loaded] = useFonts({
    Geist: require("@/assets/fonts/Geist-Variable.ttf"),
    GeistMono: require("@/assets/fonts/GeistMono-Variable.ttf"),
  });

  if (loaded) applyGlobalFont("Geist", "GeistMono");

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: BRAND.midnight }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
      <Toast toast={toast} onDone={() => setToast(null)} />
    </SafeAreaProvider>
  );
}
