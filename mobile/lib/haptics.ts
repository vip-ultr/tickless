import * as Haptics from "expo-haptics";

// Small premium-feel details: light tap on presses, success notification on
// saves, error on failures. All fire-and-forget; never block the action.
export function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function error() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
