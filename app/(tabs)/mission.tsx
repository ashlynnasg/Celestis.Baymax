import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  AppTextInput,
  COLORS,
  CategoryPill,
  Chip,
  ErrorState,
  FieldLabel,
  GhostButton,
  LoadingState,
  LightReadout,
  Notice,
  Panel,
  PrimaryButton,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import { DOMAINS, type DomainKey } from "@/shared/constants";
import { trpc } from "@/lib/trpc";

const ACTIVITY = [
  { value: "low", label: "Low activity" },
  { value: "moderate", label: "Moderate activity" },
  { value: "high", label: "High activity" },
] as const;

const WORKLOAD = [
  { value: "light", label: "Light workload" },
  { value: "standard", label: "Standard workload" },
  { value: "demanding", label: "Demanding workload" },
] as const;

export default function MissionScreen() {
  const router = useRouter();
  const { refreshAll } = useApp();
  const utils = trpc.useUtils();

  const stateQuery = trpc.state.get.useQuery();
  const tableQuery = trpc.assessment.crewTable.useQuery();
  const influences = trpc.mission.influences.useQuery();
  const saveDraft = trpc.mission.saveDraft.useMutation();
  const applyDraft = trpc.mission.applyDraft.useMutation();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const applied = stateQuery.data?.applied ?? null;
  const draft = stateQuery.data?.draft ?? null;

  const [form, setForm] = useState({
    destination: "",
    durationDays: "",
    activityLevel: "moderate" as "low" | "moderate" | "high",
    workload: "standard" as "light" | "standard" | "demanding",
    evaRequired: false,
    crewScope: "all_crew" as "all_crew" | "selected_crew",
  });

  useEffect(() => {
    const source = draft ?? applied;
    if (!source) return;
    setForm({
      destination: source.destination,
      durationDays: String(source.durationDays),
      activityLevel: source.activityLevel,
      workload: source.workload,
      evaRequired: source.evaRequired,
      crewScope: source.crewScope,
    });
  }, [applied?.id, draft?.id]);

  const save = async () => {
    setError(null);
    const duration = Number(form.durationDays);
    if (!form.destination.trim()) {
      setError("Describe the destination.");
      return;
    }
    if (Number.isNaN(duration) || duration < 1 || duration > 1000) {
      setError("Duration must be between 1 and 1000 days.");
      return;
    }
    try {
      await saveDraft.mutateAsync({
        destination: form.destination.trim(),
        durationDays: Math.round(duration),
        activityLevel: form.activityLevel,
        workload: form.workload,
        evaRequired: form.evaRequired,
        crewScope: form.crewScope,
      });
      await utils.invalidate();
      refreshAll();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The draft could not be saved.",
      );
    }
  };

  const apply = () => {
    Alert.alert(
      "Apply this mission configuration?",
      "Applying recalculates every screen, case and table from the same configuration. It does not clear or disqualify anyone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Apply",
          onPress: async () => {
            try {
              await saveDraft.mutateAsync({
                destination: form.destination.trim() || "Unnamed destination",
                durationDays: Math.max(
                  1,
                  Math.min(1000, Math.round(Number(form.durationDays) || 1)),
                ),
                activityLevel: form.activityLevel,
                workload: form.workload,
                evaRequired: form.evaRequired,
                crewScope: form.crewScope,
              });
              await applyDraft.mutateAsync();
              await utils.invalidate();
              refreshAll();
            } catch (applyError) {
              setError(
                applyError instanceof Error
                  ? applyError.message
                  : "The mission could not be applied.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "700" }}>
            Mission readiness
          </Text>
          <Text
            style={{ color: COLORS.textFaint, fontSize: UI.tiny, marginTop: 3 }}
          >
            One configuration drives every screen. Medical clearance is never
            decided here.
          </Text>
        </View>

        <LightReadout
          eyebrow="Mission context"
          title={applied ? applied.name : "No mission applied yet"}
          detail={
            applied
              ? `${applied.destination} · ${applied.durationDays} days. Your saved mission configuration informs the demonstration screening rules; it does not decide medical clearance.`
              : "Create and apply a mission configuration below. A draft is not applied until you select Apply."
          }
          accent={COLORS.amber}
          icon="travel-explore"
        />

        <Panel style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: COLORS.text, fontWeight: "700", flex: 1 }}>
              {applied ? applied.name : "No applied mission"}
            </Text>
            <Chip
              label={applied ? "Applied" : "Not applied"}
              active={Boolean(applied)}
              tone={COLORS.noFlags}
            />
          </View>
          {applied ? (
            <Text style={{ color: COLORS.textMuted, fontSize: UI.small }}>
              {applied.destination} · {applied.durationDays} days ·{" "}
              {applied.activityLevel} activity · {applied.workload} workload ·
              EVA {applied.evaRequired ? "required" : "not required"} · scope{" "}
              {applied.crewScope === "all_crew" ? "all crew" : "selected crew"}
            </Text>
          ) : null}
          {draft && applied && draft.id !== applied.id ? (
            <Text style={{ color: COLORS.review, fontSize: UI.tiny }}>
              An unapplied draft exists: {draft.name}. Save then apply to
              recalculate.
            </Text>
          ) : null}
        </Panel>

        <Panel style={{ gap: 12 }}>
          <SectionTitle
            title="Mission configuration"
            hint="Draft changes are clearly separate from the applied configuration."
          />
          <FieldLabel>Destination (descriptive only)</FieldLabel>
          <AppTextInput
            value={form.destination}
            onChangeText={(value) =>
              setForm((f) => ({ ...f, destination: value }))
            }
            placeholder="e.g. Lunar Gateway"
          />
          <FieldLabel hint="1–1000 days. Durations of 180 days or more tighten the bone/conditioning floor.">
            Duration (days)
          </FieldLabel>
          <AppTextInput
            value={form.durationDays}
            onChangeText={(value) =>
              setForm((f) => ({
                ...f,
                durationDays: value.replace(/[^0-9]/g, ""),
              }))
            }
            keyboardType="number-pad"
            placeholder="190"
          />
          <FieldLabel hint="Descriptive metadata: activities do not change thresholds.">
            Activity level
          </FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ACTIVITY.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={form.activityLevel === option.value}
                onPress={() =>
                  setForm((f) => ({ ...f, activityLevel: option.value }))
                }
              />
            ))}
          </View>
          <FieldLabel hint="A demanding workload raises the sleep review floor by 0.5 h.">
            Workload
          </FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {WORKLOAD.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={form.workload === option.value}
                onPress={() =>
                  setForm((f) => ({ ...f, workload: option.value }))
                }
              />
            ))}
          </View>
          <FieldLabel hint="Adds a pre-EVA data requirement for resting heart rate and saturation.">
            EVA required
          </FieldLabel>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Chip
              label="Yes"
              active={form.evaRequired}
              onPress={() => setForm((f) => ({ ...f, evaRequired: true }))}
            />
            <Chip
              label="No"
              active={!form.evaRequired}
              onPress={() => setForm((f) => ({ ...f, evaRequired: false }))}
            />
          </View>
          <FieldLabel hint="Scope only changes which profiles a table shows.">
            Crew scope
          </FieldLabel>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Chip
              label="All crew"
              active={form.crewScope === "all_crew"}
              onPress={() => setForm((f) => ({ ...f, crewScope: "all_crew" }))}
            />
            <Chip
              label="Selected crew"
              active={form.crewScope === "selected_crew"}
              onPress={() =>
                setForm((f) => ({ ...f, crewScope: "selected_crew" }))
              }
            />
          </View>

          {error ? (
            <Notice tone="danger" title="Cannot save">
              {error}
            </Notice>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <PrimaryButton
              label="Save draft"
              icon="save"
              onPress={save}
              loading={saveDraft.isPending}
            />
            <GhostButton
              label="Apply to every screen"
              icon="done-all"
              onPress={apply}
              loading={applyDraft.isPending}
            />
          </View>
          <Text
            style={{
              color: COLORS.textFaint,
              fontSize: UI.tiny,
              lineHeight: 16,
            }}
          >
            Applying recreates the assessment for all crew with this
            configuration. It never declares fitness, unfitness or EVA
            authorisation.
          </Text>
        </Panel>

        {influences.data ? (
          <Panel>
            <SectionTitle
              title="What actually affects the rules"
              hint="Descriptive inputs are disclosed honestly."
            />
            <Text
              style={{
                color: COLORS.textMuted,
                fontSize: UI.small,
                lineHeight: 19,
              }}
            >
              • {influences.data.durationDays}
            </Text>
            <Text
              style={{
                color: COLORS.textMuted,
                fontSize: UI.small,
                lineHeight: 19,
              }}
            >
              • {influences.data.workload}
            </Text>
            <Text
              style={{
                color: COLORS.textMuted,
                fontSize: UI.small,
                lineHeight: 19,
              }}
            >
              • {influences.data.evaRequired}
            </Text>
            {influences.data.descriptive.map((line) => (
              <Text
                key={line}
                style={{
                  color: COLORS.textFaint,
                  fontSize: UI.tiny,
                  lineHeight: 16,
                }}
              >
                – {line}
              </Text>
            ))}
          </Panel>
        ) : null}

        <Notice title="Coverage is separate from review priority">
          Radiation and cabin records do not provide safety clearance. Demanding
          work or EVA adds contextual review prompts; destination does not
          multiply disease risk.
        </Notice>
        <GhostButton
          label="Selected crew: hazard coverage"
          icon="travel-explore"
          onPress={() => router.push("/mission-context")}
        />
        <Panel>
          <SectionTitle
            title="All-crew readiness table"
            hint="Sorted by canonical review category. Tap a row for concerns, reasons and gaps."
            right={
              <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                {tableQuery.data?.length ?? 0} crew
              </Text>
            }
          />
          {tableQuery.isLoading ? (
            <LoadingState label="Building the table" />
          ) : null}
          {tableQuery.isError ? (
            <ErrorState
              message={tableQuery.error.message}
              onRetry={() => tableQuery.refetch()}
            />
          ) : null}
          <View style={{ gap: 8 }}>
            {(tableQuery.data ?? []).map((row) => {
              const isOpen = expanded === row.crewId;
              return (
                <Pressable
                  key={row.crewId}
                  onPress={() => setExpanded(isOpen ? null : row.crewId)}
                  accessibilityRole="button"
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 12,
                    padding: 11,
                    gap: 5,
                    backgroundColor: COLORS.panelSoft,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{ color: COLORS.text, fontWeight: "700", flex: 1 }}
                    >
                      {row.crewName}
                      <Text
                        style={{ color: COLORS.textFaint, fontWeight: "400" }}
                      >
                        {" "}
                        · {row.callSign}
                      </Text>
                    </Text>
                    <CategoryPill category={row.category} compact />
                  </View>
                  <Text
                    style={{ color: COLORS.textMuted, fontSize: UI.tiny }}
                    numberOfLines={isOpen ? undefined : 2}
                  >
                    {row.concerns.length > 0
                      ? row.concerns
                          .map(
                            (concern) =>
                              DOMAINS[concern as DomainKey]?.label ?? concern,
                          )
                          .join(", ")
                      : "No demonstration concern"}
                  </Text>
                  <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                    {row.completeness.available}/{row.completeness.total} fields
                    · {row.openCaseCount} case(s) · next: {row.nextAction}
                  </Text>
                  {isOpen ? (
                    <View style={{ gap: 6, marginTop: 6 }}>
                      <Text
                        style={{ color: COLORS.moreData, fontSize: UI.small }}
                      >
                        Hazard coverage gaps (not additional triage flags):{" "}
                        {row.hazardGaps.join("; ") ||
                          "Some records available; coverage remains incomplete."}
                      </Text>
                      {row.workflowChecks.map((check) => (
                        <Text
                          key={check}
                          style={{
                            color: COLORS.textMuted,
                            fontSize: UI.small,
                          }}
                        >
                          Context follow-up: {check}
                        </Text>
                      ))}
                      {row.reasons.map((reason, index) => (
                        <Text
                          key={`${row.crewId}-reason-${index}`}
                          style={{
                            color: COLORS.textMuted,
                            fontSize: 11,
                            lineHeight: 16,
                          }}
                        >
                          • {reason}
                        </Text>
                      ))}
                      {row.dataGaps.length > 0 ? (
                        <View>
                          <Text
                            style={{
                              color: COLORS.moreData,
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            DATA GAPS
                          </Text>
                          {row.dataGaps.map((gap) => (
                            <Text
                              key={gap}
                              style={{
                                color: COLORS.textFaint,
                                fontSize: 11,
                                lineHeight: 15,
                              }}
                            >
                              – {gap}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {row.domainCategories.map((item) => (
                          <Text
                            key={item.domain}
                            style={{ color: COLORS.textFaint, fontSize: 11 }}
                          >
                            {item.label.split(" ")[0]}:{" "}
                            {item.category.replace("_", " ")}
                          </Text>
                        ))}
                      </View>
                      <GhostButton
                        label="Open profile"
                        icon="chevron-right"
                        onPress={() => router.push(`/crew/${row.crewId}`)}
                      />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Panel>

        <Notice tone="warning" title="No clearance language">
          The table reports demonstration categories and reasons only. It never
          states that a crew member is fit, unfit, cleared or authorised for
          EVA.
        </Notice>
      </ScreenScroll>
    </ScreenContainer>
  );
}
