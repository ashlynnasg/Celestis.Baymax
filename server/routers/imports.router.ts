import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DOMAINS, METRICS, type MetricKey } from "../../shared/constants";
import {
  buildValidationReportCsv,
  hashText,
  parseImportText,
  suggestMapping,
  validateImport,
} from "../../shared/importing";
import { publicProcedure, router } from "../_core/trpc";
import { buildBundle, syncCrewCases } from "../assessment";
import {
  addCaseEvent,
  createImportBatch,
  getImportBatch,
  getImportNormalizedRows,
  insertObservation,
  listCases,
  listCrew,
  listImportBatches,
  observationKeysFor,
  updateImportBatch,
} from "../db";
import type { ImportColumnMapping, ImportFieldKey } from "../types";
import { firstZodMessage, importPreviewSchema } from "../validation";

export const EXAMPLE_VALID_CSV = `crew_id,observed_at,heart_rate,spo2,sleep_hours,stress,fatigue,exercise_minutes,vision,context,source
crew-01,2026-11-09T07:30:00Z,71,98,7.5,3,3,45,,rest,Crew daily log (example)
crew-01,2026-11-10T07:30:00Z,74,97,7.2,4,4,40,,rest,Crew daily log (example)
crew-02,2026-11-10T07:30:00Z,83,97,5.4,6,7,15,,rest,Crew daily log (example)
crew-02,2026-11-10T08:00:00Z,,,,,,,no_change,,Crew vision check (example)`;

export const EXAMPLE_INVALID_CSV = `crew_id,observed_at,heart_rate,spo2,sleep_hours,vision,context
crew-99,2026-11-10T07:30:00Z,72,98,7.4,,rest
crew-01,10/11/2026 7:30,74,101,7.2,,rest
crew-02,2026-11-10T07:30:00Z,abc,96,25,maybe,rest
crew-03,2026-11-10T07:30:00Z,118,93,6.8,no_change,lying down`;

export const EXAMPLE_NESTED_JSON = `{
  "mission": "Lunar Gateway demonstration",
  "records": [
    {
      "crew_name": "Maya Chen",
      "observed_at": "2026-11-10T07:30:00Z",
      "heart_rate": 72,
      "spo2": 98,
      "sleep_hours": 7.4,
      "stress": 3,
      "fatigue": 3,
      "exercise_minutes": 45,
      "context": "rest"
    },
    {
      "crew_name": "Diego Ramos",
      "observed_at": "2026-11-10T07:30:00Z",
      "heart_rate": 84,
      "spo2": 97,
      "sleep_hours": 5.2,
      "stress": 6,
      "fatigue": 7,
      "exercise_minutes": 15,
      "context": "rest"
    }
  ]
}`;

export const EXAMPLE_LONG_FORMAT = `crew_id,observed_at,metric,value,unit
crew-01,2026-11-10T07:30:00Z,heart_rate,72,bpm
crew-01,2026-11-10T07:30:00Z,sleep_hours,7.4,h`;

function examplePayload(kind: "valid" | "invalid" | "nested" | "long") {
  switch (kind) {
    case "valid":
      return {
        filename: "example_valid_wide.csv",
        format: "csv" as const,
        text: EXAMPLE_VALID_CSV,
        recordPath: null,
        note: "Wide format: one column per measurement. Leave the unit column out to use each metric's canonical unit.",
      };
    case "invalid":
      return {
        filename: "example_invalid_rows.csv",
        format: "csv" as const,
        text: EXAMPLE_INVALID_CSV,
        recordPath: null,
        note: "Four common failures: unknown astronaut, unparseable timestamp, out-of-range values, unsupported vision wording, and an unsupported context.",
      };
    case "nested":
      return {
        filename: "example_nested.json",
        format: "json" as const,
        text: EXAMPLE_NESTED_JSON,
        recordPath: "records",
        note: "Nested JSON needs a record path. Enter records in the record-path field.",
      };
    default:
      return {
        filename: "example_long_format.csv",
        format: "csv" as const,
        text: EXAMPLE_LONG_FORMAT,
        recordPath: null,
        note: "Long format (metric/value columns) is not reshaped silently; the importer explains the adapter requirement instead.",
      };
  }
}

