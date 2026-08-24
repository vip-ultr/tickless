import { Text as RNText, TextInput as RNTextInput } from "react-native";

// Global font override: Geist for all Text; GeistMono for inputs once the
// fonts are loaded in app/_layout.tsx. Device font SIZE still scales
// (allowFontScaling untouched) - we only set the FAMILY (locked decision 5).
export function applyGlobalFont(family: string, monoFamily: string) {
  (RNText as unknown as { defaultProps?: unknown }).defaultProps = {
    style: { fontFamily: family },
  };
  (RNTextInput as unknown as { defaultProps?: unknown }).defaultProps = {
    style: { fontFamily: monoFamily },
  };
}
