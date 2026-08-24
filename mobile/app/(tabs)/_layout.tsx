import { View, Text, Pressable, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Download, Scissors, Info, Menu } from "lucide-react-native";
import { BRAND } from "@/lib/brand";
import { FONT } from "@/components/ui/fonts";

// Research-backed tab bar (X/Instagram/Telegram pattern):
// - Bar is a FULL-width translucent layer anchored to the very bottom edge,
//   with its height INCLUDING the gesture inset (safe area). Content scrolls
//   behind it. This is exactly how X handles Android gesture nav.
// - Icons+labels are vertically centered within the bar's CONTENT area
//   (above the inset), so nothing gets clipped by the pill shape.
// - No floating dock: the "dock" look was clipping icons and overflowing.

const ICONS = {
  index: Download,
  clip: Scissors,
  about: Info,
  more: Menu,
} as const;

function TabItem({
  name,
  label,
  focused,
  onPress,
}: {
  name: keyof typeof ICONS;
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  const Icon = ICONS[name];
  return (
    <Pressable onPress={onPress} style={styles.item}>
      <Icon color={focused ? BRAND.green : BRAND.muted} size={20} strokeWidth={focused ? 2.4 : 2} />
      <Text
        style={[
          focused ? styles.labelActive : styles.labelIdle,
          { fontFamily: FONT },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          // full-bleed glass layer; the bar itself spans edge to edge
          <View style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(11,15,20,0.85)" }]} />
          </View>
        ),
      }}
    >
      {([
        ["index", "Download"],
        ["clip", "Clip"],
        ["about", "About"],
        ["more", "More"],
      ] as const).map(([name, label]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            tabBarButton: (props) => {
              const focused =
                (props as { accessibilityState?: { selected?: boolean } }).accessibilityState
                  ?.selected ?? false;
              return (
                <TabItem
                  name={name}
                  label={label}
                  focused={focused}
                  onPress={props.onPress as () => void}
                />
              );
            },
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Full-width bar pinned to the bottom; React Navigation adds the device
  // safe-area inset automatically for non-absolute bars. Height is the icon
  // area only - the inset is added on top of this.
  tabBar: {
    backgroundColor: "rgba(11,15,20,0.88)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    height: 60,
    elevation: 0,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  labelActive: {
    color: BRAND.green,
    fontSize: 11,
    fontWeight: "700",
  },
  labelIdle: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontWeight: "500",
  },
});
