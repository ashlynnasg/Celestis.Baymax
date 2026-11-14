import { Category, CATEGORY_META, COLORS } from "@/shared/constants";
import ArrowIcon from "@expo/vector-icons/MaterialIcons";
import { isValidElement, ReactElement, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { useReducedMotion } from "@/lib/motion";

export { COLORS };

export const UI = {
  radius: 18,
  radiusSm: 12,
  gap: 12,
  screenPadding: 18,
  body: 15,
  small: 13,
  tiny: 12,
  title: 22,
};

export const cardStyle = {
  backgroundColor: COLORS.panel,
  borderRadius: UI.radius,
  borderWidth: 1,
  borderColor: COLORS.border,
  padding: 16,
};

export function Panel({
  children,
  style,
  soft,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  soft?: boolean;
}) {
  return (
    <View
      style={[
        cardStyle,
        soft ? { backgroundColor: COLORS.panelSoft, borderColor: COLORS.border } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Selectively bright reading area. All its text uses dedicated dark ink tokens;
 * existing dark Panel descendants retain their own light-on-dark palette.
 * Purely presentational; no application data or decisions are changed here.
 */
export function LightReadout({
  eyebrow,
  title,
  detail,
  accent = COLORS.teal,
  icon = "auto-awesome",
}: {
  eyebrow: string;
  title: string;
  detail: string;
  accent?: string;
  icon?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.lightSurface,
        borderColor: COLORS.lightBorder,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderLeftColor: accent,
        borderRadius: UI.radius,
        padding: 16,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <View style={{ backgroundColor: `${accent}22`, borderRadius: 9, padding: 7 }}>
          <ArrowIcon name={icon as never} color={COLORS.ink} size={17} />
        </View>
        <Text style={{ color: COLORS.inkMuted, fontSize: UI.tiny, fontWeight: "700", letterSpacing: 1.1, flex: 1 }}>
          {eyebrow.toUpperCase()}
        </Text>
      </View>
      <Text style={{ color: COLORS.ink, fontSize: UI.body + 2, fontWeight: "800", lineHeight: 23 }}>
        {title}
      </Text>
      <Text style={{ color: COLORS.inkMuted, fontSize: UI.small, lineHeight: 19 }}>
        {detail}
      </Text>
    </View>
  );
}

export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: COLORS.sky, width: 3, height: 17, borderRadius: 2 }} />
          <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "700", flexShrink: 1 }}>{title}</Text>
        </View>
        {hint ? (
          <Text style={{ color: COLORS.textFaint, fontSize: UI.small, marginTop: 3, lineHeight: 18 }}>{hint}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function CategoryPill({ category, compact }: { category: Category; compact?: boolean }) {
  const meta = CATEGORY_META[category];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: meta.color,
        backgroundColor: `${meta.color}1A`,
        gap: 6,
      }}
      accessibilityLabel={`Review category: ${meta.label}`}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.color }} />
      <Text style={{ color: meta.color, fontSize: compact ? UI.tiny : UI.small, fontWeight: "700" }}>
        {compact ? meta.short : meta.label}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  tone,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: string;
}) {
  const accent = tone ?? COLORS.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? accent : COLORS.border,
          backgroundColor: active ? `${accent}26` : COLORS.panelSoft,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={{ color: active ? COLORS.text : COLORS.textMuted, fontSize: UI.small, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  full?: boolean;
};

export function PrimaryButton({ label, onPress, disabled, loading, icon, full }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(inactive) }}
      style={({ pressed }) => [
        {
          backgroundColor: inactive ? COLORS.panelRaised : COLORS.primary,
          borderRadius: UI.radiusSm,
          paddingVertical: 13,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.85 : 1,
          alignSelf: full ? "stretch" : "flex-start",
          borderWidth: 1,
          borderColor: inactive ? COLORS.border : COLORS.primarySoft,
        },
      ]}
    >
      {loading ? <MotionSpinner color={COLORS.text} label={label} /> : null}
      {icon && !loading ? <ArrowIcon name={icon as never} size={17} color={COLORS.text} /> : null}
      <Text style={{ color: inactive ? COLORS.textFaint : COLORS.text, fontWeight: "700", fontSize: UI.body }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, disabled, loading, icon, full }: ButtonProps) {
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      style={({ pressed }) => [
        {
          borderColor: COLORS.borderStrong,
          borderWidth: 1,
          borderRadius: UI.radiusSm,
          paddingVertical: 11,
          paddingHorizontal: 15,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.75 : disabled ? 0.5 : 1,
          alignSelf: full ? "stretch" : "flex-start",
        },
      ]}
    >
      {loading ? <MotionSpinner color={COLORS.rose} label={label} /> : null}
      {icon && !loading ? <ArrowIcon name={icon as never} size={16} color={COLORS.roseSoft} /> : null}
      <Text style={{ color: COLORS.roseSoft, fontWeight: "600", fontSize: UI.small + 1 }}>{label}</Text>
    </Pressable>
  );
}

