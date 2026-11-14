import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  AppTextInput,
  COLORS,
  CategoryPill,
  Chip,
  EmptyState,
  ErrorState,
  GhostButton,
  LoadingState,
  Panel,
  ScreenScroll,
  UI,
} from "@/lib/ui";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

export default function CrewScreen() {
  const router = useRouter();
  const { crewId, setCrewId } = useApp();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const items = trpc.crew.items.useQuery();
  const list = trpc.crew.list.useQuery({ includeArchived: true });

  const archivedIds = useMemo(
    () => new Set((list.data ?? []).filter((member) => member.archived).map((member) => member.id)),
    [list.data],
  );

  const filtered = (items.data ?? []).filter((item) => {
    if (!showArchived && archivedIds.has(item.profile.id)) return false;
    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    return (
      item.profile.displayName.toLowerCase().includes(query) ||
      item.profile.callSign.toLowerCase().includes(query) ||
      item.profile.role.toLowerCase().includes(query)
    );
  });

  return (
    <ScreenContainer>
      <ScreenScroll
        refreshControl={
          <RefreshControl
            refreshing={items.isFetching}
            onRefresh={() => {
              items.refetch();
              list.refetch();
            }}
            tintColor={COLORS.rose}
          />
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <View>
            <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "700" }}>Crew medical profiles</Text>
            <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, marginTop: 3 }}>
              {filtered.length} profile(s) · fictional records only
            </Text>
          </View>
          <GhostButton label="New" icon="add" onPress={() => router.push("/crew/new")} />
        </View>

        <AppTextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, call sign or role"
          accessibilityLabel="Search crew profiles"
        />
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Chip label="Active profiles" active={!showArchived} onPress={() => setShowArchived(false)} />
          <Chip label="Include archived" active={showArchived} onPress={() => setShowArchived(true)} />
        </View>

        {items.isLoading ? <LoadingState label="Loading crew profiles" /> : null}
        {items.isError ? <ErrorState message={items.error.message} onRetry={() => items.refetch()} /> : null}

        {!items.isLoading && filtered.length === 0 ? (
          <EmptyState
            icon="search-off"
            title="No profile matches"
            body="Change the search text, include archived profiles, or create a new fictional crew member."
            action={<GhostButton label="Create profile" onPress={() => router.push("/crew/new")} />}
          />
        ) : null}

        <View style={{ gap: 10 }}>
          {filtered.map((item) => {
            const archived = archivedIds.has(item.profile.id);
            const selected = item.profile.id === crewId;
            return (
              <View
                key={item.profile.id}
                style={{
                  backgroundColor: COLORS.panel,
                  borderRadius: UI.radius,
                  borderWidth: 1,
                  borderColor: selected ? `${COLORS.rose}88` : COLORS.border,
                  padding: 14,
                  gap: 6,
                  opacity: archived ? 0.65 : 1,
                }}
              >
                <Pressable
                  onPress={() => router.push(`/crew/${item.profile.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.profile.displayName}. ${item.headline}. Open profile.`}
                  style={{ gap: 6 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: UI.body, flex: 1 }}>
                      {item.profile.displayName}
                      <Text style={{ color: COLORS.textFaint, fontWeight: "500" }}> · {item.profile.callSign}</Text>
                    </Text>
                    <CategoryPill category={item.category} compact />
                  </View>
                  <Text style={{ color: COLORS.textMuted, fontSize: UI.small }} numberOfLines={2}>
                    {item.headline}
                  </Text>
                  <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
                    {item.profile.role} · {item.completeness.available}/{item.completeness.total} fields ·{" "}
                    {item.openCaseCount} open case(s)
                  </Text>
                  {item.dataGaps[0] ? (
                    <Text style={{ color: COLORS.moreData, fontSize: UI.tiny }} numberOfLines={1}>
                      Gap: {item.dataGaps[0]}
                    </Text>
                  ) : null}
                </Pressable>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                  <Pressable
                    onPress={() => setCrewId(item.profile.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.profile.displayName} as the current astronaut`}
                    hitSlop={8}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}
                  >
                    <MaterialIcons name={selected ? "check-circle" : "radio-button-unchecked"} size={15} color={COLORS.roseSoft} />
                    <Text style={{ color: COLORS.roseSoft, fontSize: UI.tiny, fontWeight: "600" }}>
                      {selected ? "Selected astronaut" : "Select astronaut"}
                    </Text>
                  </Pressable>
                  {archived ? (
                    <Text style={{ color: COLORS.moreData, fontSize: UI.tiny }}>archived</Text>
                  ) : null}
                  {item.streamLabel ? (
                    <Text style={{ color: COLORS.review, fontSize: UI.tiny }} numberOfLines={1}>
                      simulated stream
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScreenScroll>
    </ScreenContainer>
  );
}
