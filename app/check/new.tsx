import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  AppTextInput,
  COLORS,
  Chip,
  ErrorState,
  FieldLabel,
  GhostButton,
  LoadingState,
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
  type HeartRateContext,
} from "@/shared/constants";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

const CONTEXTS: { value: HeartRateContext; label: string }[] = [
  { value: "rest", label: "At rest" },
  { value: "after_exercise", label: "After exercise" },
  { value: "unknown", label: "Not sure" },
];

function requestId(): string {
  return `chk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function GuidedCheckScreen() {
  const { domain: domainParam, metric: metricParam } = useLocalSearchParams<{
    domain?: string;
    metric?: string;
  }>();
  const router = useRouter();
  const { crewId } = useApp();
  const utils = trpc.useUtils();

  const [step, setStep] = useState<"intro" | "answer" | "unable" | "saved">(
    "intro",
  );
  const [checkId, setCheckId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [context, setContext] = useState<HeartRateContext>("rest");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{
    before: string;
    after: string;
    next: string;
  } | null>(null);
  const [requestKey] = useState(requestId);

  const nextQuery = trpc.checks.next.useQuery(
    { crewId: crewId ?? "" },
    { enabled: Boolean(crewId) },
  );
  const bundleQuery = trpc.assessment.forCrew.useQuery(
    { crewId: crewId ?? "" },
    { enabled: Boolean(crewId) },
  );
  const createCheck = trpc.checks.create.useMutation();
  const submitCheck = trpc.checks.submit.useMutation();
  const unableCheck = trpc.checks.unable.useMutation();

  const domainKey = (domainParam ??
    nextQuery.data?.bundle.nextStep?.domain ??
    "cardiovascular") as string;
  const bundle = bundleQuery.data;
  const domain =
    bundle?.domains.find((item) => item.domain === domainKey) ?? null;
  const metric = useMemo(() => {
    if (metricParam) return metricParam;
    return (
      domain?.nextCheck?.metric ?? domain?.metrics[0]?.metric ?? "heartRate"
    );
  }, [metricParam, domain]);

  const definition = METRICS[metric as keyof typeof METRICS];
  const check =
    nextQuery.data?.check && nextQuery.data.check.domain === domainKey
      ? nextQuery.data.check
      : null;

  const start = async () => {
    if (!crewId) return;
    setError(null);
    try {
      const created = await createCheck.mutateAsync({
        crewId,
        domain: domainKey,
        metric,
      });
      setCheckId(created.id);
      setStep("answer");
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "The check could not be prepared.",
      );
    }
  };

  const submit = async () => {
    if (!checkId) return;
    setError(null);
    const numeric =
      definition.kind === "choice" ? null : Number(value.replace(",", "."));
    if (
      definition.kind === "number" &&
      (value.trim() === "" || Number.isNaN(numeric))
    ) {
      setError(`Enter a ${definition.label.toLowerCase()} value.`);
      return;
    }
    if (definition.kind === "choice" && !choice) {
      setError("Choose the reported vision status.");
      return;
    }
    try {
      const result = await submitCheck.mutateAsync({
        checkId,
        numericValue: numeric,
        textValue: definition.kind === "choice" ? choice : null,
        context: definition.contexts ? context : null,
        note: note.trim() || null,
        observedAt: new Date().toISOString(),
        clientRequestId: requestKey,
      });
      setOutcome({
        before: CATEGORY_META[result.previousCategory].label,
        after: CATEGORY_META[result.category].label,
        next: result.nextStep?.title ?? "Continue routine monitoring",
      });
      setStep("saved");
      await utils.invalidate();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The check could not be saved.",
      );
    }
  };

  const markUnable = async () => {
    if (!checkId) return;
    setError(null);
    try {
      await unableCheck.mutateAsync({
        checkId,
        reason: reason.trim() || undefined,
      });
      setOutcome({
        before: "",
        after: "",
        next: "The value stays unknown and is not estimated.",
      });
      setStep("saved");
      await utils.invalidate();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The check could not be updated.",
      );
    }
  };

  if (!crewId) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <ErrorState message="Select a crew member before starting a guided check." />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  if (bundleQuery.isLoading || !bundle || !domain) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <LoadingState label="Preparing one useful check" />
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
            label="Close"
            icon="close"
            onPress={() => router.back()}
          />
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, flex: 1 }}>
            {bundle.crew.displayName} · {domain.label}
          </Text>
        </View>

        {domain.category === "priority" ? (
          <Notice tone="danger" title="If this is an emergency, act first">
            Chest pain, severe breathlessness, fainting, sudden vision loss or a
            fall with head impact needs the crew emergency procedure immediately
            — never a questionnaire.
            <View style={{ height: 8 }} />
            <GhostButton
              label="Open escalation guidance"
              icon="warning"
              onPress={() => router.push(`/care/${domainKey}`)}
            />
          </Notice>
        ) : null}

        {step === "intro" ? (
          <>
            <GhostButton
              label="Add schedule, activity or symptom context"
              icon="travel-explore"
              onPress={() => router.push("/mission-context?kind=context")}
            />
            <Panel style={{ gap: 8 }}>
              <Text
                style={{
                  color: COLORS.textFaint,
                  fontSize: UI.tiny,
                  letterSpacing: 1.2,
                  fontWeight: "700",
                }}
              >
                GUIDED CHECK · STEP 1 OF 2
              </Text>
              <Text
                style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}
              >
                {domain.nextCheck?.prompt ??
                  `Record ${definition.label.toLowerCase()}`}
              </Text>
              <Text
                style={{
                  color: COLORS.textMuted,
                  fontSize: UI.small,
                  lineHeight: 20,
                }}
              >
                {domain.nextCheck?.reason ??
                  `The ${domain.label.toLowerCase()} screen has a follow-up need for this measurement.`}
              </Text>
              <View style={{ marginTop: 4 }}>
                <Text
                  style={{
                    color: COLORS.textFaint,
                    fontSize: UI.tiny,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                  }}
                >
                  WHY THIS CHECK?
                </Text>
                <Text
                  style={{
                    color: COLORS.textMuted,
                    fontSize: UI.small,
                    lineHeight: 19,
                    marginTop: 4,
                  }}
                >
                  {domain.category === "more_data"
                    ? "A relevant field is missing or stale, so the screen cannot separate a normal result from an unmeasured one."
                    : "An active concern needs a follow-up value before the next demanding activity this week."}
                </Text>
              </View>
              <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
                Category now: {CATEGORY_META[domain.category].label} · rule set{" "}
                {bundle.ruleSetVersion}
              </Text>
              {check ? (
                <Text style={{ color: COLORS.roseSoft, fontSize: UI.tiny }}>
                  An open check already exists for this domain ({check.prompt}).
                </Text>
              ) : null}
            </Panel>

            {error ? (
              <Notice tone="danger" title="Cannot start">
                {error}
              </Notice>
            ) : null}

            <PrimaryButton
              label="Start this check"
              icon="play-arrow"
              onPress={start}
              loading={createCheck.isPending}
            />
            <GhostButton
              label="I cannot record this now"
              icon="block"
              onPress={() => setStep("unable")}
            />
          </>
        ) : null}

        {step === "answer" ? (
          <>
            <Panel style={{ gap: 12 }}>
              <Text
                style={{
                  color: COLORS.textFaint,
                  fontSize: UI.tiny,
                  letterSpacing: 1.2,
                  fontWeight: "700",
                }}
              >
                GUIDED CHECK · STEP 2 OF 2
              </Text>
              <SectionTitle
                title={definition.label}
                hint={definition.description}
              />
              {definition.kind === "number" ? (
                <View style={{ gap: 6 }}>
                  <FieldLabel
                    hint={`${definition.min}–${definition.max} ${definition.unit}`}
                  >
                    Value ({definition.unit})
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
                  />
                </View>
              ) : (
                <View style={{ gap: 6 }}>
                  <FieldLabel>Reported vision status</FieldLabel>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
                    {(definition.choices ?? []).map((option) => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        active={choice === option.value}
                        onPress={() => setChoice(option.value)}
                      />
                    ))}
                  </View>
                </View>
              )}
              {definition.contexts ? (
                <View style={{ gap: 6 }}>
                  <FieldLabel>Measurement context</FieldLabel>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
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
                <FieldLabel>Note (optional)</FieldLabel>
                <AppTextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Anything that changes how this value should be read"
                  multiline
                  style={{ minHeight: 60, textAlignVertical: "top" }}
                />
              </View>
              <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
                Recorded at {formatDateTime(new Date().toISOString())} · entered
                manually, not measured.
              </Text>
              {error ? (
                <Notice tone="danger" title="Cannot save">
                  {error}
                </Notice>
              ) : null}
              <PrimaryButton
                label="Save and reassess"
                icon="save"
                onPress={submit}
                loading={submitCheck.isPending}
              />
            </Panel>
            <GhostButton
              label="I cannot record this now"
              icon="block"
              onPress={() => setStep("unable")}
            />
          </>
        ) : null}

        {step === "unable" ? (
          <Panel style={{ gap: 10 }}>
            <SectionTitle
              title="Record that this check cannot be completed"
              hint="The field stays unknown. It is never estimated, and the concern stays visible."
            />
            <FieldLabel>Reason (optional)</FieldLabel>
            <AppTextInput
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. no working sensor, crew member asleep, equipment unavailable"
              multiline
              style={{ minHeight: 64, textAlignVertical: "top" }}
            />
            {error ? (
              <Notice tone="danger" title="Cannot save">
                {error}
              </Notice>
            ) : null}
            <GhostButton
              label="Save unavailable result"
              icon="save"
              onPress={markUnable}
            />
          </Panel>
        ) : null}

        {step === "saved" && outcome ? (
          <Panel style={{ gap: 8 }}>
            <SectionTitle title="Check resolved" />
            <Text
              style={{
                color: COLORS.textMuted,
                fontSize: UI.small,
                lineHeight: 20,
              }}
            >
              {outcome.before
                ? `Screening changed from ${outcome.before} to ${outcome.after}. ${outcome.next}`
                : outcome.next}
            </Text>
            <Text
              style={{
                color: COLORS.textFaint,
                fontSize: UI.tiny,
                lineHeight: 16,
              }}
            >
              The shared assessment, dashboard next step and the linked case
              were updated. A screening change does not assert clinical recovery
              or clearance.
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 6,
              }}
            >
              <GhostButton
                label="View evidence"
                icon="science"
                onPress={() => router.replace(`/assessment/${domainKey}`)}
              />
              <GhostButton
                label="Case timeline"
                icon="folder-open"
                onPress={() => router.replace("/cases")}
              />
              <GhostButton
                label="Done"
                icon="check"
                onPress={() => router.back()}
              />
            </View>
          </Panel>
        ) : null}
      </ScreenScroll>
    </ScreenContainer>
  );
}
