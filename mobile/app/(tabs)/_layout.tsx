import { View, Text, Pressable, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Download, Scissors, Info, Menu } from "lucide-react-native";
import { BRAND } from "@/lib/brand";
import { FONT } from "@/components/ui/fonts";
// Late-2026 tab bar: detached floating dock, icon + label, soft pill glow
// behind the ACTIVE item only. Inactive items stay quiet gray.
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
      <View style={[styles.pill, focused && styles.pillActive]}>
        <Icon color={focused ? BRAND.greenText : BRAND.muted} size={17} strokeWidth={2.2} />
        {focused && (
          <Text style={[styles.labelActive, { fontFamily: "Geist" }]}>{label}</Text>
        )}
      </View>
      {!focused && <Text style={[styles.labelIdle, { fontFamily: "Geist" }]}>{label}</Text>}
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
              // expo-router passes accessibility props; focused comes via state
              const focused = (props as { accessibilityState?: { selected?: boolean } }).accessibilityState?.selected ?? false;
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
    bottom: 20,
    left: 16,
    right: 16,
    height: 68,
    borderRadius: 34,
    borderTopWidth: 0,
    backgroundColor: "rgba(17,22,29,0.92)",
    elevation: 16,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: BRAND.greenDim,
    shadowColor: BRAND.green,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  labelActive: {
    color: BRAND.green,
    fontSize: 12,
    fontWeight: "700",
  },
  labelIdle: {
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
});
