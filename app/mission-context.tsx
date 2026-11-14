import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { HazardPanel } from "@/components/science";
import { useApp } from "@/lib/app-context";
import { trpc } from "@/lib/trpc";
import { pickTextFile, shareTextFile } from "@/lib/files";
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
import type { AssessmentBundle } from "@/shared/domain";
import {
  GRAVITY,
  PHASES,
  logSummary,
  missionLogInputSchema,
} from "@/shared/mission-context";
import { formatDateTime } from "@/shared/format";

const human = (s: string) => s.replace(/_/g, " ");
type Tab = "coverage" | "context" | "radiation" | "cabin" | "import";
function Options({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {choices.map((v) => (
          <Chip
            key={v}
            label={human(v)}
            active={value === v}
            onPress={() => onChange(v)}
          />
        ))}
      </View>
    </View>
  );
}
export default function MissionContextScreen() {
  const router = useRouter();
  const { crewId } = useApp();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const query = trpc.assessment.forCrew.useQuery(
    { crewId: crewId ?? "" },
    { enabled: Boolean(crewId) },
  );
  if (!crewId || query.isError)
    return (
      <ScreenContainer>
        <ScreenScroll>
          <GhostButton label="Back" onPress={() => router.back()} />
          <ErrorState
            message={
              query.error?.message ?? "Choose a crew member on Overview first."
            }
          />
        </ScreenScroll>
      </ScreenContainer>
    );
  if (!query.data)
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  const bundle = query.data;
  return (
    <ContextWorkspace
      key={`${crewId}-${bundle.stream?.id ?? "baseline"}-${bundle.mission?.id ?? "none"}-${kind ?? "coverage"}`}
      bundle={bundle}
      initialTab={kind}
    />
  );
}
function ContextWorkspace({
  bundle,
  initialTab,
}: {
  bundle: AssessmentBundle;
  initialTab?: string;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>(
    ["context", "radiation", "cabin", "import"].includes(initialTab ?? "")
      ? (initialTab as Tab)
      : "coverage",
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [observedAt, setObservedAt] = useState(new Date().toISOString());
  const [sourceLabel, setSourceLabel] = useState("Fictional mission check-in");
  const [sourceRef, setSourceRef] = useState("");
  const [sourceKind, setSourceKind] = useState<"manual" | "simulated">(
    "simulated",
  );
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState("unknown");
  const [gravity, setGravity] = useState("unknown");
  const [location, setLocation] = useState("");
  const [sleepQuality, setSleepQuality] = useState("unknown");
  const [scheduleChanged, setScheduleChanged] = useState("unknown");
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [exerciseType, setExerciseType] = useState("");
  const [completed, setCompleted] = useState("unknown");
  const [symptom, setSymptom] = useState("");
  const [symptomOnset, setSymptomOnset] = useState("");
  const [symptomChange, setSymptomChange] = useState("unknown");
  const [startAt, setStartAt] = useState(
    new Date(Date.now() - 3600_000).toISOString(),
  );
  const [quantity, setQuantity] = useState("dose_equivalent");
  const [unit, setUnit] = useState("mSv");
  const [value, setValue] = useState("");
  const [component, setComponent] = useState("unknown");
  const [scope, setScope] = useState("unknown");
  const [instrument, setInstrument] = useState("");
  const [temperature, setTemperature] = useState("");
  const [pressure, setPressure] = useState("");
  const [co2, setCo2] = useState("");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [content, setContent] = useState("");
  const [sourceTitle, setSourceTitle] = useState("Fictional exposure example");
  const [fileRef, setFileRef] = useState("");
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof utils.client.evidence.preview.mutate>
  > | null>(null);
  const saveMutation = trpc.evidence.record.useMutation();
  const previewMutation = trpc.evidence.preview.useMutation();
  const commitMutation = trpc.evidence.commit.useMutation();
  const history = trpc.evidence.history.useQuery({ crewId: bundle.crew.id });
  const contextData = {
    kind: "context",
    phase,
    gravity,
    location,
    sleepQuality,
    scheduleChanged,
    bedtime: bedtime.trim() || null,
    wakeTime: wakeTime.trim() || null,
    exerciseType,
    plannedSessionCompleted: completed,
    symptom,
    symptomOnset: symptomOnset.trim() || null,
    symptomChange,
  };
  const num = (s: string) => (s.trim() ? Number(s) : null);
  const field = (
    label: string,
    current: string,
    setter: (s: string) => void,
    hint?: string,
    numeric = false,
  ) => (
    <View style={{ gap: 5 }}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <AppTextInput
        value={current}
        onChangeText={setter}
        placeholder={numeric ? "Blank = unknown" : label}
        keyboardType={numeric ? "decimal-pad" : "default"}
      />
    </View>
  );
  const importPayload = {
    crewId: bundle.crew.id,
    text: content,
    format,
    sourceTitle,
    sourceRef: fileRef,
  };
  const onError = (e: unknown) =>
    setError(
      e instanceof Error ? e.message : "Could not complete this action.",
    );
  const save = async () => {
    setError(null);
    setMessage(null);
    const data =
      tab === "radiation"
        ? {
            kind: "radiation",
            startAt,
            quantity,
            value: num(value),
            unit,
            component,
            scope,
            location,
            instrument,
          }
        : tab === "cabin"
          ? {
              kind: "cabin",
              location,
              temperatureC: num(temperature),
              pressureKpa: num(pressure),
              co2Ppm: num(co2),
            }
          : contextData;
    const parsed = missionLogInputSchema.safeParse({
      crewId: bundle.crew.id,
      observedAt,
      sourceKind,
      sourceLabel,
      sourceRef,
      note,
      data,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("\n"),
      );
      return;
    }
    try {
      const result = await saveMutation.mutateAsync(parsed.data);
      setMessage(
        `${result.insertedCount} record saved; ${result.duplicateCount} duplicate skipped. Coverage and related case notes updated. Review category is unchanged by context alone.`,
      );
      await utils.invalidate();
    } catch (e) {
      onError(e);
    }
  };
  const example = () => {
    const end = new Date().toISOString();
    const start = new Date(Date.now() - 3600_000).toISOString();
    setFormat("csv");
    setSourceTitle("Fictional radiation demonstration");
    setFileRef("Synthetic example; no CSA/CANS measurements");
    setContent(
      `crewId,kind,observedAt,sourceKind,startAt,quantity,value,unit,component,scope,location,instrument\n${bundle.crew.id},radiation,${end},simulated,${start},dose_equivalent,0.02,mSv,neutron,area,Demo habitat,Fictional instrument`,
    );
    setPreview(null);
    setMessage(null);
  };
  const pickFile = async () => {
    try {
      const file = await pickTextFile();
      if (!file) return;
      setContent(file.text);
      setFormat(file.name.endsWith(".json") ? "json" : "csv");
      setSourceTitle(file.name);
      setFileRef(`Selected file: ${file.name}`);
      setPreview(null);
    } catch (e) {
      onError(e);
    }
  };
  return (
    <ScreenContainer>
      <ScreenScroll>
        <GhostButton
          label="Back"
          icon="arrow-back"
          onPress={() => router.back()}
        />
        <Text style={{ color: COLORS.text, fontSize: 24, fontWeight: "700" }}>
          Mission context & radiation
        </Text>
        <Panel soft style={{ gap: 6 }}>
          <Text
            style={{ color: COLORS.text, fontSize: UI.body, fontWeight: "700" }}
          >
            {bundle.crew.displayName}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small }}>
            {bundle.mission?.name ?? "No applied mission"} ·{" "}
            {bundle.stream?.label ?? "Baseline stream"}
          </Text>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>
            Records belong to this crew, mission and stream. Earlier records are
            preserved; another stream never supplies current coverage.
          </Text>
        </Panel>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          accessibilityLabel="Mission context sections"
        >
          {(
            ["coverage", "context", "radiation", "cabin", "import"] as Tab[]
          ).map((key) => (
            <Chip
              key={key}
              label={key === "import" ? "Import" : human(key)}
              active={tab === key}
              onPress={() => {
                setTab(key);
                setError(null);
                setMessage(null);
              }}
            />
          ))}
        </ScrollView>
        {error ? <ErrorState message={error} /> : null}
        {message ? (
          <Notice tone="success" title="Saved">
            {message}
          </Notice>
        ) : null}
        {tab === "coverage" ? (
          <>
            <HazardPanel report={bundle.spaceContext} />
            <Panel style={{ gap: 9 }}>
              <SectionTitle
                title="Useful contextual follow-ups"
                hint="These supplement, and never delay, priority medical review."
              />
              {bundle.spaceContext.workflowChecks.map((c, i) => (
                <View key={`${c.title}-${i}`} style={{ gap: 5 }}>
                  <Text
                    style={{
                      color: COLORS.text,
                      fontSize: UI.body,
                      fontWeight: "600",
                    }}
                  >
                    {c.title}
                  </Text>
                  <Text
                    style={{
                      color: COLORS.textMuted,
                      fontSize: UI.small,
                      lineHeight: 20,
                    }}
                  >
                    {c.reason}
                  </Text>
                  <GhostButton
                    label={`Record ${c.kind}`}
                    onPress={() => setTab(c.kind)}
                  />
                </View>
              ))}
              <GhostButton
                label="Deep Space Link"
                onPress={() => router.push("/link")}
                icon="settings-input-antenna"
              />
            </Panel>
          </>
        ) : null}
        {["context", "radiation", "cabin"].includes(tab) ? (
          <>
            {tab === "context" ? (
              <Panel style={{ gap: 13 }}>
                <SectionTitle
                  title="Observation context"
                  hint="Optional reports; not diagnostic instruments or NASA's study protocol."
                />
                <Options
                  label="Mission phase"
                  value={phase}
                  choices={PHASES}
                  onChange={setPhase}
                />
                <Options
                  label="Gravity context"
                  value={gravity}
                  choices={GRAVITY}
                  onChange={setGravity}
                />
                {field("Location / activity context", location, setLocation)}
                <Options
                  label="Reported sleep quality"
                  value={sleepQuality}
                  choices={["unknown", "good", "fair", "poor"]}
                  onChange={setSleepQuality}
                />
                <Options
                  label="Recent schedule change?"
                  value={scheduleChanged}
                  choices={["unknown", "yes", "no"]}
                  onChange={setScheduleChanged}
                />
                {field(
                  "Bedtime (optional ISO time)",
                  bedtime,
                  setBedtime,
                  "Include timezone; blank remains unknown.",
                )}
                {field("Wake time (optional ISO time)", wakeTime, setWakeTime)}
                {field(
                  "Exercise type (optional)",
                  exerciseType,
                  setExerciseType,
                )}
                <Options
                  label="Planned exercise completed?"
                  value={completed}
                  choices={["unknown", "yes", "no"]}
                  onChange={setCompleted}
                />
                {field(
                  "Reported symptom / change (optional)",
                  symptom,
                  setSymptom,
                )}
                {field(
                  "Symptom onset (optional ISO time)",
                  symptomOnset,
                  setSymptomOnset,
                )}
                <Options
                  label="Reported symptom change"
                  value={symptomChange}
                  choices={[
                    "unknown",
                    "new",
                    "ongoing",
                    "improving",
                    "resolved",
                  ]}
                  onChange={setSymptomChange}
                />
              </Panel>
            ) : null}
            {tab === "radiation" ? (
              <Panel style={{ gap: 13 }}>
                <SectionTitle
                  title="Exposure record"
                  hint="Recorded or simulated only. The software does not measure radiation."
                />
                <Notice title="Preserve measurement meaning">
                  Area measurements are not automatically personal exposure.
                  Absorbed dose and dose equivalent remain separate. No
                  quantities are converted or summed, and no safe limit, cancer
                  probability or clinical category is calculated.
                </Notice>
                {field("Exposure start (ISO time)", startAt, setStartAt)}
                <Options
                  label="Reported quantity"
                  value={quantity}
                  choices={["absorbed_dose", "dose_equivalent"]}
                  onChange={(v) => {
                    setQuantity(v);
                    setUnit(v === "absorbed_dose" ? "mGy" : "mSv");
                  }}
                />
                {field(
                  "Recorded value",
                  value,
                  setValue,
                  "Use the source value. A blank is unknown, not zero.",
                  true,
                )}
                <Options
                  label="Original unit"
                  value={unit}
                  choices={
                    quantity === "absorbed_dose"
                      ? ["Gy", "mGy", "uGy"]
                      : ["Sv", "mSv", "uSv"]
                  }
                  onChange={setUnit}
                />
                <Options
                  label="Radiation component"
                  value={component}
                  choices={["unknown", "neutron", "mixed"]}
                  onChange={setComponent}
                />
                <Options
                  label="Measurement scope"
                  value={scope}
                  choices={["unknown", "personal", "area"]}
                  onChange={setScope}
                />
                {field("Location", location, setLocation)}
                {field(
                  "Instrument / method, if supplied",
                  instrument,
                  setInstrument,
                )}
              </Panel>
            ) : null}
            {tab === "cabin" ? (
              <Panel style={{ gap: 13 }}>
                <SectionTitle
                  title="Cabin conditions"
                  hint="Separate from blood oxygen saturation. No safety alarm thresholds are implemented."
                />
                {field("Cabin / location", location, setLocation)}
                {field(
                  "Temperature (°C)",
                  temperature,
                  setTemperature,
                  undefined,
                  true,
                )}
                {field(
                  "Pressure (kPa)",
                  pressure,
                  setPressure,
                  undefined,
                  true,
                )}
                {field("Carbon dioxide (ppm)", co2, setCo2, undefined, true)}
              </Panel>
            ) : null}
            <Panel style={{ gap: 12 }}>
              <SectionTitle title="Time and provenance" />
              {field(
                tab === "radiation"
                  ? "Exposure end / observation time (ISO)"
                  : "Observation time (ISO)",
                observedAt,
                setObservedAt,
                "Use a timezone, e.g. 2026-11-14T10:00:00Z. Original time determines freshness.",
              )}
              <Options
                label="Record origin"
                value={sourceKind}
                choices={["simulated", "manual"]}
                onChange={(v) => setSourceKind(v as "manual" | "simulated")}
              />
              {field("Source label", sourceLabel, setSourceLabel)}
              {field(
                "Source reference / file (optional)",
                sourceRef,
                setSourceRef,
              )}
              {field("Notes (optional)", note, setNote)}
              <PrimaryButton
                label="Save evidence record"
                icon="save"
                loading={saveMutation.isPending}
                onPress={save}
              />
            </Panel>
          </>
        ) : null}
        {tab === "import" ? (
          <Panel style={{ gap: 12 }}>
            <SectionTitle
              title="Exposure / context / cabin adapter"
              hint="Explicit flat CSV/JSON schema. Preview first; all valid rows commit together."
            />
            <Notice title="Different from the vital-sign importer">
              Each row names kind, observedAt and the relevant fields documented
              in examples/README.md. Crew ID, if supplied, must match this
              astronaut. Unsupported columns, ambiguous times and incompatible
              units are errors. A reference webpage is not a measurement table.
            </Notice>
            {field("Source title", sourceTitle, (s) => {
              setSourceTitle(s);
              setPreview(null);
            })}
            {field("Source file / reference", fileRef, (s) => {
              setFileRef(s);
              setPreview(null);
            })}
            <Options
              label="Format"
              value={format}
              choices={["csv", "json"]}
              onChange={(s) => {
                setFormat(s as "csv" | "json");
                setPreview(null);
              }}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <GhostButton
                label="Choose file"
                onPress={pickFile}
                icon="attach-file"
              />
              <GhostButton
                label="Load simulated example"
                onPress={example}
                icon="science"
              />
            </View>
            <AppTextInput
              multiline
              value={content}
              onChangeText={(s) => {
                setContent(s);
                setPreview(null);
              }}
              placeholder="Paste flat CSV or JSON array"
              style={{ minHeight: 150, textAlignVertical: "top" }}
            />
            <PrimaryButton
              label="Preview and validate"
              loading={previewMutation.isPending}
              onPress={async () => {
                setError(null);
                setMessage(null);
                try {
                  setPreview(await previewMutation.mutateAsync(importPayload));
                } catch (e) {
                  onError(e);
                  setPreview(null);
                }
              }}
            />
            {preview ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: COLORS.text, fontSize: UI.body }}>
                  {preview.records.length} valid · {preview.errors.length}{" "}
                  errors · {preview.missionName} / {preview.streamLabel}
                </Text>
                {preview.errors.slice(0, 12).map((e, i) => (
                  <Text
                    key={i}
                    style={{ color: COLORS.priority, fontSize: UI.small }}
                  >
                    Row {e.row}: {e.message}
                  </Text>
                ))}
                {preview.records.slice(0, 8).map((r, i) => (
                  <Text
                    key={i}
                    style={{ color: COLORS.textMuted, fontSize: UI.small }}
                  >
                    {r.data.kind} · {r.observedAt} · {r.sourceKind} ·{" "}
                    {r.sourceLabel}
                  </Text>
                ))}
                <GhostButton
                  label="Download full validation report"
                  onPress={() =>
                    shareTextFile(
                      "mission-import-validation.json",
                      JSON.stringify(preview, null, 2),
                      "application/json",
                    ).catch(onError)
                  }
                />
                <PrimaryButton
                  label="Commit validated batch"
                  disabled={
                    preview.errors.length > 0 || !preview.records.length
                  }
                  loading={commitMutation.isPending}
                  onPress={async () => {
                    setError(null);
                    try {
                      const r = await commitMutation.mutateAsync({
                        ...importPayload,
                        fingerprint: preview.fingerprint,
                      });
                      setMessage(
                        `${r.insertedCount} imported; ${r.duplicateCount} duplicates skipped.`,
                      );
                      setPreview(null);
                      await utils.invalidate();
                    } catch (e) {
                      onError(e);
                    }
                  }}
                />
              </View>
            ) : null}
          </Panel>
        ) : null}
        <Panel style={{ gap: 10 }}>
          <SectionTitle
            title="Evidence history"
            hint="Selected crew and active stream; records from earlier mission configurations remain stored."
          />
          {history.isLoading ? <LoadingState /> : null}
          {history.isError ? (
            <ErrorState message={history.error.message} />
          ) : null}
          {!history.isLoading && !history.data?.records.length ? (
            <Text style={{ color: COLORS.moreData, fontSize: UI.small }}>
              No context, exposure or cabin records yet. Missing information
              stays unknown.
            </Text>
          ) : null}
          {history.data?.records.slice(0, 30).map((log) => (
            <View
              key={log.id}
              style={{
                gap: 5,
                paddingVertical: 8,
                borderBottomColor: COLORS.border,
                borderBottomWidth: 1,
              }}
            >
              <Text
                style={{
                  color: COLORS.text,
                  fontWeight: "700",
                  fontSize: UI.small,
                }}
              >
                {human(log.data.kind)} ·{" "}
                {log.sourceKind === "simulated"
                  ? "SIMULATED"
                  : human(log.sourceKind)}
              </Text>
              <Text
                style={{
                  color: COLORS.textMuted,
                  fontSize: UI.small,
                  lineHeight: 20,
                }}
              >
                {logSummary(log)}
              </Text>
              <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
                {formatDateTime(log.observedAt)} · {log.sourceLabel} ·{" "}
                {log.missionId === bundle.mission?.id
                  ? "Current mission"
                  : "Other / no mission"}
              </Text>
              {log.note ? (
                <Text style={{ color: COLORS.textMuted, fontSize: UI.small }}>
                  {log.note}
                </Text>
              ) : null}
            </View>
          ))}
          <GhostButton
            label="Export current evidence & references"
            icon="download"
            onPress={async () => {
              try {
                const r = await utils.client.evidence.export.query({
                  crewId: bundle.crew.id,
                });
                await shareTextFile(r.filename, r.json, "application/json");
              } catch (e) {
                onError(e);
              }
            }}
          />
        </Panel>
        <GhostButton
          label="Inspect NASA / CSA references"
          icon="menu-book"
          onPress={() => router.push("/evidence")}
        />
        <Notice tone="warning" title="Research and clinical authority">
          Source relevance does not validate app cutoffs. Context reports and
          exposure logs do not diagnose illness or provide EVA clearance. Use
          established emergency procedures immediately for an emergency.
        </Notice>
      </ScreenScroll>
    </ScreenContainer>
  );
}
