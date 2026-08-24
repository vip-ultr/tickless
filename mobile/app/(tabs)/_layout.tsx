import { View, Text, Pressable, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Download, Scissors, Info, Menu } from "lucide-react-native";
import { BRAND } from "@/lib/brand";

// Late-2026 tab bar: detached floating dock with REAL glass (BlurView,
// supported since dev-client build #6), icon + label, green pill behind the
// active item. The dock floats ABOVE the system gesture area - it never
// stretches under the device nav buttons.
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
      {focused ? (
        <View style={[styles.pill, styles.pillActive]}>
          <Icon color={BRAND.greenText} size={16} strokeWidth={2.4} />
          <Text style={[styles.labelActive, { fontFamily: "Geist" }]}>{label}</Text>
        </View>
      ) : (
        <>
          <Icon color={BRAND.muted} size={19} strokeWidth={2} />
          <Text style={[styles.labelIdle, { fontFamily: "Geist" }]}>{label}</Text>
        </>
      )}
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
        tabBarActiveTintColor: BRAND.green,
        tabBarInactiveTintColor: BRAND.muted,
        // Real glass: blur clipped to the dock shape
        tabBarBackground: () => (
          <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
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
  tabBar: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 32,
    borderTopWidth: 0,
    backgroundColor: "rgba(17,22,29,0.60)",
    overflow: "hidden",
    elevation: 0,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: BRAND.greenDim,
    borderWidth: 1,
    borderColor: "rgba(167,233,84,0.35)",
  },
  labelActive: {
    color: BRAND.green,
    fontSize: 12,
    fontWeight: "700",
  },
  labelIdle: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontWeight: "500",
  },
});

