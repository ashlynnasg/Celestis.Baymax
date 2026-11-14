import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { shareTextFile, pickTextFile } from "@/lib/files";
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
import type { ImportColumnMapping, ImportFieldKey } from "@/shared/domain";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

const FIELD_LABELS: Record<string, string> = {
  crewId: "Astronaut id",
  crewName: "Astronaut name",
  observedAt: "Observation time",
  unit: "Unit",
  context: "Context",
  sourceLabel: "Source",
  note: "Note",
  ignore: "Do not import",
};

export default function ImportScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [sourceTitle, setSourceTitle] = useState(
    "Crew daily log (example import)",
  );
  const [sourceRef, setSourceRef] = useState("Pasted demonstration content");
  const [recordPath, setRecordPath] = useState("records");
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<ImportColumnMapping[] | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [allowPartial, setAllowPartial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const preview = trpc.imports.preview.useMutation();
  const commit = trpc.imports.commit.useMutation();
  const fields = trpc.imports.fields.useQuery();
  const batches = trpc.imports.list.useQuery();

  const loadExample = async (kind: "valid" | "invalid" | "nested" | "long") => {
    const example = await utils.client.imports.example.query({ kind });
    setFormat(example.format);
    setText(example.text);
    setSourceTitle(example.filename);
    setSourceRef(example.note);
    if (example.recordPath) setRecordPath(example.recordPath);
    setMapping(null);
    setBatchId(null);
    setSummary(null);
  };

  const pickFile = async () => {
    setError(null);
    try {
      const file = await pickTextFile();
      if (!file) return;
      setText(file.text);
      setSourceTitle(file.name);
      setSourceRef(`Selected file: ${file.name}`);
      setFormat(file.name.toLowerCase().endsWith(".json") ? "json" : "csv");
      setMapping(null);
      setBatchId(null);
      setSummary(null);
    } catch (pickError) {
      setError(
        pickError instanceof Error
          ? pickError.message
          : "The file could not be read.",
      );
    }
  };

  const runPreview = async (nextMapping?: ImportColumnMapping[]) => {
    setError(null);
    setSummary(null);
    try {
      const result = await preview.mutateAsync({
        sourceTitle,
        sourceRef,
        text,
        format,
        recordPath: format === "json" ? recordPath : null,
        mapping: nextMapping ?? mapping ?? undefined,
      });
      setMapping(result.mapping);
      setBatchId(result.batch.id);
      await utils.imports.list.invalidate();
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "The content could not be parsed.",
      );
      setBatchId(null);
    }
  };

  const changeMapping = async (field: string) => {
    if (!mapping || !editingColumn) return;
    const next = mapping.map((item) =>
      item.column === editingColumn
        ? {
            ...item,
            field: field as ImportFieldKey | "ignore",
            confidence: "manual" as const,
            unit: null,
          }
        : item,
    );
    setMapping(next);
    setEditingColumn(null);
    await runPreview(next);
  };

  const doCommit = async () => {
    if (!batchId) return;
    setError(null);
    try {
      const result = await commit.mutateAsync({ batchId, allowPartial });
      setSummary(
        `Committed ${result.inserted} observation(s); ${result.skippedDuplicates} duplicate row(s) skipped. Batch ${
          result.batch?.id ?? batchId
        } is now marked committed.`,
      );
      await utils.invalidate();
    } catch (commitError) {
      setError(
        commitError instanceof Error
          ? commitError.message
          : "The batch could not be committed.",
      );
    }
  };

  const downloadReport = async () => {
    if (!batchId) return;
    const report = await utils.client.imports.report.query({ batchId });
    const message = await shareTextFile(report.filename, report.csv);
    Alert.alert("Validation report", message);
  };

  const batch = preview.data?.batch ?? null;
  const currentMapping = mapping ?? batch?.mapping ?? [];

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
        <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "700" }}>
          Data integration
        </Text>
        <Text
          style={{
            color: COLORS.textFaint,
            fontSize: UI.tiny,
            marginTop: 3,
            lineHeight: 16,
          }}
        >
          Neutral import workflow for future datasets. Nothing here is NASA
          data; imported rows are labelled with their source and batch id.
        </Text>

        <Panel style={{ gap: 10 }}>
          <SectionTitle
            title="Choose what you are adding"
            hint="Articles are reference material; measurements are records."
          />
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: UI.small,
              lineHeight: 20,
            }}
          >
            The importer below maps vital-sign CSV/JSON data. Agency webpages
            supply context, not individual astronaut readings.
            Radiation/context/cabin files use a separate explicit adapter.
          </Text>
          <GhostButton
            label="Scientific reference library"
            icon="menu-book"
            onPress={() => router.push("/evidence")}
          />
          <GhostButton
            label="Radiation & context import"
            icon="upload-file"
            onPress={() => router.push("/mission-context?kind=import")}
          />
        </Panel>

        <Panel style={{ gap: 10 }}>
          <SectionTitle
            title="1 · Source"
            hint="File names and cell content are treated as untrusted text."
          />
          <FieldLabel>Source title</FieldLabel>
          <AppTextInput
            value={sourceTitle}
            onChangeText={setSourceTitle}
            placeholder="e.g. Exercise log export"
          />
          <FieldLabel hint="Optional: URL or file reference shown in the import summary.">
            Source reference
          </FieldLabel>
          <AppTextInput
            value={sourceRef}
            onChangeText={setSourceRef}
            placeholder="Where this content came from"
          />
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Chip
              label="CSV"
              active={format === "csv"}
              onPress={() => setFormat("csv")}
            />
            <Chip
              label="JSON"
              active={format === "json"}
              onPress={() => setFormat("json")}
            />
          </View>
          {format === "json" ? (
            <>
              <FieldLabel hint="Path to the array of records, e.g. records or data.observations.">
                Record path
              </FieldLabel>
              <AppTextInput
                value={recordPath}
                onChangeText={setRecordPath}
                placeholder="records"
              />
            </>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <GhostButton
              label="Choose file"
              icon="attach-file"
              onPress={pickFile}
            />
            <GhostButton
              label="Valid example"
              icon="description"
              onPress={() => loadExample("valid")}
            />
            <GhostButton
              label="Invalid example"
              icon="bug-report"
              onPress={() => loadExample("invalid")}
            />
            <GhostButton
              label="Nested JSON"
              icon="data-object"
              onPress={() => loadExample("nested")}
            />
            <GhostButton
              label="Long format"
              icon="table-rows"
              onPress={() => loadExample("long")}
            />
          </View>
          <FieldLabel hint="Or paste content. The demo accepts up to 2 MB / 2000 rows.">
            Content
          </FieldLabel>
          <AppTextInput
            value={text}
            onChangeText={(value) => {
              setText(value);
              setBatchId(null);
              setSummary(null);
            }}
            placeholder={
              "crew_id,observed_at,heart_rate,spo2\ncrew-01,2026-11-10T07:30:00Z,72,98"
            }
            multiline
            style={{
              minHeight: 120,
              textAlignVertical: "top",
              fontFamily: "monospace",
            }}
          />
          {error ? (
            <Notice tone="danger" title="Cannot continue">
              {error}
            </Notice>
          ) : null}
          <PrimaryButton
            label="Parse and preview"
            icon="preview"
            onPress={() => runPreview()}
            disabled={text.trim().length === 0 || preview.isPending}
            loading={preview.isPending}
          />
        </Panel>

        {preview.isPending ? (
          <LoadingState label="Parsing and validating" />
        ) : null}

        {batch ? (
          <>
            <Panel style={{ gap: 10 }}>
              <SectionTitle
                title="2 · Suggested mapping"
                hint="Suggestions can be overridden. Columns without a supported match are kept but not converted."
              />
              {currentMapping.map((item) => (
                <View
                  key={item.column}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.border,
                    paddingBottom: 6,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: COLORS.text,
                        fontSize: UI.small,
                        fontWeight: "600",
                      }}
                    >
                      {item.column}
                    </Text>
                    <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                      {FIELD_LABELS[item.field] ?? item.field} ·{" "}
                      {item.confidence}
                    </Text>
                  </View>
                  <GhostButton
                    label="Change"
                    icon="swap-horiz"
                    onPress={() => setEditingColumn(item.column)}
                  />
                </View>
              ))}
              <Text
                style={{
                  color: COLORS.textFaint,
                  fontSize: 11,
                  lineHeight: 15,
                }}
              >
                {batch.notes.join(" · ")}
              </Text>
            </Panel>

            <Panel style={{ gap: 8 }}>
              <SectionTitle
                title="3 · Validation"
                hint={`${batch.validCount} valid · ${batch.errorCount} issue(s) · ${batch.duplicateCount} duplicate(s) · ${batch.rowCount} row(s)`}
              />
              {batch.errors.length === 0 ? (
                <Text style={{ color: COLORS.noFlags, fontSize: UI.small }}>
                  No validation issues found.
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {batch.errors.slice(0, 12).map((rowError, index) => (
                    <View key={`${rowError.row}-${index}`} style={{ gap: 2 }}>
                      <Text
                        style={{
                          color: COLORS.priority,
                          fontSize: UI.tiny,
                          fontWeight: "700",
                        }}
                      >
                        Row {rowError.row || "—"} · {rowError.code} ·{" "}
                        {rowError.column ?? "batch"}
                      </Text>
                      <Text
                        style={{ color: COLORS.textMuted, fontSize: UI.tiny }}
                      >
                        {rowError.message}
                      </Text>
                      <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                        Expected: {rowError.expected}
                      </Text>
                    </View>
                  ))}
                  {batch.errors.length > 12 ? (
                    <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                      + {batch.errors.length - 12} more issue(s). Download the
                      validation report for the full list.
                    </Text>
                  ) : null}
                </View>
              )}
              <GhostButton
                label="Download validation report (CSV)"
                icon="download"
                onPress={downloadReport}
              />
            </Panel>

            {batch.preview.length > 0 ? (
              <Panel style={{ gap: 6 }}>
                <SectionTitle
                  title="Preview"
                  hint={`First ${batch.preview.length} converted observations (not yet stored).`}
                />
                {batch.preview.map((row, index) => (
                  <View
                    key={`${row.row}-${row.metric}-${index}`}
                    style={{ flexDirection: "row", gap: 6 }}
                  >
                    <Text
                      style={{
                        color: COLORS.textFaint,
                        fontSize: 11,
                        width: 34,
                      }}
                    >
                      r{row.row}
                    </Text>
                    <Text
                      style={{ color: COLORS.textMuted, fontSize: 11, flex: 1 }}
                      numberOfLines={1}
                    >
                      {row.crewName} · {row.metric}
                    </Text>
                    <Text style={{ color: COLORS.text, fontSize: 11 }}>
                      {row.value} {row.unit}
                    </Text>
                  </View>
                ))}
              </Panel>
            ) : null}

            <Panel style={{ gap: 8 }}>
              <SectionTitle
                title="4 · Commit"
                hint="Atomic: either the validated rows are stored, or nothing is."
              />
              {batch.errorCount > 0 ? (
                <Chip
                  label={
                    allowPartial
                      ? "Validated rows only: ON"
                      : "Validated rows only: OFF"
                  }
                  active={allowPartial}
                  onPress={() => setAllowPartial((value) => !value)}
                  tone={COLORS.review}
                />
              ) : null}
              {summary ? (
                <Notice tone="success" title="Committed">
                  {summary}
                </Notice>
              ) : null}
              <PrimaryButton
                label={
                  batch.errorCount > 0 && !allowPartial
                    ? "Fix errors before commit"
                    : "Commit batch"
                }
                icon="save"
                onPress={doCommit}
                disabled={batch.errorCount > 0 && !allowPartial}
                loading={commit.isPending}
              />
              <Text
                style={{
                  color: COLORS.textFaint,
                  fontSize: 11,
                  lineHeight: 15,
                }}
              >
                Repeated imports are blocked by checksum, and identical values
                are skipped row by row. Exported CSV is guarded against
                spreadsheet formula injection.
              </Text>
            </Panel>
          </>
        ) : null}

        <Panel>
          <SectionTitle
            title="Recent batches"
            hint="Stored import history with original columns and counts."
          />
          {batches.isLoading ? <LoadingState label="Loading batches" /> : null}
          {batches.isError ? (
            <ErrorState
              message={batches.error.message}
              onRetry={() => batches.refetch()}
            />
          ) : null}
          {(batches.data ?? []).length === 0 ? (
            <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>
              No batches yet.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {(batches.data ?? []).slice(0, 8).map((item) => (
                <View key={item.id} style={{ gap: 2 }}>
                  <Text
                    style={{
                      color: COLORS.text,
                      fontSize: UI.small,
                      fontWeight: "600",
                    }}
                  >
                    {item.sourceTitle}
                  </Text>
                  <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                    {item.id} · {item.format.toUpperCase()} · {item.status} ·{" "}
                    {item.validCount}/{item.rowCount} valid ·{" "}
                    {formatDateTime(item.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Panel>

        <Notice tone="warning" title="Adapter requirement">
          Long-format tables (metric/value columns) and deeply nested payloads
          are not reshaped silently. The importer names the required adapter
          instead of guessing.
        </Notice>
      </ScreenScroll>

      <Modal
        visible={Boolean(editingColumn)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingColumn(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "#000000AA",
            justifyContent: "flex-end",
          }}
          onPress={() => setEditingColumn(null)}
          accessibilityLabel="Close mapping picker"
        >
          <View
            style={{
              backgroundColor: COLORS.panel,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              maxHeight: "70%",
            }}
          >
            <Text
              style={{ color: COLORS.text, fontWeight: "700", marginBottom: 8 }}
            >
              Map column “{editingColumn}”
            </Text>
            <ScrollView>
              {(fields.data ?? []).map((field) => (
                <Pressable
                  key={field.key}
                  onPress={() => changeMapping(field.key)}
                  style={{
                    paddingVertical: 9,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.border,
                  }}
                >
                  <Text style={{ color: COLORS.text, fontSize: UI.small }}>
                    {field.label}
                  </Text>
                  <Text style={{ color: COLORS.textFaint, fontSize: 11 }}>
                    {field.expected}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => changeMapping("ignore")}
                style={{ paddingVertical: 9 }}
              >
                <Text style={{ color: COLORS.moreData, fontSize: UI.small }}>
                  Do not import this column
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
