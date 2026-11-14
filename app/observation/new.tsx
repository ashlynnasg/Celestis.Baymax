import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  AppTextInput,
  COLORS,
  Chip,
  ErrorState,
  FieldLabel,
  GhostButton,
  Notice,
  Panel,
  PrimaryButton,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import {
  CATEGORY_META,
  METRICS,
  METRIC_KEYS,
  type HeartRateContext,
  type MetricKey,
} from "@/shared/constants";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

const CONTEXTS: { value: HeartRateContext; label: string }[] = [
  { value: "rest", label: "At rest" },
  { value: "after_exercise", label: "After exercise" },
  { value: "unknown", label: "Unknown / not sure" },
];

const PRESETS: { label: string; minutesAgo: number }[] = [
  { label: "Now", minutesAgo: 0 },
  { label: "6 h ago", minutesAgo: 360 },
  { label: "1 day ago", minutesAgo: 1440 },
  { label: "3 days ago", minutesAgo: 4320 },
];

function clientId(): string {
  return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function NewObservationScreen() {
  const params = useLocalSearchParams<{ metric?: string }>();
  const router = useRouter();
  const { crewId, crewName } = useApp();
  const utils = trpc.useUtils();

  const [metric, setMetric] = useState<MetricKey>(
    (params.metric as MetricKey) ?? "heartRate",
  );
  const [value, setValue] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [context, setContext] = useState<HeartRateContext>("rest");
  const [observedAt, setObservedAt] = useState(new Date().toISOString());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requestId] = useState(clientId);

  const definition = METRICS[metric];
  const create = trpc.observation.create.useMutation();

  const needsContext = useMemo(
    () => Boolean(definition.contexts),
    [definition],
  );

  const submit = async () => {
    if (!crewId) return;
    setError(null);
    const numeric =
      definition.kind === "choice" ? null : Number(value.replace(",", "."));
    if (
      definition.kind === "number" &&
      (value.trim() === "" || Number.isNaN(numeric))
    ) {
      setError(
        `Enter a ${definition.label.toLowerCase()} value in ${definition.unit}.`,
      );
      return;
    }
    if (definition.kind === "choice" && !choice) {
      setError("Choose the reported vision status.");
      return;
    }
    if (Number.isNaN(Date.parse(observedAt))) {
      setError("The observation time is not a valid date.");
      return;
    }
    try {
      const result = await create.mutateAsync({
        crewId,
        metric,
        numericValue: numeric,
        textValue: definition.kind === "choice" ? choice : null,
        context: needsContext ? context : null,
        observedAt,
        note: note.trim() ? note.trim() : null,
        clientRequestId: requestId,
      });
      await utils.invalidate();
      Alert.alert(
        "Observation saved",
        `Screening changed from ${CATEGORY_META[result.previousCategory].label} to ${
          CATEGORY_META[result.category].label
        }.\n\n${result.nextStep?.title ?? "Continue routine monitoring"}`,
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The observation could not be saved.",
      );
    }
  };

  if (!crewId) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <ErrorState message="Select a crew member before recording an observation." />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          <GhostButton
            label="Cancel"
            icon="close"
            onPress={() => router.back()}
          />
          <Text
            style={{
              color: COLORS.text,
              fontWeight: "700",
              fontSize: UI.body,
              flex: 1,
            }}
          >
            {crewName}
          </Text>
        </View>

        <Notice title="Add context when useful">
          Sleep quality, schedule, activity type and symptom history can be
          recorded separately for this crew, mission and stream. They complement
          the vital-sign record.
        </Notice>
        <GhostButton
          label="Record mission / observation context"
          icon="travel-explore"
          onPress={() => router.push("/mission-context?kind=context")}
        />
        <Panel style={{ gap: 12 }}>
          <SectionTitle
            title="Record an observation"
            hint="Manual entries are records, not measurements. Nothing is measured automatically."
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {METRIC_KEYS.map((key) => (
              <Chip
                key={key}
                label={METRICS[key].shortLabel}
                active={key === metric}
                onPress={() => {
                  setMetric(key);
                  setValue("");
                  setChoice(null);
                  setError(null);
                }}
              />
            ))}
          </View>

          <Text
            style={{
              color: COLORS.textFaint,
              fontSize: UI.tiny,
              lineHeight: 17,
            }}
          >
            {definition.description}
          </Text>

          {definition.kind === "number" ? (
            <View style={{ gap: 6 }}>
              <FieldLabel
                hint={`Supported range ${definition.min}–${definition.max} ${definition.unit}`}
              >
                {`${definition.label} (${definition.unit})`}
              </FieldLabel>
              <AppTextInput
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder={
                  definition.step && definition.step < 1
                    ? "e.g. 7.2"
                    : "e.g. 74"
                }
                invalid={Boolean(error)}
              />
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <FieldLabel>Reported vision status</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {(definition.choices ?? []).map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={choice === option.value}
                    onPress={() => setChoice(option.value)}
                  />
                ))}
              </View>
              <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
                An unanswered field is not the same as &quot;no vision change
                reported&quot;.
              </Text>
            </View>
          )}

          {needsContext ? (
            <View style={{ gap: 6 }}>
              <FieldLabel hint="Rest and post-exercise values are never compared without explaining the limitation.">
                Measurement context
              </FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {CONTEXTS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={context === option.value}
                    onPress={() => setContext(option.value)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 6 }}>
            <FieldLabel hint="Stored in UTC with the timezone shown wherever it is displayed.">
              Observation time
            </FieldLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {PRESETS.map((preset) => (
                <Chip
                  key={preset.label}
                  label={preset.label}
                  onPress={() =>
                    setObservedAt(
                      new Date(
                        Date.now() - preset.minutesAgo * 60_000,
                      ).toISOString(),
                    )
                  }
                />
              ))}
            </View>
            <AppTextInput
              value={observedAt}
              onChangeText={setObservedAt}
              placeholder="2026-11-10T07:30:00.000Z"
            />
            <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
              {Number.isNaN(Date.parse(observedAt))
                ? "Invalid timestamp"
                : `UTC: ${formatDateTime(observedAt)}`}
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <FieldLabel>Note (optional)</FieldLabel>
            <AppTextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. measured before exercise, felt light-headed"
              multiline
              style={{ minHeight: 64, textAlignVertical: "top" }}
            />
          </View>

          {error ? (
            <Notice tone="danger" title="Cannot save">
              {error}
            </Notice>
          ) : null}

          <PrimaryButton
            label="Save observation"
            onPress={submit}
            loading={create.isPending}
            icon="save"
          />
          <Text
            style={{
              color: COLORS.textFaint,
              fontSize: UI.tiny,
              lineHeight: 16,
            }}
          >
            Saving recalculates the shared assessment, the dashboard next step
            and any linked case. Repeated submissions of the same entry are
            ignored rather than duplicated.
          </Text>
        </Panel>
      </ScreenScroll>
    </ScreenContainer>
  );
}
