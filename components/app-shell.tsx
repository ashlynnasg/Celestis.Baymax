import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useApp } from "@/lib/app-context";
import { COLORS, UI } from "@/lib/ui";

/**
 * Always-visible context: the selected astronaut, the active stream and the applied mission.
 * It sits above the tab navigator so every screen inherits the same reading of the record.
 */
export function ContextBar() {
  const router = useRouter();
  const { crewId, crewList, activeStream, appliedMissionName } = useApp();
  const selected = crewList.find((member) => member.id === crewId) ?? null;
  const streamLabel = activeStream ? `Simulated · ${activeStream.label}` : "Baseline stream";
  return (
    <Pressable
      onPress={() => router.push("/crew")}
      accessibilityRole="button"
      accessibilityLabel={`Current context: ${selected?.displayName ?? "no astronaut selected"}, ${streamLabel}, ${
        appliedMissionName ?? "no mission applied"
      }. Open crew list.`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 1.5,
          borderColor: COLORS.primarySoft,
          backgroundColor: `${COLORS.primary}33`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: COLORS.roseSoft,
          }}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: COLORS.text,
            fontSize: UI.small,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          {selected ? `${selected.displayName} · ${selected.callSign}` : "No astronaut selected"}
        </Text>
        <Text style={{ color: COLORS.textFaint, fontSize: 11 }} numberOfLines={1}>
          {streamLabel} · {appliedMissionName ?? "No mission applied"}
        </Text>
      </View>
      <MaterialIcons name="unfold-more" size={18} color={COLORS.textFaint} />
    </Pressable>
  );
}