async function existingKeys(): Promise<string[]> {
  const crew = await listCrew(true);
  const keys: string[] = [];
  for (const member of crew) {
    keys.push(...(await observationKeysFor(member.id)));
  }
  return keys;
}

export const importsRouter = router({
  example: publicProcedure
    .input(z.object({ kind: z.enum(["valid", "invalid", "nested", "long"]) }))
    .query(({ input }) => examplePayload(input.kind)),

  preview: publicProcedure.input(importPreviewSchema).mutation(async ({ input }) => {
    const parsedInput = importPreviewSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: firstZodMessage(parsedInput.error) });
    }
    const parsed = parseImportText({
      text: input.text,
      format: input.format,
      recordPath: input.recordPath ?? null,
    });
    if (!parsed.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${parsed.error}: ${parsed.detail}` });
    }

    const mapping: ImportColumnMapping[] = (input.mapping as ImportColumnMapping[] | undefined)?.length
      ? (input.mapping as ImportColumnMapping[])
      : suggestMapping(parsed.table.columns);

    const crew = await listCrew(true);
    const keys = await existingKeys();
    const validation = validateImport({
      table: parsed.table,
      mapping,
      crew: crew.map((member) => ({
        id: member.id,
        displayName: member.displayName,
        callSign: member.callSign,
      })),
      existingKeys: keys,
      sourceLabel: input.sourceTitle,
    });

    const batch = await createImportBatch({
      sourceTitle: input.sourceTitle,
      sourceRef: input.sourceRef?.trim() || (input.format === "csv" ? "Pasted CSV" : "Pasted JSON"),
      format: input.format,
      status: "preview",
      rowCount: validation.groupCount,
      validCount: validation.rows.length,
      errorCount: validation.errors.length,
      duplicateCount: validation.duplicates.length,
      mapping,
      originalColumns: parsed.table.columns,
      recordPath: parsed.table.recordPath,
      errors: [...validation.errors, ...validation.duplicates],
      preview: validation.preview,
      notes: [...validation.warnings, ...validation.notes, parsed.table.encodingNote],
      checksum: hashText(input.text),
      allowPartial: false,
      normalizedRows: validation.rows,
    });

    return {
      batch,
      columns: parsed.table.columns,
      mapping,
      warnings: validation.warnings,
      notes: validation.notes,
      encodingNote: parsed.table.encodingNote,
    };
  }),

  commit: publicProcedure
    .input(
      z.object({
        batchId: z.string().min(1),
        allowPartial: z.boolean().optional(),
        allowDuplicateBatch: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const batch = await getImportBatch(input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Import batch not found." });
      if (batch.status === "committed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Batch ${batch.id} was already committed. Repeated import is refused to protect the record.`,
        });
      }

      const allowPartial = input.allowPartial ?? false;
      if (batch.errorCount > 0 && !allowPartial) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This batch has ${batch.errorCount} validation issue(s). Fix the rows, or explicitly choose "Commit validated rows only".`,
        });
      }

      const history = await listImportBatches();
      const duplicateBatch = history.find(
        (item) => item.id !== batch.id && item.status === "committed" && item.checksum === batch.checksum,
      );
      if (duplicateBatch && !input.allowDuplicateBatch) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This exact content was already committed as ${duplicateBatch.id}. Re-importing is blocked; identical values are also skipped row by row.`,
        });
      }

      const normalized = await getImportNormalizedRows(batch.id);
      const known = new Set(await existingKeys());
      let inserted = 0;
      let skipped = 0;
      const touchedCrew = new Set<string>();

      for (const row of normalized) {
        if (known.has(row.key)) {
          skipped += 1;
          continue;
        }
        await insertObservation({
          crewId: row.observation.crewId,
          metric: row.observation.metric as MetricKey,
          numericValue: row.observation.numericValue,
          textValue: row.observation.textValue,
          unit: row.observation.unit,
          context: row.observation.context,
          observedAt: row.observation.observedAt,
          sourceKind: "import",
          sourceLabel: `${batch.sourceTitle} (imported)`,
          streamId: null,
          importBatchId: batch.id,
          note: row.observation.note,
          clientRequestId: null,
        });
        known.add(row.key);
        inserted += 1;
        touchedCrew.add(row.observation.crewId);
      }

      for (const crewId of touchedCrew) {
        const openCases = await listCases({ crewId });
        const affectedMetrics = new Set(
          normalized.filter((row) => row.observation.crewId === crewId).map((row) => row.observation.metric),
        );
        const affectedDomains = Object.values(DOMAINS).filter((domain) =>
          domain.metrics.some((metric) => affectedMetrics.has(metric)),
        );
        for (const domain of affectedDomains) {
          const openCase = openCases.find((item) => item.domain === domain.key && item.status !== "archived");
          if (!openCase) continue;
          await addCaseEvent({
            caseId: openCase.id,
            kind: "observation_added",
            title: `Imported observations: ${batch.sourceTitle}`,
            body: `${inserted} imported value(s) from batch ${batch.id} affect this domain. Source: ${batch.sourceRef}.`,
            actor: "crew_mode",
            dedupeKey: `import:${batch.id}:${crewId}:${domain.key}`,
            data: { batchId: batch.id, domain: domain.key },
          });
        }
        const bundle = await buildBundle(crewId, { withCaseLinks: false });
        await syncCrewCases(crewId, bundle);
      }

      await updateImportBatch(batch.id, {
        status: "committed",
        committedCount: inserted,
        allowPartial,
      });

      const refreshed = await getImportBatch(batch.id);
      return {
        batch: refreshed,
        inserted,
        skippedDuplicates: skipped,
        affectedCrew: [...touchedCrew],
      };
    }),

  report: publicProcedure.input(z.object({ batchId: z.string().min(1) })).query(async ({ input }) => {
    const batch = await getImportBatch(input.batchId);
    if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Import batch not found." });
    const csv = buildValidationReportCsv({
      batchId: batch.id,
      sourceTitle: batch.sourceTitle,
      errors: batch.errors,
      warnings: batch.notes,
    });
    return { filename: `validation-report-${batch.id}.csv`, csv };
  }),

  list: publicProcedure.query(() => listImportBatches()),

  get: publicProcedure.input(z.object({ batchId: z.string().min(1) })).query(async ({ input }) => {
    const batch = await getImportBatch(input.batchId);
    if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Import batch not found." });
    return batch;
  }),

  fields: publicProcedure.query(() => {
    const fields: { key: ImportFieldKey; label: string; expected: string }[] = [
      { key: "crewId", label: "Astronaut id", expected: "crew-01 … crew-06" },
      { key: "crewName", label: "Astronaut name", expected: "Display name or call sign" },
      { key: "observedAt", label: "Observation time", expected: "ISO 8601, e.g. 2026-11-04T07:30:00Z" },
      { key: "unit", label: "Unit", expected: "e.g. bpm, %, h, mmHg, min/day" },
      { key: "context", label: "Context", expected: "rest | after_exercise | unknown" },
      { key: "sourceLabel", label: "Source", expected: "Free text origin of the row" },
      { key: "note", label: "Note", expected: "Free text caveat" },
    ];
    const metrics = (Object.keys(METRICS) as MetricKey[]).map((key) => ({
      key: key as ImportFieldKey,
      label: METRICS[key].label,
      expected:
        METRICS[key].kind === "choice"
          ? (METRICS[key].choices ?? []).map((choice) => choice.value).join(" | ")
          : `${METRICS[key].min}–${METRICS[key].max} ${METRICS[key].unit}`,
    }));
    return [...fields, ...metrics];
  }),
});
