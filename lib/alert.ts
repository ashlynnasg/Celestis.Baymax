import { Alert as NativeAlert, Platform } from "react-native";

type AlertButton = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

/**
 * React Native Web turns `Alert.alert` into a no-op, which silently drops confirmations for
 * destructive actions. This wrapper keeps the native dialog on iOS/Android and uses the browser's
 * own confirm/alert on web, so archive, reset, apply and discard callbacks always run.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== "web") {
      NativeAlert.alert(title, message, buttons);
      return;
    }
    if (typeof window === "undefined") return;
    const body = message ? `${title}\n\n${message}` : title;
    const hasCancel = Boolean(buttons?.some((button) => button.style === "cancel"));
    const confirm = buttons?.find((button) => button.style !== "cancel") ?? buttons?.[0];
    if (hasCancel) {
      if (window.confirm(body)) confirm?.onPress?.();
      return;
    }
    window.alert(body);
    confirm?.onPress?.();
  },
};
