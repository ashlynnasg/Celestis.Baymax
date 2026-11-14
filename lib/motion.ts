import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Tracks the platform "Reduce Motion" accessibility setting.
 *
 * Celestial Baymax ships without looping or transform animations, so the only motion in the
 * interface is the loading spinner. Screens and primitives use this hook to replace that spinner
 * with a static status label when the user asks for reduced motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {
        /* Platforms without the query keep the default. */
      });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduced(value);
    });
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}
