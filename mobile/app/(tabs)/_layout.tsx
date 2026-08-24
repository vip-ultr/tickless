import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Download, Scissors, Info, Menu } from "lucide-react-native";
import { BRAND } from "@/lib/brand";
import { FONT } from "@/components/ui/fonts";

// Floating glass dock - the web app's nav translated to native.
// Web recipe (globals.css .glass-strong): heavy blur + saturate, LIGHT tint,
// 1px light border (0.16 white), inset top highlight (specular pane edge),
// soft drop shadow, rounded-2xl (16px).
//
// OS-nav control: we measure the device bottom inset ourselves via
// useSafeAreaInsets and place the dock at inset.bottom + 10. It can NEVER
// go below the system gesture bar on any device because its position is
// derived from that exact value.
const INSET_GAP = 10;

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
          <Icon color={BRAND.greenText} size={15} strokeWidth={2.4} />
          <Text style={[styles.labelActive, { fontFamily: FONT }]}>{label}</Text>
        </View>
      ) : (
        <>
          <Icon color={BRAND.muted} size={18} strokeWidth={2} />
          <Text style={[styles.labelIdle, { fontFamily: FONT }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          // Controlled by the real OS inset: dock bottom edge sits just above
          // the gesture bar on every device.
          bottom: Math.max(insets.bottom, 12) + INSET_GAP,
          left: 20,
          right: 20,
          height: 68,
          borderRadius: 16, // web rounded-2xl
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.25)", // web --glass-highlight
          backgroundColor: "rgba(17,22,29,0.72)",
          overflow: "hidden",
          elevation: 0,
          shadowColor: "#000",
          shadowOpacity: 0.45,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 12 },
        },
        tabBarBackground: () => (
          // .glass-strong: blur(64px)+saturate(160%) equivalent; expo-blur
          // intensity maps ~0-100. Light experimental tint so content bleeds
          // through like true glass instead of a flat overlay.
          <BlurView
            intensity={70}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
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
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12, // web rounded-2xl scale for the smaller pill
  },
  pillActive: {
    backgroundColor: BRAND.greenDim,
    borderWidth: 1,
    borderColor: "rgba(167,233,84,0.35)",
  },
  labelActive: {
    color: BRAND.green,
    fontSize: 11,
    fontWeight: "700",
  },
  labelIdle: {
    color: BRAND.muted,
    fontSize: 10,
    fontWeight: "500",
  },
});
