import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
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

export default function CasesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ crewId?: string }>();
  const { crewId: selectedCrewId } = useApp();
  const [scope, setScope] = useState<"selected" | "all">(params.crewId ? "all" : "selected");
  const [includeArchived, setIncludeArchived] = useState(false);

  const crewFilter = scope === "selected" ? selectedCrewId ?? undefined : undefined;
  const query = trpc.cases.list.useQuery({ crewId: crewFilter, includeArchived });

  const cases = query.data ?? [];

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <GhostButton label="Back" icon="arrow-back" onPress={() => router.back()} />
        </View>
        <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "700" }}>Continuing case timelines</Text>
        <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>
          Dated events are appended only for real changes: new evidence, category changes, completed checks, queued handovers
          and received simulated replies. Merely opening a case adds nothing.
        </Text>

        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Chip label="Selected astronaut" active={scope === "selected"} onPress={() => setScope("selected")} />
          <Chip label="All crew" active={scope === "all"} onPress={() => setScope("all")} />
          <Chip label="Include archived" active={includeArchived} onPress={() => setIncludeArchived((value) => !value)} />
        </View>

        {query.isLoading ? <LoadingState label="Loading case timelines" /> : null}
        {query.isError ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} /> : null}
        {!query.isLoading && cases.length === 0 ? (
          <EmptyState
            icon="folder-off"
            title="No cases in this scope"
            body="A case opens automatically when a screening domain moves to Priority Review or Review Before Assignment for this stream."
          />
        ) : null}

        <View style={{ gap: 10 }}>
          {cases.map((record) => (
            <Pressable
              key={record.id}
              onPress={() => router.push(`/cases/${record.id}`)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                backgroundColor: pressed ? COLORS.panelRaised : COLORS.panel,
                borderRadius: UI.radius,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 14,
                gap: 6,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: UI.body, flex: 1 }} numberOfLines={2}>
                  {record.crewName} · {record.domainLabel}
                </Text>
                <CategoryPill category={record.currentCategory} compact />
              </View>
              <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
                {record.id} · opened {formatDateTime(record.openedAt)} · {record.eventCount} events ·{" "}
                {record.status}
              </Text>
              {record.streamId ? (
                <Text style={{ color: COLORS.review, fontSize: UI.tiny }}>simulated stream · {record.streamId}</Text>
              ) : null}
              <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
                {record.acknowledgedAt ? `acknowledged ${formatDateTime(record.acknowledgedAt)}` : "not acknowledged"}
                {record.handoverIds.length > 0 ? ` · ${record.handoverIds.length} handover(s)` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScreenScroll>
    </ScreenContainer>
  );
}
