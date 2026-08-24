import Svg, { Rect, Path } from "react-native-svg";
import { BRAND } from "@/lib/brand";

// App logo: matches the web favicon - rounded midnight square with the
// stylised "T" tick mark in brand green. Used in headers and empty states.
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect width="64" height="64" rx="16" fill={BRAND.midnightElevated} />
      {/* Stylised T whose right arm doubles as a checkmark sweep */}
      <Path
        d="M14 18 H50 L46 26 H36 V50 H28 V26 H14 Z"
        fill={BRAND.green}
      />
      <Path
        d="M40 40 L47 47 L58 34"
        stroke={BRAND.blue}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
