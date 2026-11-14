import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

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
import { HANDOVER_STATUS_LABELS } from "@/shared/handover";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

const ADVANCE = [
  { label: "+15 min", minutes: 15 },
  { label: "+1 h", minutes: 60 },
  { label: "+4 h", minutes: 240 },
  { label: "+1 day", minutes: 1440 },
];

export default function LinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ caseId?: string; crewId?: string; domain?: string }>();
  const { crewId, refreshAll } = useApp();
  const utils = trpc.useUtils();
  const [error, setError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<string | null>(null);

  const stateQuery = trpc.link.state.useQuery();
  const config = trpc.link.config.useMutation();
  const advance = trpc.link.advanceClock.useMutation();
  const create = trpc.link.create.useMutation();

  const targetCrew = params.crewId ?? crewId;
  const link = stateQuery.data?.link;

  const startHandover = async () => {
    if (!targetCrew) return;
    setError(null);
    try {
      const result = await create.mutateAsync({
        crewId: targetCrew,
        caseId: params.caseId ?? null,
        domain: params.domain ?? null,
      });
      await utils.invalidate();
      router.push(`/link/${result.handoverId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The handover could not be created.");
    }
  };

  const advanceClock = async (minutes: number) => {
    setLastChange(null);
    try {
      const result = await advance.mutateAsync({ minutes });
      setLastChange(
        result.changes.length === 0
          ? `Virtual clock advanced to ${formatDateTime(result.clock)}. No handover state changed.`
          : result.changes
              .map((change) => `${change.handoverId}: ${HANDOVER_STATUS_LABELS[change.status]}`)
              .join(" · ") + ` (clock ${formatDateTime(result.clock)})`,
      );
      await utils.invalidate();
      refreshAll();
    } catch (advanceError) {
      setError(advanceError instanceof Error ? advanceError.message : "The clock could not be advanced.");
    }
  };

  if (stateQuery.isLoading) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <LoadingState label="Reading the simulated link state" />
        </ScreenScroll>
      </ScreenContainer>
    );
  }
  if (stateQuery.isError || !link) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <ErrorState message={stateQuery.error?.message ?? "Link state unavailable."} onRetry={() => stateQuery.refetch()} />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <GhostButton label="Back" icon="arrow-back" onPress={() => router.back()} />
        </View>

        <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "700" }}>Deep Space Link</Text>
        <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, marginTop: 3, lineHeight: 16 }}>
          Local communication simulation. Nothing is transmitted: no network message, no real ground team, no real patient data.
        </Text>

        <Panel style={{ gap: 8 }}>
          <SectionTitle title="Simulated link" hint="The virtual link clock is separate from observation time." />
          <Text style={{ color: COLORS.text, fontSize: UI.small }}>
            Virtual clock: {formatDateTime(link.virtualClock)} (UTC)
          </Text>
          <Text style={{ color: link.linkAvailable ? COLORS.noFlags : COLORS.priority, fontSize: UI.small }}>
            {link.linkAvailable ? "Link available (simulated)" : "Link unavailable (simulated outage)"}
          </Text>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
            One-way delay {link.oneWayDelayMinutes} min · ground review {link.groundReviewMinutes} min
          </Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {ADVANCE.map((step) => (
              <Chip key={step.label} label={step.label} onPress={() => advanceClock(step.minutes)} tone={COLORS.rose} />
            ))}
          </View>
          {lastChange ? <Notice tone="info" title="Clock update">{lastChange}</Notice> : null}
          <Notice tone="warning" title="Nothing is refreshed by the clock">
            Advancing the clock never refreshes, ages or fabricates observations. Only the handover state machine reacts.
          </Notice>
        </Panel>

        <Panel style={{ gap: 10 }}>
          <SectionTitle title="Link configuration" hint="Demonstration settings only." />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 5 }}>
              <FieldLabel>One-way delay (min)</FieldLabel>
              <AppTextInput
                value={String(link.oneWayDelayMinutes)}
                onChangeText={(value) => {
                  const minutes = Math.max(1, Math.min(1440, Number(value.replace(/[^0-9]/g, "")) || 1));
                  config.mutate({
                    oneWayDelayMinutes: minutes,
                    groundReviewMinutes: link.groundReviewMinutes,
                    linkAvailable: link.linkAvailable,
                  });
                }}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <FieldLabel>Ground review (min)</FieldLabel>
              <AppTextInput
                value={String(link.groundReviewMinutes)}
                onChangeText={(value) => {
                  const minutes = Math.max(1, Math.min(1440, Number(value.replace(/[^0-9]/g, "")) || 1));
                  config.mutate({
                    oneWayDelayMinutes: link.oneWayDelayMinutes,
                    groundReviewMinutes: minutes,
                    linkAvailable: link.linkAvailable,
                  });
                }}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Chip
              label="Link available"
              active={link.linkAvailable}
              tone={COLORS.noFlags}
              onPress={() => config.mutate({ ...link, linkAvailable: true } as never)}
            />
            <Chip
              label="Simulate outage"
              active={!link.linkAvailable}
              tone={COLORS.priority}
              onPress={() => config.mutate({ ...link, linkAvailable: false } as never)}
            />
          </View>
        </Panel>

        <Panel style={{ gap: 10 }}>
          <SectionTitle title="Create a handover" hint="Freezes the current evidence snapshot at queue time." />
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small }}>
            Target crew: {targetCrew ?? "none selected"}
            {params.caseId ? ` · case ${params.caseId}` : ""}
          </Text>
          {error ? <Notice tone="danger" title="Cannot create">{error}</Notice> : null}
          <PrimaryButton
            label="Create handover draft"
            icon="note-add"
            onPress={startHandover}
            disabled={!targetCrew}
            loading={create.isPending}
          />
        </Panel>

        <Panel>
          <SectionTitle title="Handovers" hint="Draft → Queued → Sent → Delivered → Reply in transit → Reply received." />
          {(stateQuery.data?.handovers ?? []).length === 0 ? (
            <EmptyState icon="settings-input-antenna" title="No handover yet" body="Create a draft from a case or from the selected crew member." />
          ) : (
            <View style={{ gap: 8 }}>
              {(stateQuery.data?.handovers ?? []).map((handover) => (
                <View
                  key={handover.id}
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 12,
                    padding: 11,
                    gap: 5,
                    backgroundColor: COLORS.panelSoft,
                  }}
                >
                  <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: UI.small }}>
                    {handover.id} · {handover.crewName}
                  </Text>
                  <Text style={{ color: COLORS.roseSoft, fontSize: UI.tiny }}>
                    {HANDOVER_STATUS_LABELS[handover.status]} · v{handover.version}
                    {handover.replyReleased ? " · reply received" : ""}
                  </Text>
                  <Text style={{ color: COLORS.textFaint, fontSize: 11 }} numberOfLines={2}>
                    {handover.nextLeg?.label}: {handover.nextLeg?.detail}
                  </Text>
                  <GhostButton label="Open handover" icon="chevron-right" onPress={() => router.push(`/link/${handover.id}`)} />
                </View>
              ))}
            </View>
          )}
        </Panel>
      </ScreenScroll>
    </ScreenContainer>
  );
}
