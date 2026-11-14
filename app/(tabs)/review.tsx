import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { CategoryLegend, DomainRow, GapList, StreamBanner } from "@/components/app-blocks";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  COLORS,
  CategoryPill,
  EmptyState,
  ErrorState,
  GhostButton,
  LoadingState,
  Panel,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import { CATEGORY_META, type Category } from "@/shared/constants";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

export default function ReviewScreen() {
  const router = useRouter();
  const { crewId } = useApp();
  const bundleQuery = trpc.assessment.forCrew.useQuery({ crewId: crewId ?? "" }, { enabled: Boolean(crewId) });
  const tableQuery = trpc.assessment.crewTable.useQuery();
  const casesQuery = trpc.cases.list.useQuery({ crewId: crewId ?? undefined }, { enabled: Boolean(crewId) });

  const bundle = bundleQuery.data;
  const counts = (tableQuery.data ?? []).reduce<Record<Category, number>>(
    (accumulator, row) => {
      accumulator[row.category] += 1;
      return accumulator;
    },
    { priority: 0, review: 0, more_data: 0, no_flags: 0 },
  );

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "700" }}>Explainable screening</Text>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, marginTop: 3 }}>
            One shared engine feeds the dashboard, assistant, tables, care support, cases and exports.
          </Text>
        </View>

        <Panel style={{ gap: 8 }}>
          <SectionTitle title="Crew-wide categories" hint="Sorted worst-first on the mission tab." />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["priority", "review", "more_data", "no_flags"] as Category[]).map((category) => (
              <View
                key={category}
                style={{
                  borderWidth: 1,
                  borderColor: `${CATEGORY_META[category].color}66`,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  minWidth: 78,
                }}
              >
                <Text style={{ color: CATEGORY_META[category].color, fontSize: 18, fontWeight: "700" }}>{counts[category]}</Text>
                <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>{CATEGORY_META[category].short}</Text>
              </View>
            ))}
          </View>
          <CategoryLegend />
          <GhostButton label="Open mission readiness table" icon="table-chart" onPress={() => router.push("/mission")} />
        </Panel>

        {!crewId ? (
          <EmptyState icon="person-search" title="Select a crew member" body="Choose an astronaut on the Overview tab to review their explainable screening." />
        ) : null}

        {bundleQuery.isLoading ? <LoadingState label="Evaluating screening rules" /> : null}
        {bundleQuery.isError ? <ErrorState message={bundleQuery.error.message} onRetry={() => bundleQuery.refetch()} /> : null}

        {bundle ? (
          <>
            <Panel style={{ gap: 8, borderColor: `${CATEGORY_META[bundle.overallCategory].color}66` }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: COLORS.roseSoft, fontSize: 11, letterSpacing: 1.4, fontWeight: "700", flex: 1 }}>
                  EXPLAINABLE ASSESSMENT
                </Text>
                <CategoryPill category={bundle.overallCategory} compact />
              </View>
              <Text style={{ color: COLORS.text, fontSize: 19, fontWeight: "700" }}>
                {bundle.nextStep?.title ?? "Routine monitoring"}
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 20 }}>
                {bundle.nextStep?.detail ?? "Continue monitoring."}
              </Text>
              <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                {bundle.crew.displayName} · {bundle.crew.callSign} · assessed {formatDateTime(bundle.assessedAt)}
              </Text>
              <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                {bundle.completeness.available} of {bundle.completeness.total} relevant fields available · rule set{" "}
                {bundle.ruleSetVersion}
              </Text>
            </Panel>
            <StreamBanner bundle={bundle} />

            <View style={{ gap: 8 }}>
              {bundle.domains.map((domain) => (
                <DomainRow key={domain.domain} domain={domain} onPress={() => router.push(`/assessment/${domain.domain}`)} />
              ))}
            </View>

            <Panel>
              <SectionTitle title="Data gaps" hint="Shown separately: unknown data never becomes a green result." />
              <GapList gaps={bundle.dataGaps} />
            </Panel>

            <Panel>
              <SectionTitle title="Open cases" hint="Dated timelines with evidence snapshots." />
              {(casesQuery.data ?? []).length === 0 ? (
                <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>No open case for this crew member.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {(casesQuery.data ?? []).slice(0, 4).map((record) => (
                    <GhostButton
                      key={record.id}
                      label={`${record.domainLabel} · ${CATEGORY_META[record.currentCategory].short} (${record.eventCount} events)`}
                      icon="folder-open"
                      onPress={() => router.push(`/cases/${record.id}`)}
                    />
                  ))}
                </View>
              )}
            </Panel>

            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <GhostButton label="Start useful check" icon="checklist" onPress={() => router.push(`/check/new?domain=${bundle.nextStep?.domain ?? "cardiovascular"}`)} />
              <GhostButton label="Ask the assistant" icon="chat-bubble-outline" onPress={() => router.push("/assistant")} />
              <GhostButton label="Prevention support" icon="medical-services" onPress={() => router.push(`/care/${bundle.nextStep?.domain ?? "cardiovascular"}`)} />
            </View>
          </>
        ) : null}
      </ScreenScroll>
    </ScreenContainer>
  );
}
