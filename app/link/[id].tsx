import { ScientificContextCard } from "@/components/science";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { EvidenceList, GapList } from "@/components/app-blocks";
import { ScreenContainer } from "@/components/screen-container";
import {
  AppTextInput,
  COLORS,
  CategoryPill,
  ErrorState,
  FieldLabel,
  GhostButton,
  KeyValueList,
  LoadingState,
  Notice,
  Panel,
  PrimaryButton,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import { HANDOVER_SEQUENCE, HANDOVER_STATUS_LABELS } from "@/shared/handover";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

export default function HandoverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = trpc.link.get.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id) },
  );
  const queue = trpc.link.queue.useMutation();
  const reply = trpc.link.reply.useMutation();
  const revise = trpc.link.revise.useMutation();
  const advance = trpc.link.advanceClock.useMutation();

  if (query.isLoading) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <LoadingState label="Loading handover" />
        </ScreenScroll>
      </ScreenContainer>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <ErrorState
            message={query.error?.message ?? "Handover not found."}
            onRetry={() => query.refetch()}
          />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  const { handover, link } = query.data;
  const snapshot = handover.snapshot;
  const stepIndex = HANDOVER_SEQUENCE.indexOf(handover.status);

  const doQueue = async () => {
    setError(null);
    try {
      await queue.mutateAsync({ handoverId: handover.id });
      await utils.invalidate();
      query.refetch();
    } catch (queueError) {
      setError(
        queueError instanceof Error
          ? queueError.message
          : "The handover could not be queued.",
      );
    }
  };

  const doReply = async () => {
    setError(null);
    if (replyBody.trim().length < 4) {
      setError("Write the fictional ground reply first.");
      return;
    }
    try {
      await reply.mutateAsync({
        handoverId: handover.id,
        body: replyBody.trim(),
      });
      setReplyBody("");
      await utils.invalidate();
      query.refetch();
    } catch (replyError) {
      setError(
        replyError instanceof Error
          ? replyError.message
          : "The reply could not be recorded.",
      );
    }
  };

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
            label="Back"
            icon="arrow-back"
            onPress={() => router.back()}
          />
        </View>

        <Panel style={{ gap: 8 }}>
          <Text
            style={{
              color: COLORS.textFaint,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: "700",
            }}
          >
            HANDOVER {handover.id} · VERSION {handover.version}
          </Text>
          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>
            {handover.crewName} · {snapshot?.categoryLabel ?? handover.category}
          </Text>
          <CategoryPill category={handover.category} />
          <Text
            style={{
              color: COLORS.roseSoft,
              fontSize: UI.small,
              fontWeight: "600",
            }}
          >
            {HANDOVER_STATUS_LABELS[handover.status]}
          </Text>
          {handover.nextLeg ? (
            <Text
              style={{
                color: COLORS.textFaint,
                fontSize: UI.tiny,
                lineHeight: 16,
              }}
            >
              {handover.nextLeg.label}: {handover.nextLeg.detail}
            </Text>
          ) : null}
          <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
            Created {formatDateTime(handover.createdAt)} · queued{" "}
            {handover.queuedAt ? formatDateTime(handover.queuedAt) : "—"} · sent{" "}
            {handover.sentAt ? formatDateTime(handover.sentAt) : "—"} ·
            delivered{" "}
            {handover.deliveredAt ? formatDateTime(handover.deliveredAt) : "—"}
          </Text>
          <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
            {HANDOVER_SEQUENCE.map((status, index) => (
              <View
                key={status}
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: index <= stepIndex ? COLORS.rose : COLORS.border,
                  backgroundColor:
                    index <= stepIndex ? `${COLORS.rose}22` : "transparent",
                }}
              >
                <Text
                  style={{
                    color:
                      index <= stepIndex ? COLORS.roseSoft : COLORS.textFaint,
                    fontSize: 11,
                  }}
                >
                  {HANDOVER_STATUS_LABELS[status]}
                </Text>
              </View>
            ))}
          </View>
        </Panel>

        {error ? (
          <Notice tone="danger" title="Cannot continue">
            {error}
          </Notice>
        ) : null}

        <Panel style={{ gap: 8 }}>
          <SectionTitle
            title="Dispatch controls"
            hint="Dispatch is only possible while the simulated link is available."
          />
          <Text
            style={{
              color: link.linkAvailable ? COLORS.noFlags : COLORS.priority,
              fontSize: UI.tiny,
            }}
          >
            Link:{" "}
            {link.linkAvailable
              ? "available (simulated)"
              : "unavailable (simulated outage)"}{" "}
            · virtual clock {formatDateTime(link.virtualClock)}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <PrimaryButton
              label="Queue handover"
              icon="outbox"
              onPress={doQueue}
              disabled={handover.status !== "draft"}
              loading={queue.isPending}
            />
            <GhostButton
              label="Advance 15 min"
              icon="schedule"
              onPress={async () => {
                await advance.mutateAsync({ minutes: 15 });
                await utils.invalidate();
                query.refetch();
              }}
            />
            <GhostButton
              label="Advance 3 h"
              icon="schedule"
              onPress={async () => {
                await advance.mutateAsync({ minutes: 180 });
                await utils.invalidate();
                query.refetch();
              }}
            />
            <GhostButton
              label="Create revision"
              icon="content-copy"
              onPress={async () => {
                const result = await revise.mutateAsync({
                  handoverId: handover.id,
                });
                await utils.invalidate();
                router.push(`/link/${result.handoverId}`);
              }}
            />
          </View>
          <Text
            style={{ color: COLORS.textFaint, fontSize: 11, lineHeight: 15 }}
          >
            Allowed next states:{" "}
            {query.data.allowed.length > 0
              ? query.data.allowed.join(", ")
              : "none (terminal)"}
            . Snapshot frozen at queue time; a later revision is stored as its
            own version.
          </Text>
        </Panel>

        {snapshot ? (
          <>
            {snapshot.spaceContext ? (
              <Panel style={{ gap: 8 }}>
                <SectionTitle
                  title="Frozen mission evidence"
                  hint="Captured at queue time; later records cannot change this snapshot."
                />
                {snapshot.spaceContext.coverage.map((h) => (
                  <Text
                    key={h.key}
                    style={{ color: COLORS.moreData, fontSize: UI.small }}
                  >
                    {h.label}: {h.status.replace(/_/g, " ")}
                  </Text>
                ))}
                {snapshot.spaceContext.contextFacts.map((fact, i) => (
                  <Text
                    key={i}
                    style={{
                      color: COLORS.textMuted,
                      fontSize: UI.small,
                      lineHeight: 20,
                    }}
                  >
                    {fact}
                  </Text>
                ))}
                <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>
                  {snapshot.spaceContext.logs.length} context / exposure / cabin
                  record(s). Full values, intervals and provenance are included
                  in the exported JSON. Coverage is separate from review
                  priority.
                </Text>
              </Panel>
            ) : null}
            {snapshot.scientificContext ? (
              <ScientificContextCard value={snapshot.scientificContext} />
            ) : null}
            <Panel>
              <SectionTitle
                title="Handover content"
                hint="Frozen evidence snapshot carried by this handover."
              />
              <KeyValueList
                items={[
                  {
                    label: "Astronaut",
                    value: `${snapshot.crewName} (${snapshot.crewId})`,
                  },
                  { label: "Case", value: snapshot.caseId ?? "No linked case" },
                  {
                    label: "Mission snapshot",
                    value: snapshot.mission
                      ? `${snapshot.mission.destination} · ${snapshot.mission.durationDays} d · ${snapshot.mission.workload} workload · EVA ${
                          snapshot.mission.evaRequired
                            ? "required"
                            : "not required"
                        }`
                      : "No applied mission",
                  },
                  {
                    label: "Category",
                    value: `${snapshot.categoryLabel} (rule set ${snapshot.ruleSetVersion})`,
                  },
                  {
                    label: "Assessed",
                    value: formatDateTime(snapshot.assessedAt),
                  },
                  {
                    label: "Stream",
                    value: snapshot.streamLabel ?? "baseline",
                  },
                ]}
              />
              <View style={{ height: 10 }} />
              <Text
                style={{
                  color: COLORS.textMuted,
                  fontSize: UI.small,
                  lineHeight: 19,
                }}
              >
                {snapshot.explanation}
              </Text>
            </Panel>

            <Panel>
              <SectionTitle
                title="Evidence"
                hint="Values carry units, dates, sources and context."
              />
              <EvidenceList evidence={snapshot.evidence} />
              <View style={{ height: 10 }} />
              <GapList gaps={snapshot.dataGaps} />
            </Panel>

            <Panel>
              <SectionTitle title="Recorded actions" />
              {snapshot.recordedActions.length === 0 ? (
                <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>
                  No crew-side action was recorded.
                </Text>
              ) : (
                snapshot.recordedActions.map((action, index) => (
                  <Text
                    key={`${action}-${index}`}
                    style={{
                      color: COLORS.textMuted,
                      fontSize: UI.tiny,
                      lineHeight: 17,
                    }}
                  >
                    • {action}
                  </Text>
                ))
              )}
              <View style={{ height: 10 }} />
              <SectionTitle title="Follow-up questions" />
              {snapshot.followUpQuestions.map((question, index) => (
                <Text
                  key={`${question}-${index}`}
                  style={{
                    color: COLORS.textMuted,
                    fontSize: UI.tiny,
                    lineHeight: 17,
                  }}
                >
                  ? {question}
                </Text>
              ))}
            </Panel>
          </>
        ) : null}

        <Panel style={{ gap: 10 }}>
          <SectionTitle
            title="Fictional ground review"
            hint="Available after simulated delivery. The reply stays hidden from the crew side until the return leg completes."
          />
          {handover.status === "delivered" ? (
            <>
              <FieldLabel>Ground reply (fictional)</FieldLabel>
              <AppTextInput
                value={replyBody}
                onChangeText={setReplyBody}
                placeholder="e.g. Reviewed the simulated resting heart rate trend. Recommend repeating a seated rest measurement before the next session; no clearance implied."
                multiline
                style={{ minHeight: 90, textAlignVertical: "top" }}
              />
              <PrimaryButton
                label="Release to return leg"
                icon="send"
                onPress={doReply}
                loading={reply.isPending}
              />
            </>
          ) : null}

          {handover.status === "reply_in_transit" ? (
            <Notice tone="warning" title="Reply in transit">
              A fictional ground reply exists and is hidden until the return
              journey completes
              {handover.reply
                ? ` (arrives ${formatDateTime(handover.reply.arrivesAt)})`
                : ""}
              . Advance the clock to complete the return leg.
            </Notice>
          ) : null}

          {handover.replyReleased && handover.reply ? (
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  color: COLORS.roseSoft,
                  fontSize: UI.tiny,
                  fontWeight: "700",
                }}
              >
                {handover.reply.author.toUpperCase()}
              </Text>
              <Text
                style={{
                  color: COLORS.text,
                  fontSize: UI.small,
                  lineHeight: 20,
                }}
              >
                {handover.reply.body}
              </Text>
              <Text
                style={{
                  color: COLORS.textFaint,
                  fontSize: 11,
                  lineHeight: 15,
                }}
              >
                {handover.reply.disclaimer}
              </Text>
            </View>
          ) : null}

          {handover.status !== "delivered" && !handover.replyReleased ? (
            <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>
              No ground reply can be composed in the current state.
            </Text>
          ) : null}
        </Panel>

        <Panel>
          <SectionTitle title="State history" />
          {handover.events.map((event) => (
            <View key={event.id} style={{ marginBottom: 8, gap: 2 }}>
              <Text
                style={{
                  color: COLORS.roseSoft,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {HANDOVER_STATUS_LABELS[event.status]} ·{" "}
                {formatDateTime(event.occurredAt)}
              </Text>
              <Text
                style={{
                  color: COLORS.textMuted,
                  fontSize: UI.tiny,
                  lineHeight: 16,
                }}
              >
                {event.note}
              </Text>
            </View>
          ))}
        </Panel>

        <Notice tone="warning" title="Simulation boundary">
          {snapshot?.disclaimer ??
            "This handover is a local simulation. Delivery does not mean the case was reviewed, treated or cleared."}
        </Notice>
      </ScreenScroll>
    </ScreenContainer>
  );
}
