import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { Download, Scissors, Info, Menu } from "lucide-react-native";
import { BRAND } from "@/lib/brand";

// Late-2026 native language: floating tab bar. Detached pill, translucent
// over content scrolling beneath it, no hard top border.
// NOTE: BlurView (expo-blur) is intentionally NOT used yet - it needs a new
// native build to register its view manager and crashes dev clients built
// without it. Reintroduce after the next EAS build if wanted.
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND.green,
        tabBarInactiveTintColor: BRAND.muted,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 24,
          marginHorizontal: 48,
          height: 64,
          borderRadius: 32,
          borderTopWidth: 0,
          backgroundColor:
            Platform.OS === "android" ? "rgba(17,22,29,0.92)" : "rgba(17,22,29,0.85)",
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Download",
          tabBarIcon: ({ color, size }) => <Download color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="clip"
        options={{
          title: "Clip",
          tabBarIcon: ({ color, size }) => <Scissors color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: "About",
          tabBarIcon: ({ color, size }) => <Info color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <Menu color={color} size={size} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
