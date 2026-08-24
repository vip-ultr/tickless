import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { CheckCircle2, AlertCircle } from "lucide-react-native";
import { BRAND } from "@/lib/brand";

export interface ToastData {
  kind: "success" | "error";
  message: string;
}

// Minimal in-app toast (locked decision 8: in-app notifications only).
// Renders at the top of the root layout; auto-dismisses after 3s.
export function Toast({ toast, onDone }: { toast: ToastData | null; onDone: () => void }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onDone());
    }, 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast?.message]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;

  const Icon = toast.kind === "success" ? CheckCircle2 : AlertCircle;
  const color = toast.kind === "success" ? BRAND.green : BRAND.danger;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY }] }]}>
      <View style={[styles.card, toast.kind === "error" && styles.errorCard]}>
        <Icon color={color} size={18} />
        <Text style={[styles.text, { color }]}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 54,
    backgroundColor: BRAND.midnightElevated,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    maxWidth: "90%",
  },
  errorCard: { borderColor: "rgba(255,107,107,0.35)" },
  text: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
});
