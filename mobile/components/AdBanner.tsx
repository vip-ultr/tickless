import { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, Pressable, Linking } from "react-native";
import { BRAND } from "@/lib/brand";
import { API_URL } from "@/lib/config";

interface Ad {
  id: string;
  title: string;
  link_url: string;
  image_url: string | null;
  image_url_mobile?: string | null;
}

// Native ad banner. Reuses the web's /api/ads endpoint and slot semantics:
// empty result renders NOTHING (zero footprint), same as web AdSlot rule.
export function AdBanner({ slot, style }: { slot: "leaderboard" | "in_content" | "result"; style?: object }) {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/ads?slot=${slot}`);
        if (!res.ok) return;
        const list = (await res.json()) as Ad[];
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          // pick a random active ad like the web does
          setAd(list[Math.floor(Math.random() * list.length)]);
        }
      } catch {
        // ads must never break the app
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slot]);

  if (!ad) return null;

  const imageUri = ad.image_url_mobile ?? ad.image_url;
  if (!imageUri) return null;

  return (
    <Pressable onPress={() => Linking.openURL(ad.link_url).catch(() => {})} style={[styles.wrap, style]}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      {/* badge needs pointer-events none on web; native Pressable children are fine */}
      <Text style={styles.badge}>Ad</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
  },
  image: { width: "100%", height: 90 },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    color: BRAND.muted,
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "rgba(11,15,20,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
});
