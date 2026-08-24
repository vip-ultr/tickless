import { Text, TextInput, View, Pressable, StyleSheet, type StyleProp, type ViewStyle, type TextInputProps, type TextProps } from "react-native";
import { BRAND, RADIUS } from "@/lib/brand";

// Depth panel: translucent tint + soft shadow. No borders (anti-2015).
export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={BRAND.muted}
      autoCapitalize="none"
      autoCorrect={false}
      style={[styles.input, props.style]}
    />
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" ? styles.buttonPrimary : styles.buttonGhost,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          { color: variant === "primary" ? BRAND.greenText : BRAND.green },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Muted({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.muted, style]} />;
}

export function Wordmark({ size = 40 }: { size?: number }) {
  return (
    <Text style={{ fontSize: size, fontWeight: "800", letterSpacing: -size * 0.03, lineHeight: size * 1.15 }}>
      <Text style={{ color: BRAND.white }}>Tick</Text>
      <Text style={{ color: BRAND.green }}>less</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  panel: {
    // Web .glass recipe (globals.css line 72): LIGHT tint (over-tinting kills
    // the glass effect), 1px light border, inset top highlight = specular
    // pane edge, soft drop shadow for lift.
    backgroundColor: "rgba(140,160,190,0.08)", // --glass-tint equivalent
    borderRadius: RADIUS.panel,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(230,240,255,0.16)", // --glass-border
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    // inset top highlight
    ...({ borderTopColor: "rgba(255,255,255,0.25)" } as object),
  },
  input: {
    backgroundColor: "rgba(11,15,20,0.6)",
    borderRadius: RADIUS.input,
    color: BRAND.white,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  button: {
    borderRadius: RADIUS.button,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  buttonPrimary: {
    backgroundColor: BRAND.green,
    shadowColor: BRAND.green,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  buttonGhost: {
    backgroundColor: BRAND.greenDim,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  disabled: { opacity: 0.5 },
  buttonLabel: { fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  muted: { color: BRAND.muted, fontSize: 13, lineHeight: 19 },
});
