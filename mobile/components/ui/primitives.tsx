import { useState } from "react";
import { View, Text, TextInput, StyleSheet, type StyleProp, type ViewStyle, type TextInputProps } from "react-native";
import { BRAND } from "@/lib/brand";

export function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Input(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      placeholderTextColor={BRAND.muted}
      style={[styles.input, { borderColor: focused ? BRAND.green : BRAND.glassBorder }, props.style]}
    />
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.glassTint,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
    borderRadius: 18,
    padding: 16,
  },
  input: {
    backgroundColor: BRAND.midnightElevated,
    borderWidth: 1,
    borderRadius: 14,
    color: BRAND.white,
    fontSize: 15,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  muted: { color: BRAND.muted, fontSize: 13, lineHeight: 19 },
});
