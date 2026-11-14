import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  AppTextInput,
  COLORS,
  Chip,
  EmptyState,
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
import { SCENARIOS, type ScenarioKey } from "@/shared/constants";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

export default function SimulatorScreen() {
  const router = useRouter();
  const { crewId, crewList, activeStream, refreshAll } = useApp();
  const utils = trpc.useUtils();
  const [targetCrew, setTargetCrew] = useState<string | null>(crewId);
  const [scenario, setScenario] = useState<ScenarioKey | null>(null);
  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetCrew && crewId) setTargetCrew(crewId);
  }, [crewId, targetCrew]);

  const preview = trpc.simulator.preview.useQuery(
    { crewId: targetCrew ?? "", scenario: scenario ?? "normal" },
    { enabled: Boolean(targetCrew && scenario) },
  );
  const runs = trpc.simulator.list.useQuery({ crewId: targetCrew ?? undefined }, { enabled: Boolean(targetCrew) });
  const runMutation = trpc.simulator.run.useMutation();
  const deactivate = trpc.simulator.deactivate.useMutation();
  const activate = trpc.simulator.activate.useMutation();

  const generate = async () => {
    if (!targetCrew || !scenario) return;
    setError(null);
    try {
      const parsedSeed = seed.trim() ? Number(seed.replace(/[^0-9]/g, "")) : undefined;
      const run = await runMutation.mutateAsync({ crewId: targetCrew, scenario, seed: parsedSeed });
      await utils.invalidate();
      refreshAll();
      router.push(`/simulator/${run.id}`);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "The run could not be generated.");
    }
  };

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <GhostButton label="Back" icon="arrow-back" onPress={() => router.back()} />
        </View>
        <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "700" }}>Mission health simulator</Text>
        <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, marginTop: 3, lineHeight: 16 }}>
          Six documented scenarios, seven daily simulated observations each. Generated runs are stored separately and the
          recorded baseline is never modified.
        </Text>

        {activeStream ? (
          <Notice tone="warning" title="A simulated stream is applied">
            {activeStream.label} is currently feeding the rest of the app.{" "}
            <Text
              style={{ color: COLORS.roseSoft, textDecorationLine: "underline" }}
              onPress={async () => {
                await deactivate.mutateAsync();
                await utils.invalidate();
                refreshAll();
              }}
            >
              Return to baseline
            </Text>
          </Notice>
        ) : null}

        <Panel style={{ gap: 10 }}>
          <SectionTitle title="1 · Choose astronaut" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {crewList
              .filter((member) => !member.archived)
              .map((member) => (
                <Chip
                  key={member.id}
                  label={`${member.displayName.split(" ")[0]} · ${member.callSign}`}
                  active={targetCrew === member.id}
                  onPress={() => setTargetCrew(member.id)}
                />
              ))}
          </View>
        </Panel>

        <Panel style={{ gap: 10 }}>
          <SectionTitle title="2 · Choose scenario" hint="Selecting a scenario only previews intended changes." />
          <View style={{ gap: 8 }}>
            {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => setScenario(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: scenario === key }}
                style={{
                  borderWidth: 1,
                  borderColor: scenario === key ? COLORS.rose : COLORS.border,
                  backgroundColor: scenario === key ? `${COLORS.rose}18` : COLORS.panelSoft,
                  borderRadius: 12,
                  padding: 11,
                  gap: 3,
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: UI.small }}>{SCENARIOS[key].label}</Text>
                <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>{SCENARIOS[key].blurb}</Text>
              </Pressable>
            ))}
          </View>
        </Panel>

        {scenario && preview.isLoading ? <LoadingState label="Building the preview" /> : null}
        {scenario && preview.isError ? <ErrorState message={preview.error.message} onRetry={() => preview.refetch()} /> : null}

        {preview.data ? (
          <Panel style={{ gap: 8 }}>
            <SectionTitle title="3 · Intended changes" hint="Preview of generated values; nothing is saved until you generate." />
            {preview.data.rows.map((row) => (
              <View key={row.metric} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ color: COLORS.textMuted, fontSize: UI.tiny, flex: 1 }}>{row.label}</Text>
                <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>{row.baseline}</Text>
                <Text style={{ color: COLORS.roseSoft, fontSize: UI.tiny }}>→ {row.target}</Text>
              </View>
            ))}
            <View style={{ gap: 3, marginTop: 4 }}>
              {preview.data.assumptions.map((assumption) => (
                <Text key={assumption} style={{ color: COLORS.textFaint, fontSize: 11, lineHeight: 15 }}>
                  • {assumption}
                </Text>
              ))}
            </View>
            <View style={{ gap: 5 }}>
              <FieldLabel hint="Optional. The same seed always reproduces the same run.">Seed</FieldLabel>
              <AppTextInput value={seed} onChangeText={setSeed} keyboardType="number-pad" placeholder="e.g. 20260101" />
            </View>
            {error ? <Notice tone="danger" title="Cannot generate">{error}</Notice> : null}
            <PrimaryButton label="Generate and save run" icon="science" onPress={generate} loading={runMutation.isPending} />
            <Text style={{ color: COLORS.textFaint, fontSize: 11, lineHeight: 15 }}>
              Generating writes seven days of simulated observations into a new stream. Selected, generated and applied states
              stay distinct.
            </Text>
          </Panel>
        ) : null}

        {!scenario ? <Notice>Select a scenario to preview the intended changes before generating anything.</Notice> : null}

        <Panel>
          <SectionTitle title="Saved runs" hint="Reopen a run to replay it, or apply it to the app." />
          {runs.isLoading ? <LoadingState label="Loading runs" /> : null}
          {runs.isError ? <ErrorState message={runs.error.message} onRetry={() => runs.refetch()} /> : null}
          {(runs.data ?? []).length === 0 && !runs.isLoading ? (
            <EmptyState icon="science" title="No saved runs yet" body="Generate a scenario to create the first saved run." />
          ) : null}
          <View style={{ gap: 8 }}>
            {(runs.data ?? []).map((run) => (
              <View
                key={run.id}
                style={{
                  borderWidth: 1,
                  borderColor: activeStream?.id === run.id ? COLORS.review : COLORS.border,
                  borderRadius: 12,
                  padding: 11,
                  gap: 6,
                  backgroundColor: COLORS.panelSoft,
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: UI.small }}>{run.label}</Text>
                <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                  {run.id} · day 1 {formatDateTime(run.startDate)} · seed {run.seed} · {run.status}
                  {activeStream?.id === run.id ? " · applied" : ""}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <GhostButton label="Replay" icon="history" onPress={() => router.push(`/simulator/${run.id}`)} />
                  <GhostButton
                    label={activeStream?.id === run.id ? "Applied" : "Apply stream"}
                    icon="play-arrow"
                    disabled={activeStream?.id === run.id}
                    onPress={async () => {
                      await activate.mutateAsync({ runId: run.id });
                      await utils.invalidate();
                      refreshAll();
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </Panel>
      </ScreenScroll>
    </ScreenContainer>
  );
}
