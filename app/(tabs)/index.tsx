import { HazardPanel } from "@/components/science";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import {
  BodyMap,
  CategoryLegend,
  CrewSwitcher,
  DomainRow,
  GapList,
  NextStepCard,
  StreamBanner,
} from "@/components/app-blocks";
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
import { METRICS, type DomainKey, type MetricKey } from "@/shared/constants";
import { formatAge, formatDateTime } from "@/shared/format";
import type { MetricSnapshot } from "@/shared/domain";
import { trpc } from "@/lib/trpc";

const DASHBOARD_METRICS: MetricKey[] = [
  "heartRate",
  "oxygenSaturation",
  "sleepDuration",
  "stress",
  "exerciseDuration",
  "fatigue",
  "visionChange",
];

function metricAccent(metric: MetricKey): string {
  if (metric === "heartRate" || metric === "visionChange") return COLORS.coral;
  if (metric === "oxygenSaturation" || metric === "exerciseDuration") return COLORS.teal;
  if (metric === "sleepDuration" || metric === "fatigue") return COLORS.sky;
  return COLORS.primarySoft;
}

function VitalCard({
  snapshot,
  onPress,
}: {
  snapshot: MetricSnapshot;
  onPress: () => void;
}) {
  const definition = METRICS[snapshot.metric];
  const tone = snapshot.missing ? COLORS.moreData : snapshot.stale ? COLORS.review : COLORS.noFlags;
  const accent = metricAccent(snapshot.metric);
  const displayValue = snapshot.missing
    ? "Unknown"
    : snapshot.value && snapshot.unit && snapshot.value.includes(snapshot.unit)
      ? snapshot.value
      : `${snapshot.value ?? "—"}${snapshot.unit ? ` ${snapshot.unit}` : ""}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${definition.label}: ${displayValue}. ${
        snapshot.missing ? "No observation recorded" : (snapshot.sourceLabel ?? "source unknown")
      }. Record a value.`}
      style={({ pressed }) => ({
        flexBasis: "47%",
        flexGrow: 1,
        backgroundColor: COLORS.panelSoft,
        borderRadius: UI.radius,
        borderWidth: 1,
        borderColor: `${accent}55`,
        borderTopWidth: 3,
        borderTopColor: accent,
        padding: 12,
        gap: 3,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
        <Text style={{ color: COLORS.textFaint, fontSize: 11, flex: 1 }} numberOfLines={1}>
          {definition.label}
        </Text>
        <MaterialIcons name="add" size={15} color={COLORS.textFaint} />
      </View>
      <Text
        style={{
          color: snapshot.missing ? COLORS.moreData : COLORS.text,
          fontSize: 20,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={1}
      >
        {displayValue}
      </Text>
      <Text style={{ color: COLORS.textFaint, fontSize: 11, lineHeight: 15 }} numberOfLines={2}>
        {snapshot.observedAt ? formatDateTime(snapshot.observedAt) : "No observation recorded"}
      </Text>
      <Text style={{ color: tone, fontSize: 11, fontWeight: "700" }}>
        {snapshot.missing
          ? "not recorded"
          : snapshot.stale
            ? `stale · ${formatAge(snapshot.ageHours)}`
            : `fresh · ${formatAge(snapshot.ageHours)}`}
      </Text>
    </Pressable>
  );
}

export default function OverviewScreen() {
  const { crewId, crewList, setCrewId, activeStream, appliedMissionName, meta } = useApp();
  const router = useRouter();
  const bundleQuery = trpc.assessment.forCrew.useQuery(
    { crewId: crewId ?? "" },
    { enabled: Boolean(crewId) },
  );
  const bundle = bundleQuery.data;
  const metrics = useMemo(() => {
    if (!bundle) return [] as MetricSnapshot[];
    const map = new Map<MetricKey, MetricSnapshot>();
    bundle.domains.forEach((domain) => {
      domain.metrics.forEach((snapshot) => {
        if (!map.has(snapshot.metric)) map.set(snapshot.metric, snapshot);
      });
    });
    return DASHBOARD_METRICS.map((metric) => map.get(metric)).filter(
      (item): item is MetricSnapshot => Boolean(item),
    );
  }, [bundle]);

  if (!crewId) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: "700", marginTop: 12 }}>
            Celestial Baymax
          </Text>
          <Text style={{ color: COLORS.roseSoft, fontSize: UI.small, letterSpacing: 1.2, fontWeight: "700" }}>
            PREDICT. PREVENT. PROTECT. RECOVER.
          </Text>
          <EmptyState
            icon="groups"
            title="Select a crew member to begin"
            body="Six fictional crew profiles are available. Choose one to open the connected workflow: history, monitoring, screening, checks, prevention, mission review and delayed handover."
            action={
              <GhostButton label="Open crew list" onPress={() => router.push("/crew")} icon="arrow-forward" />
            }
          />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenScroll
        refreshControl={
          <RefreshControl
            refreshing={bundleQuery.isFetching}
            onRefresh={() => bundleQuery.refetch()}
            tintColor={COLORS.rose}
          />
        }
      >
        <Panel soft style={{ gap: 10, marginTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                borderWidth: 1.5,
                borderColor: COLORS.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${COLORS.primary}22`,
              }}
            >
              <Text style={{ color: COLORS.roseSoft, fontWeight: "700", fontSize: 15 }}>
                {(bundle?.crew.displayName ?? "?").slice(0, 1)}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: 17 }} numberOfLines={1}>
                {bundle?.crew.displayName ?? "Crew member"}
                <Text style={{ color: COLORS.textFaint, fontWeight: "500" }}>
                  {" "}
                  · {bundle?.crew.callSign ?? ""}
                </Text>
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: UI.small }} numberOfLines={1}>
                {bundle?.crew.role ?? "Role unknown"} · {bundle?.crew.age ?? "—"} y ·{" "}
                {appliedMissionName ?? "no mission applied"}
              </Text>
            </View>
            {bundle ? <CategoryPill category={bundle.overallCategory} compact /> : null}
          </View>
          <CrewSwitcher
            crewList={crewList.filter((member) => !member.archived)}
            selectedId={crewId}
            onSelect={setCrewId}
          />
          {bundle ? (
            <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
              {bundle.completeness.available} of {bundle.completeness.total} relevant fields available ·
              assessed {formatDateTime(bundle.assessedAt)}
            </Text>
          ) : null}
        </Panel>

        {bundleQuery.isLoading ? <LoadingState /> : null}
        {bundleQuery.isError ? (
          <ErrorState message={bundleQuery.error.message} onRetry={() => bundleQuery.refetch()} />
        ) : null}

        {bundle ? (
          <>
            <StreamBanner bundle={bundle} />
            <NextStepCard
              bundle={bundle}
              onStartCheck={() =>
                router.push(`/check/new?domain=${bundle.nextStep?.domain ?? "cardiovascular"}`)
              }
              onOpenCase={(caseId) => router.push(`/cases/${caseId}`)}
            />
            <HazardPanel report={bundle.spaceContext} />

            <View>
              <SectionTitle
                title="Recent monitoring"
                hint="Tap a card to record a value. Units, time, source and freshness stay visible."
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {metrics.map((snapshot) => (
                  <VitalCard
                    key={snapshot.metric}
                    snapshot={snapshot}
                    onPress={() => router.push(`/observation/new?metric=${snapshot.metric}`)}
                  />
                ))}
              </View>
            </View>

            <View>
              <SectionTitle
                title="Screening domains"
                hint="Eight demonstration screens share one engine and one rule set."
              />
              <View style={{ gap: 8 }}>
                {bundle.domains.map((domain) => (
                  <DomainRow
                    key={domain.domain}
                    domain={domain}
                    openCaseId={
                      bundle.nextStep?.domain === domain.domain ? bundle.nextStep.openCaseId : null
                    }
                    onPress={() => router.push(`/assessment/${domain.domain}`)}
                  />
                ))}
              </View>
            </View>

            <Panel>
              <SectionTitle
                title="Body map"
                hint="Navigation only. Choose a labelled region to open its evidence."
              />
              <BodyMap
                domains={bundle.domains}
                selectedDomain={bundle.nextStep?.domain ?? null}
                onSelect={(domain: DomainKey) => router.push(`/assessment/${domain}`)}
              />
            </Panel>

            <Panel>
              <SectionTitle title="Data gaps" hint="Gaps are reported separately from the review category." />
              <GapList gaps={bundle.dataGaps} />
              <View style={{ height: 10 }} />
              <CategoryLegend />
            </Panel>

            <Text style={{ color: COLORS.textFaint, fontSize: 11, lineHeight: 16 }}>
              Last assessment {bundle.assessedAt ? formatDateTime(bundle.assessedAt) : "unknown"} · timezone{" "}
              {bundle.timezoneLabel} · rule set {bundle.ruleSetVersion} · seed {meta?.seedVersion ?? "—"} · stream{" "}
              {activeStream?.label ?? "baseline"}. Celestial Baymax is a demonstration; it is not a medical device
              and does not transmit real messages.
            </Text>
          </>
        ) : null}
      </ScreenScroll>
    </ScreenContainer>
  );
}
