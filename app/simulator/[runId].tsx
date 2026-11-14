import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { ComparisonChart, type SeriesPoint } from "@/components/charts/comparison-chart";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  COLORS,
  CategoryPill,
  Chip,
  ErrorState,
  GhostButton,
  LoadingState,
  Notice,
  Panel,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import { CATEGORY_META, METRICS, type MetricKey } from "@/shared/constants";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

const METRIC_CHOICES: MetricKey[] = ["heartRate", "oxygenSaturation", "sleepDuration", "fatigue", "stress", "exerciseDuration"];

export default function SimulatorRunScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const router = useRouter();
  const { refreshAll } = useApp();
  const utils = trpc.useUtils();
  const [day, setDay] = useState(7);
  const [metric, setMetric] = useState<MetricKey>("heartRate");

  const runQuery = trpc.simulator.get.useQuery({ runId: runId ?? "" }, { enabled: Boolean(runId) });
  const compare = trpc.simulator.compare.useQuery({ runId: runId ?? "", day }, { enabled: Boolean(runId) });
  const activate = trpc.simulator.activate.useMutation();
  const deactivate = trpc.simulator.deactivate.useMutation();

  const baselineSeries = useMemo<SeriesPoint[]>(() => {
    const observations = (compare.data?.baselineObservations ?? [])
      .filter((item) => item.metric === metric && item.numericValue !== null)
      .sort((left, right) => new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime());
    const tail = observations.slice(-7);
    return tail.map((item, index) => ({ dayIndex: index, value: item.numericValue as number, observedAt: item.observedAt }));
  }, [compare.data, metric]);

  const scenarioSeries = useMemo<SeriesPoint[]>(() => {
    const observations = (compare.data?.scenarioObservations ?? [])
      .filter((item) => item.metric === metric && item.numericValue !== null)
      .sort((left, right) => new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime());
    const daysSeen = Array.from(new Set(observations.map((item) => item.observedAt.slice(0, 10))));
    return observations.map((item) => ({
      dayIndex: daysSeen.indexOf(item.observedAt.slice(0, 10)),
      value: item.numericValue as number,
      observedAt: item.observedAt,
    }));
  }, [compare.data, metric]);

  if (runQuery.isLoading) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <LoadingState label="Loading simulation run" />
        </ScreenScroll>
      </ScreenContainer>
    );
  }
  if (runQuery.isError || !runQuery.data) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <ErrorState message={runQuery.error?.message ?? "Run not found."} onRetry={() => runQuery.refetch()} />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  const { run, active } = runQuery.data;

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <GhostButton label="Back" icon="arrow-back" onPress={() => router.back()} />
        </View>

        <Panel style={{ gap: 6 }}>
          <Text style={{ color: COLORS.textFaint, fontSize: 11, letterSpacing: 1, fontWeight: "700" }}>SIMULATION RUN</Text>
          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>{run.label}</Text>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
            {run.id} · seed {run.seed} · day 1 {formatDateTime(run.startDate)} · rule set {run.ruleSetVersion} ·{" "}
            {active ? "applied stream" : "not applied"}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <GhostButton
              label={active ? "Return to baseline" : "Apply this stream"}
              icon={active ? "undo" : "play-arrow"}
              onPress={async () => {
                if (active) await deactivate.mutateAsync();
                else await activate.mutateAsync({ runId: run.id });
                await utils.invalidate();
                runQuery.refetch();
                compare.refetch();
                refreshAll();
              }}
            />
            <GhostButton label="Open dashboard" icon="dashboard" onPress={() => router.push("/")} />
          </View>
        </Panel>

        <Panel style={{ gap: 10 }}>
          <SectionTitle title="Replay day" hint="The selected day is the assessment clock for this replay. Replay never changes stored records." />
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {Array.from({ length: run.dayCount }, (_, index) => index + 1).map((value) => (
              <Chip key={value} label={`Day ${value}`} active={day === value} onPress={() => setDay(value)} tone={COLORS.rose} />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <GhostButton label="Previous" icon="chevron-left" disabled={day <= 1} onPress={() => setDay((value) => Math.max(1, value - 1))} />
            <GhostButton
              label="Next"
              icon="chevron-right"
              disabled={day >= run.dayCount}
              onPress={() => setDay((value) => Math.min(run.dayCount, value + 1))}
            />
          </View>
          {compare.data ? (
            <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
              Replay clock: {compare.data.dayDate} · assessment time {formatDateTime(compare.data.dayDate)}
            </Text>
          ) : null}
        </Panel>

        {compare.isLoading ? <LoadingState label="Comparing baseline and scenario" /> : null}
        {compare.isError ? <ErrorState message={compare.error.message} onRetry={() => compare.refetch()} /> : null}

        {compare.data ? (
          <>
            <Panel style={{ gap: 10 }}>
              <SectionTitle title="Before and after" hint="Baseline (recorded) versus scenario (simulated), aligned by relative day." />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {METRIC_CHOICES.map((choice) => (
                  <Chip key={choice} label={METRICS[choice].shortLabel} active={choice === metric} onPress={() => setMetric(choice)} />
                ))}
              </View>
              <ComparisonChart baseline={baselineSeries} scenario={scenarioSeries} unit={METRICS[metric].unit} selectedDay={day} />
            </Panel>

            <Panel>
              <SectionTitle title="Category changes" hint="Only real category differences are listed." />
              {compare.data.categoryChanges.length === 0 ? (
                <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>
                  No category changed on day {day} compared with the baseline assessment.
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {compare.data.categoryChanges.map((change) => (
                    <View key={change.domain} style={{ gap: 3 }}>
                      <Text style={{ color: COLORS.text, fontSize: UI.small, fontWeight: "700" }}>{change.label}</Text>
                      <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
                        {CATEGORY_META[change.from].label} → {CATEGORY_META[change.to].label}
                      </Text>
                      <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 19 }}>{change.reason}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Panel>

            <Panel>
              <SectionTitle title="Domain comparison" hint="Baseline category versus replay category on the selected day." />
              <View style={{ gap: 8 }}>
                {compare.data.replayBundle.domains.map((domain) => {
                  const base = compare.data?.baselineBundle.domains.find((item) => item.domain === domain.domain);
                  return (
                    <View key={domain.domain} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: COLORS.textMuted, fontSize: UI.tiny, flex: 1 }}>{domain.label}</Text>
                      {base ? <CategoryPill category={base.category} compact /> : null}
                      <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>→</Text>
                      <CategoryPill category={domain.category} compact />
                    </View>
                  );
                })}
              </View>
            </Panel>

            <Notice tone="info" title="Read-only replay">
              {compare.data.note}
            </Notice>
          </>
        ) : null}

        <Panel>
          <SectionTitle title="Scenario assumptions" />
          {run.assumptions.map((assumption) => (
            <Text key={assumption} style={{ color: COLORS.textFaint, fontSize: 11, lineHeight: 15 }}>
              • {assumption}
            </Text>
          ))}
        </Panel>
      </ScreenScroll>
    </ScreenContainer>
  );
}
