import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import { CategoryLegend, DomainRow, GapList, StreamBanner } from "@/components/app-blocks";
import { MetricChart, type ChartPoint } from "@/components/charts/metric-chart";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  COLORS,
  CategoryPill,
  Chip,
  DangerButton,
  ErrorState,
  GhostButton,
  KeyValueList,
  LoadingState,
  Notice,
  Panel,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import { METRICS, type MetricKey } from "@/shared/constants";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

const METRIC_CHOICES: MetricKey[] = ["heartRate", "oxygenSaturation", "sleepDuration", "fatigue", "stress", "exerciseDuration"];
const RANGES: { label: string; days: number | null }[] = [
  { label: "7 d", days: 7 },
  { label: "14 d", days: 14 },
  { label: "30 d", days: 30 },
  { label: "All", days: null },
];

export default function CrewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { setCrewId, crewId } = useApp();
  const [metric, setMetric] = useState<MetricKey>("heartRate");
  const [days, setDays] = useState<number | null>(14);

  const crewQuery = trpc.crew.get.useQuery({ id: id ?? "" }, { enabled: Boolean(id) });
  const bundleQuery = trpc.assessment.forCrew.useQuery({ crewId: id ?? "" }, { enabled: Boolean(id) });
  const series = trpc.assessment.series.useQuery({ crewId: id ?? "", metric, days }, { enabled: Boolean(id) });
  const archive = trpc.crew.archive.useMutation();
  const utils = trpc.useUtils();

  const crew = crewQuery.data;
  const bundle = bundleQuery.data;

  const points: ChartPoint[] = useMemo(() => {
    return (series.data ?? [])
      .filter((observation) => observation.numericValue !== null)
      .map((observation) => ({
        id: observation.id,
        value: observation.numericValue as number,
        label: METRICS[observation.metric].label,
        observedAt: observation.observedAt,
        sourceLabel: observation.sourceLabel,
        context: observation.context,
        unit: observation.unit || METRICS[observation.metric].unit,
      }));
  }, [series.data]);

  const confirmArchive = () => {
    if (!crew) return;
    Alert.alert(
      crew.archived ? "Restore profile?" : "Archive profile?",
      crew.archived
        ? "The profile becomes selectable again."
        : "Archived profiles stay in the database with their history but are hidden from crew-wide views until restored.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: crew.archived ? "Restore" : "Archive",
          style: crew.archived ? "default" : "destructive",
          onPress: async () => {
            await archive.mutateAsync({
              id: crew.id,
              archived: !crew.archived,
              reason: crew.archived ? "Restored by owner" : "Archived by owner from the profile screen",
            });
            await utils.crew.items.invalidate();
            await utils.crew.list.invalidate();
            crewQuery.refetch();
          },
        },
      ],
    );
  };

  if (!crew) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          {crewQuery.isLoading ? <LoadingState /> : <ErrorState message={crewQuery.error?.message ?? "Profile not found."} />}
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  const history = crew.history;

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <GhostButton label="Back" icon="arrow-back" onPress={() => router.back()} />
          <View style={{ flex: 1 }} />
          <GhostButton label="Edit" icon="edit" onPress={() => router.push(`/crew/${crew.id}/edit`)} />
        </View>

        <Panel style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: COLORS.text, fontSize: 21, fontWeight: "700", flex: 1 }}>{crew.displayName}</Text>
            {bundle ? <CategoryPill category={bundle.overallCategory} compact /> : null}
          </View>
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small }}>
            {crew.callSign} · {crew.role} · {crew.age} y · {crew.sexAtBirth} · {crew.heightCm} cm · {crew.weightKg} kg ·{" "}
            {crew.bloodType}
          </Text>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
            Record created {formatDateTime(crew.createdAt)} · updated {formatDateTime(crew.updatedAt)}
            {crew.archived ? " · archived" : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <GhostButton label={crewId === crew.id ? "Selected astronaut" : "Set as selected"} icon="check" onPress={() => setCrewId(crew.id)} />
            <GhostButton label="Add observation" icon="add" onPress={() => router.push(`/observation/new?metric=heartRate`)} />
            <GhostButton label="Cases" icon="folder-open" onPress={() => router.push(`/cases?crewId=${crew.id}`)} />
            <DangerButton label={crew.archived ? "Restore profile" : "Archive profile"} onPress={confirmArchive} />
          </View>
        </Panel>

        {bundle ? <StreamBanner bundle={bundle} /> : null}

        {bundle ? (
          <>
            <Panel>
              <SectionTitle title="Current review category" hint={bundle.nextStep?.detail} />
              <CategoryLegend />
            </Panel>

            <Panel>
              <SectionTitle title="Monitoring chart" hint="Switch metric and range. Gaps are shown as gaps, never as zeros." />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {METRIC_CHOICES.map((choice) => (
                  <Chip key={choice} label={METRICS[choice].shortLabel} active={choice === metric} onPress={() => setMetric(choice)} />
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {RANGES.map((range) => (
                  <Chip
                    key={range.label}
                    label={range.label}
                    active={days === range.days}
                    onPress={() => setDays(range.days)}
                    tone={COLORS.rose}
                  />
                ))}
              </View>
              <MetricChart
                points={points}
                unit={METRICS[metric].unit}
                baselineMean={bundle.baselines.find((item) => item.metric === metric)?.mean ?? null}
              />
              <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, marginTop: 6 }}>
                {METRICS[metric].description}
              </Text>
            </Panel>

            <Panel>
              <SectionTitle title="Screening summary" hint="Open any domain for the full explainable evidence." />
              <View style={{ gap: 8 }}>
                {bundle.domains.map((domain) => (
                  <DomainRow key={domain.domain} domain={domain} onPress={() => router.push(`/assessment/${domain.domain}`)} />
                ))}
              </View>
            </Panel>

            <Panel>
              <SectionTitle title="Data gaps" hint="Shown independently of the review category." />
              <GapList gaps={bundle.dataGaps} />
            </Panel>
          </>
        ) : null}

        <Panel>
          <SectionTitle title="Medical history" hint="Read-only summary. Edit the profile to change these values." />
          <KeyValueList
            items={[
              { label: "Missions", value: crew.missions.join("; ") || "None recorded" },
              { label: "Previous conditions", value: history.previousConditions.join("; ") || "None recorded" },
              { label: "Injuries / surgery", value: history.injuriesSurgeries.join("; ") || "None recorded" },
              {
                label: "Medications",
                value: history.medications.map((item) => `${item.name} (${item.dose})`).join("; ") || "None recorded",
              },
              { label: "Allergies", value: history.allergies.join("; ") || "None recorded" },
              {
                label: "Family history",
                value:
                  history.familyHistory
                    .map((item) => `${item.relationship}: ${item.condition} (${item.status})`)
                    .join("; ") || "Unknown",
              },
              {
                label: "Cardiovascular",
                value: `${history.cardiovascular.conditions.join("; ") || "No conditions recorded"} · hypertension: ${
                  history.cardiovascular.knownHypertension
                }`,
              },
              {
                label: "Bone & muscle",
                value: `density concern: ${history.boneMuscle.boneDensityConcern} · prior fracture: ${
                  history.boneMuscle.priorFracture
                } · muscle loss: ${history.boneMuscle.muscleLossConcern}`,
              },
              {
                label: "Sleep & wellbeing",
                value: `baseline: ${
                  history.sleepWellbeing.baselineSleepHours === null ? "unknown" : `${history.sleepWellbeing.baselineSleepHours} h`
                } · insomnia: ${history.sleepWellbeing.insomniaHistory} · anxiety: ${history.sleepWellbeing.anxietyHistory}`,
              },
              {
                label: "Vision",
                value: `corrective lenses: ${history.vision.correctiveLenses} · prior changes: ${history.vision.priorVisionChanges}`,
              },
              { label: "Respiratory", value: `asthma: ${history.respiratory.asthma}` },
              {
                label: "Mission history",
                value: `${history.missionHistory.previousConcerns.join("; ") || "No previous concerns"} · EVA hours: ${
                  history.missionHistory.evaHours ?? "unknown"
                }`,
              },
            ]}
          />
        </Panel>

        <Notice tone="warning" title="Demonstration record">
          These are fictional profiles. The app stores narrative history and manual or simulated observations; it does not
          ingest real medical records and is not certified for them.
        </Notice>
      </ScreenScroll>
    </ScreenContainer>
  );
}