export function DangerButton({ label, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        borderColor: `${COLORS.priority}80`,
        borderWidth: 1,
        borderRadius: UI.radiusSm,
        paddingVertical: 11,
        paddingHorizontal: 15,
        opacity: pressed ? 0.75 : 1,
        alignItems: "center",
      })}
    >
      <Text style={{ color: COLORS.priority, fontWeight: "700", fontSize: UI.small + 1 }}>{label}</Text>
    </Pressable>
  );
}

export function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 }}>
      <Text style={{ color: COLORS.textFaint, fontSize: UI.small, flexShrink: 1 }}>{label}</Text>
      <Text
        style={{
          color: COLORS.textMuted,
          fontSize: UI.small,
          flexShrink: 1,
          textAlign: "right",
          fontVariant: mono ? ["tabular-nums"] : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 12 }} />;
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
}) {
  const color =
    tone === "danger" ? COLORS.priority : tone === "warning" ? COLORS.review : tone === "success" ? COLORS.noFlags : COLORS.primarySoft;
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: color,
        backgroundColor: COLORS.panelSoft,
        paddingVertical: 11,
        paddingHorizontal: 13,
        borderRadius: UI.radiusSm,
        gap: 4,
      }}
    >
      {title ? <Text style={{ color, fontWeight: "700", fontSize: UI.small }}>{title}</Text> : null}
      {isValidElement(children) ? (
        children
      ) : (
        <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 19 }}>{children}</Text>
      )}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon = "inbox",
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <Panel soft style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
      <ArrowIcon name={icon as never} size={26} color={COLORS.textFaint} />
      <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: UI.body, textAlign: "center" }}>{title}</Text>
      <Text style={{ color: COLORS.textMuted, fontSize: UI.small, textAlign: "center", lineHeight: 19 }}>{body}</Text>
      {action}
    </Panel>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Panel soft style={{ gap: 10 }}>
      <Text style={{ color: COLORS.priority, fontWeight: "700" }}>Something needs attention</Text>
      <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 19 }}>{message}</Text>
      {onRetry ? <GhostButton label="Try again" onPress={onRetry} icon="refresh" /> : null}
    </Panel>
  );
}

/** Spinner that becomes a static status label when the user prefers reduced motion. */
export function MotionSpinner({ color = COLORS.primarySoft, label = "Working" }: { color?: string; label?: string }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <Text accessibilityLiveRegion="polite" style={{ color: COLORS.textFaint, fontSize: UI.small }}>
        {label}…
      </Text>
    );
  }
  return <ActivityIndicator color={color} size="small" accessibilityLabel={label} />;
}

export function LoadingState({ label = "Loading demonstration data" }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 32, alignItems: "center", gap: 10 }}>
      <MotionSpinner label={label} />
      <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>{label}</Text>
    </View>
  );
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: COLORS.text, fontSize: UI.small, fontWeight: "700" }}>{children}</Text>
      {hint ? <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 18 }}>{hint}</Text> : null}
    </View>
  );
}

export function AppTextInput(props: TextInputProps & { invalid?: boolean }) {
  const { invalid, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={COLORS.inkMuted}
      selectionColor={COLORS.primary}
      accessibilityLabel={rest.accessibilityLabel ?? rest.placeholder}
      style={[
        {
          backgroundColor: COLORS.lightSurface,
          borderWidth: 1,
          borderColor: invalid ? COLORS.priority : COLORS.lightBorder,
          borderRadius: UI.radiusSm,
          color: COLORS.ink,
          paddingHorizontal: 12,
          paddingVertical: 11,
          fontSize: UI.body,
          minHeight: 46,
        },
        style,
      ]}
      {...rest}
    />
  );
}

export function ScreenScroll({
  children,
  contentStyle,
  refreshControl,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<React.ComponentProps<typeof import("react-native").RefreshControl>>;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        { paddingHorizontal: UI.screenPadding, paddingTop: 8, paddingBottom: 40, gap: 14 },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

export function KeyValueList({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((item) => (
        <View key={`${item.label}-${item.value}`} style={{ flexDirection: "row", gap: 10 }}>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.small, width: 116 }}>{item.label}</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small, flex: 1, lineHeight: 19 }}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
