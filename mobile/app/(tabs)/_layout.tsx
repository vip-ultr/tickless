import { Tabs } from "expo-router";
import { Download, Scissors, Info, Menu } from "lucide-react-native";
import { BRAND } from "@/lib/brand";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND.green,
        tabBarInactiveTintColor: BRAND.muted,
        tabBarStyle: {
          backgroundColor: BRAND.midnightElevated,
          borderTopColor: BRAND.glassBorder,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Download",
          tabBarIcon: ({ color, size }) => <Download color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="clip"
        options={{
          title: "Clip",
          tabBarIcon: ({ color, size }) => <Scissors color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: "About",
          tabBarIcon: ({ color, size }) => <Info color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <Menu color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
