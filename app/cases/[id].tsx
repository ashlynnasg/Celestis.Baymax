import { ScientificContextCard } from "@/components/science";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import { EvidenceList, GapList } from "@/components/app-blocks";
import { ScreenContainer } from "@/components/screen-container";
import {
  AppTextInput,
  COLORS,
  CategoryPill,
  Chip,
  DangerButton,
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
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

const KIND_LABEL: Record<string, string> = {
  opened: "Opened",
  category_change: "Category change",
  observation_added: "Observation",
  check_completed: "Guided check",
  check_declined: "Check unavailable",
  note: "Note",
  action: "Action",
  review_requested: "Review requested",
  acknowledged: "Acknowledged",
  handover_queued: "Handover queued",
  handover_reply: "Simulated reply",
  archived: "Archived",
};

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [note, setNote] = useState("");
  const [noteKind, setNoteKind] = useState<
    "note" | "action" | "review_requested"
  >("note");
  const [archiveReason, setArchiveReason] = useState("");
  const [showArchive, setShowArchive] = useState(false);

  const query = trpc.cases.get.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id) },
  );
  const acknowledge = trpc.cases.acknowledge.useMutation();
  const addNote = trpc.cases.addNote.useMutation();
  const archive = trpc.cases.archive.useMutation();

  if (query.isLoading) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <LoadingState label="Loading case" />
        </ScreenScroll>
      </ScreenContainer>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <ErrorState
            message={query.error?.message ?? "Case not found."}
            onRetry={() => query.refetch()}
          />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  const { case: record, events, domain } = query.data;

  const submitNote = async () => {
    if (note.trim().length < 2) return;
    await addNote.mutateAsync({
      caseId: record.id,
      kind: noteKind,
      body: note.trim(),
    });
    setNote("");
    await utils.cases.get.invalidate({ id: record.id });
    await utils.cases.list.invalidate();
  };

  const doArchive = () => {
    Alert.alert(
      "Archive this case?",
      "The timeline stays stored with its reason, but the case leaves open views.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: async () => {
            if (archiveReason.trim().length < 4) {
              Alert.alert(
                "Reason required",
                "Enter a short reason before archiving.",
              );
              return;
            }
            await archive.mutateAsync({
              caseId: record.id,
              reason: archiveReason.trim(),
            });
            await utils.invalidate();
            router.back();
          },
        },
      ],
    );
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
              fontSize: UI.tiny,
              letterSpacing: 1.2,
              fontWeight: "700",
            }}
          >
            CASE {record.id}
          </Text>
          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>
            {record.title}
          </Text>
          <CategoryPill category={record.currentCategory} />
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
            {record.crewName} · {record.status} · opened{" "}
            {formatDateTime(record.openedAt)} · rule set {record.ruleSetVersion}
            {record.streamId ? " · simulated stream" : ""}
          </Text>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
            {record.acknowledgedAt
              ? `Acknowledged ${formatDateTime(record.acknowledgedAt)} (seen only, not treated)`
              : "Not acknowledged yet"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 4,
            }}
          >
            <GhostButton
              label="Acknowledge (seen)"
              icon="visibility"
              onPress={async () => {
                await acknowledge.mutateAsync({ caseId: record.id });
                await utils.invalidate();
              }}
              loading={acknowledge.isPending}
            />
            <GhostButton
              label="Open evidence"
              icon="science"
              onPress={() => router.push(`/assessment/${record.domain}`)}
            />
            <GhostButton
              label="Start check"
              icon="checklist"
              onPress={() => router.push(`/check/new?domain=${record.domain}`)}
            />
            <GhostButton
              label="Create handover"
              icon="settings-input-antenna"
              onPress={() =>
                router.push(
                  `/link?caseId=${record.id}&crewId=${record.crewId}&domain=${record.domain}`,
                )
              }
            />
          </View>
        </Panel>

        {record.snapshot?.scientificContext ? (
          <ScientificContextCard value={record.snapshot.scientificContext} />
        ) : null}

        {domain ? (
          <Panel>
            <SectionTitle
              title="Current screening state"
              hint={domain.headline}
            />
            <EvidenceList evidence={domain.evidence.slice(0, 4)} />
            <View style={{ height: 10 }} />
            <GapList gaps={domain.dataGaps} />
          </Panel>
        ) : null}

        <Panel>
          <SectionTitle
            title="Timeline"
            hint="Most recent last. Events are dated when the change actually happened."
          />
          <View style={{ gap: 12 }}>
            {events.map((event) => (
              <View key={event.id} style={{ flexDirection: "row", gap: 10 }}>
                <View
                  style={{
                    width: 2,
                    backgroundColor: COLORS.border,
                    marginTop: 4,
                  }}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={{
                      color: COLORS.roseSoft,
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 0.6,
                    }}
                  >
                    {KIND_LABEL[event.kind] ?? event.kind} ·{" "}
                    {formatDateTime(event.occurredAt)}
                  </Text>
                  <Text
                    style={{
                      color: COLORS.text,
                      fontSize: UI.small,
                      fontWeight: "600",
                    }}
                  >
                    {event.title}
                  </Text>
                  <Text
                    style={{
                      color: COLORS.textMuted,
                      fontSize: UI.small,
                      lineHeight: 19,
                    }}
                  >
                    {event.body}
                  </Text>
                  <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                    {event.actor === "ground_simulation"
                      ? "fictional ground team"
                      : event.actor.replace("_", " ")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Panel>

        <Panel style={{ gap: 10 }}>
          <SectionTitle
            title="Add to the record"
            hint="Notes, actions and review requests become dated events."
          />
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Chip
              label="Note"
              active={noteKind === "note"}
              onPress={() => setNoteKind("note")}
            />
            <Chip
              label="Action taken"
              active={noteKind === "action"}
              onPress={() => setNoteKind("action")}
            />
            <Chip
              label="Request review"
              active={noteKind === "review_requested"}
              onPress={() => setNoteKind("review_requested")}
            />
          </View>
          <FieldLabel>Entry</FieldLabel>
          <AppTextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Resting heart rate repeated after 10 minutes of seated rest."
            multiline
            style={{ minHeight: 64, textAlignVertical: "top" }}
          />
          <PrimaryButton
            label="Add entry"
            icon="add"
            onPress={submitNote}
            disabled={note.trim().length < 2}
            loading={addNote.isPending}
          />
        </Panel>

        {record.status !== "archived" ? (
          <Panel style={{ gap: 8 }}>
            <SectionTitle
              title="Archive this case"
              hint="Archiving records the user action and reason; it does not assert clinical closure."
            />
            {showArchive ? (
              <>
                <FieldLabel>Reason</FieldLabel>
                <AppTextInput
                  value={archiveReason}
                  onChangeText={setArchiveReason}
                  placeholder="e.g. Superseded by a new case after review"
                  multiline
                  style={{ minHeight: 56, textAlignVertical: "top" }}
                />
                <DangerButton label="Archive case" onPress={doArchive} />
              </>
            ) : (
              <GhostButton
                label="Show archive options"
                icon="archive"
                onPress={() => setShowArchive(true)}
              />
            )}
          </Panel>
        ) : (
          <Notice tone="warning" title="Archived">
            {record.archiveReason ?? "No reason recorded."} Archived on{" "}
            {record.archivedAt
              ? formatDateTime(record.archivedAt)
              : "an unknown date"}
            .
          </Notice>
        )}
      </ScreenScroll>
    </ScreenContainer>
  );
}
