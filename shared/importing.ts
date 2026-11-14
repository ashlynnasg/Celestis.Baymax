/**
 * Data Integration — CSV/JSON parsing, column suggestion and validation.
 *
 * Uploaded content is treated as untrusted text: nothing is executed, no server path is accepted,
 * and exported CSV is guarded against spreadsheet formula injection.
 */
import { METRICS, METRIC_KEYS, type MetricKey } from "./constants";
import type {
  ImportColumnMapping,
  ImportFieldKey,
  ImportPreviewRow,
  ImportRowError,
  ObservationInput,
} from "./domain";

export const IMPORT_LIMITS = {
  maxBytes: 2_000_000,
  maxRows: 2000,
  previewRows: 25,
};

export type ParsedTable = {
  columns: string[];
  rows: Record<string, string>[];
  format: "csv" | "json";
  recordPath: string | null;
  encodingNote: string;
};

export type ParseResult =
  | { ok: true; table: ParsedTable; warnings: string[] }
  | { ok: false; error: string; detail: string };

export type ValidatedRow = {
  row: number;
  observation: ObservationInput;
  key: string;
};

export type ValidationResult = {
  rows: ValidatedRow[];
  preview: ImportPreviewRow[];
  errors: ImportRowError[];
  duplicates: ImportRowError[];
  warnings: string[];
  notes: string[];
  groupCount: number;
};

const UNIT_ALIASES: Record<string, { metric: MetricKey[]; factor: number; offset?: number }> = {
  bpm: { metric: ["heartRate"], factor: 1 },
  "beats/min": { metric: ["heartRate"], factor: 1 },
  "1/min": { metric: ["heartRate"], factor: 1 },
  "%": { metric: ["oxygenSaturation"], factor: 1 },
  percent: { metric: ["oxygenSaturation"], factor: 1 },
  pct: { metric: ["oxygenSaturation"], factor: 1 },
  mmhg: { metric: ["systolicBloodPressure", "diastolicBloodPressure"], factor: 1 },
  h: { metric: ["sleepDuration"], factor: 1 },
  hr: { metric: ["sleepDuration"], factor: 1 },
  hours: { metric: ["sleepDuration"], factor: 1 },
  min_day: { metric: ["exerciseDuration"], factor: 1 },
  "min/day": { metric: ["exerciseDuration"], factor: 1 },
  score: { metric: ["stress", "fatigue"], factor: 1 },
  "0-10": { metric: ["stress", "fatigue"], factor: 1 },
  c: { metric: ["bodyTemperature"], factor: 1 },
  "°c": { metric: ["bodyTemperature"], factor: 1 },
  f: { metric: ["bodyTemperature"], factor: 1, offset: 32 },
  "°f": { metric: ["bodyTemperature"], factor: 1, offset: 32 },
};

export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}-${text.length}`;
}

/* ------------------------------------------------------------------ parsing */

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      inQuotes = true;
      continue;
    }
    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (character === "\r") continue;
    field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((items) => items.some((item) => item.trim().length > 0));
}

function readPath(value: unknown, path: string): unknown {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((current, key) => {
      if (current === null || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[key];
    }, value);
}

export function parseImportText(params: {
  text: string;
  format: "csv" | "json";
  recordPath?: string | null;
}): ParseResult {
  const { text, format } = params;
  if (text.trim().length === 0) {
    return { ok: false, error: "Empty input", detail: "Paste CSV or JSON content, or load one of the examples." };
  }
  if (text.length > IMPORT_LIMITS.maxBytes) {
    return {
      ok: false,
      error: "File too large",
      detail: `The demonstration importer accepts up to ${IMPORT_LIMITS.maxBytes.toLocaleString()} characters. Split the file and import in batches.`,
    };
  }

  if (format === "csv") {
    const rows = parseCsvRows(text);
    if (rows.length < 2) {
      return {
        ok: false,
        error: "Not enough rows",
        detail: "A CSV import needs a header row and at least one data row.",
      };
    }
    const columns = rows[0].map((column) => column.trim());
    if (new Set(columns).size !== columns.length) {
      return {
        ok: false,
        error: "Duplicate column names",
        detail: `Header: ${columns.join(", ")}. Rename duplicated columns before importing.`,
      };
    }
    const dataRows = rows.slice(1);
    if (dataRows.length > IMPORT_LIMITS.maxRows) {
      return {
        ok: false,
        error: "Too many rows",
        detail: `This demonstration accepts ${IMPORT_LIMITS.maxRows} rows per batch; the file has ${dataRows.length}.`,
      };
    }
    const records = dataRows.map((items) => {
      const record: Record<string, string> = {};
      columns.forEach((column, index) => {
        record[column] = (items[index] ?? "").trim();
      });
      return record;
    });
    return {
      ok: true,
      table: {
        columns,
        rows: records,
        format: "csv",
        recordPath: null,
        encodingNote: "Parsed as UTF-8 CSV with a header row.",
      },
      warnings: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      error: "Invalid JSON",
      detail: error instanceof Error ? error.message : "The text could not be parsed as JSON.",
    };
  }

  const recordPath = params.recordPath?.trim() || null;
  let candidate: unknown = parsed;
  if (recordPath) {
    candidate = readPath(parsed, recordPath);
    if (candidate === undefined) {
      return {
        ok: false,
        error: "Record path not found",
        detail: `No value exists at "${recordPath}". Choose the path that contains the array of records, or write an adapter for this structure.`,
      };
    }
  } else if (!Array.isArray(parsed) && parsed !== null && typeof parsed === "object") {
    const arrays = Object.entries(parsed as Record<string, unknown>).filter(([, value]) => Array.isArray(value));
    if (arrays.length === 0) {
      return {
        ok: false,
        error: "Nested JSON without a record array",
        detail:
          "Top-level JSON is an object and contains no array of records. Enter a record path such as data.observations, or provide an adapter — the importer will not guess.",
      };
    }
  }

  if (!Array.isArray(candidate)) {
    return {
      ok: false,
      error: "Records must be an array",
      detail: recordPath
        ? `"${recordPath}" resolves to ${typeof candidate}, not an array.`
        : "The JSON root is not an array of records.",
    };
  }
  if (candidate.length === 0) {
    return { ok: false, error: "Empty array", detail: "The JSON array contains no records." };
  }
  if (candidate.length > IMPORT_LIMITS.maxRows) {
    return {
      ok: false,
      error: "Too many records",
      detail: `This demonstration accepts ${IMPORT_LIMITS.maxRows} records per batch; the array has ${candidate.length}.`,
    };
  }

  const columns: string[] = [];
  const records: Record<string, string>[] = [];
  candidate.forEach((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      records.push({ value: String(item) });
      if (!columns.includes("value")) columns.push("value");
      return;
    }
    const record: Record<string, string> = {};
    Object.entries(item as Record<string, unknown>).forEach(([key, value]) => {
      if (!columns.includes(key)) columns.push(key);
      record[key] =
        value === null || value === undefined
          ? ""
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
    });
    records.push(record);
  });

  return {
    ok: true,
    table: {
      columns,
      rows: records,
      format: "json",
      recordPath,
      encodingNote: `Parsed as JSON${recordPath ? ` using record path "${recordPath}"` : ""}.`,
    },
    warnings: [],
  };
}

/* ---------------------------------------------------------------- suggestion */

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const IDENTITY_KEYS = {
  crewId: ["crewid", "astronautid", "subjectid", "participantid", "id"],
  crewName: ["crewname", "astronaut", "astronautname", "name", "subject", "participant", "crew"],
};

const FIELD_KEYS: { field: ImportFieldKey; keys: string[] }[] = [
  { field: "observedAt", keys: ["observedat", "timestamp", "datetime", "time", "date", "utc", "measuredat"] },
  { field: "unit", keys: ["unit", "units", "uom"] },
  { field: "context", keys: ["context", "condition", "state", "measurementcontext"] },
  { field: "sourceLabel", keys: ["source", "sourcelabel", "origin", "dataset"] },
  { field: "note", keys: ["note", "notes", "comment", "remarks"] },
];

export function suggestMapping(columns: string[]): ImportColumnMapping[] {
  return columns.map((column) => {
    const key = normalise(column);
    const identityMatch =
      IDENTITY_KEYS.crewId.includes(key) || IDENTITY_KEYS.crewName.includes(key)
        ? { field: (IDENTITY_KEYS.crewId.includes(key) ? "crewId" : "crewName") as ImportFieldKey, reason: "Column matches an astronaut identity field." }
        : null;
    if (identityMatch) {
      return { column, field: identityMatch.field, unit: null, confidence: "suggested", reason: identityMatch.reason };
    }
    const fieldMatch = FIELD_KEYS.find((item) => item.keys.includes(key));
    if (fieldMatch) {
      return {
        column,
        field: fieldMatch.field,
        unit: null,
        confidence: "suggested",
        reason: `Column name maps to ${fieldMatch.field}.`,
      };
    }
    const metric = METRIC_KEYS.find((metricKey) => {
      const aliases = [normalise(metricKey), ...METRICS[metricKey].importAliases.map(normalise)];
      return aliases.includes(key) || aliases.some((alias) => key === alias || key.startsWith(alias));
    });
    if (metric) {
      return {
        column,
        field: metric,
        unit: METRICS[metric].unit || null,
        confidence: "suggested",
        reason: `Recognised as ${METRICS[metric].label.toLowerCase()}.`,
      };
    }
    return {
      column,
      field: "ignore",
      unit: null,
      confidence: "unmapped",
      reason: "No supported field matches this column. It will be kept in the import summary but not converted.",
    };
  });
}

/* ---------------------------------------------------------------- validation */

function conversionFor(metric: MetricKey, unit: string): { factor: number; offset: number } | null {
  const key = unit.trim().toLowerCase();
  if (!key) return { factor: 1, offset: 0 };
  if (metric === "sleepDuration" && (key === "min" || key === "minutes")) return { factor: 1 / 60, offset: 0 };
  if (metric === "exerciseDuration" && (key === "h" || key === "hr" || key === "hours")) {
    return { factor: 60, offset: 0 };
  }
  if (metric === "oxygenSaturation" && key === "fraction") return { factor: 100, offset: 0 };
  const alias = UNIT_ALIASES[key];
  if (alias) {
    if (!alias.metric.includes(metric)) return null;
    const offset = alias.offset ?? 0;
    return { factor: alias.factor, offset };
  }
  if (key === METRICS[metric].unit.toLowerCase()) return { factor: 1, offset: 0 };
  if (metric === "bodyTemperature" && key === "fahrenheit") return { factor: 1, offset: 32 };
  if (metric === "sleepDuration" && (key === "minutes" || key === "min")) return { factor: 1 / 60, offset: 0 };
  return null;
}

function parseTimestamp(raw: string): { iso: string; note: string } | { error: string } {
  const value = raw.trim();
  if (!value) return { error: "Empty timestamp." };
  if (/^\d{10}$/.test(value)) {
    return { iso: new Date(Number(value) * 1000).toISOString(), note: "Interpreted as a Unix timestamp in seconds (UTC)." };
  }
  if (/^\d{13}$/.test(value)) {
    return { iso: new Date(Number(value)).toISOString(), note: "Interpreted as a Unix timestamp in milliseconds (UTC)." };
  }
  const normalised = value.replace(" ", "T");
  const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(normalised);
  const candidate = hasZone ? normalised : `${normalised}Z`;
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    return { error: `"${raw}" is not a valid date. Expected ISO 8601, e.g. 2026-11-04T07:30:00Z.` };
  }
  if (!hasZone) {
    return { iso: date.toISOString(), note: "No timezone supplied; treated as UTC." };
  }
  return { iso: date.toISOString(), note: "Timezone supplied; stored in UTC." };
}

function choiceValue(metric: MetricKey, raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (metric !== "visionChange") return null;
  if (["no_change", "no change", "no", "none", "false", "0"].includes(value)) return "no_change";
  if (["changes_reported", "change", "yes", "true", "1", "reported"].includes(value)) return "changes_reported";
  return null;
}

function observationKey(crewId: string, metric: MetricKey, observedAt: string, value: string): string {
  return `${crewId}|${metric}|${observedAt}|${value}`;
}

export function validateImport(params: {
  table: ParsedTable;
  mapping: ImportColumnMapping[];
  crew: { id: string; displayName: string; callSign: string }[];
  existingKeys: string[];
  sourceLabel: string;
}): ValidationResult {
  const { table, mapping, crew, existingKeys, sourceLabel } = params;
  const errors: ImportRowError[] = [];
  const duplicates: ImportRowError[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const rows: ValidatedRow[] = [];
  const preview: ImportPreviewRow[] = [];

  const metricColumns = mapping.filter(
    (item) => item.field !== "ignore" && item.field !== "unit" && item.field in METRICS,
  ) as (ImportColumnMapping & { field: MetricKey })[];

  const identityColumn = mapping.find((item) => item.field === "crewId" || item.field === "crewName");
  const timeColumn = mapping.find((item) => item.field === "observedAt");
  const unitColumn = mapping.find((item) => item.field === "unit");
  const contextColumn = mapping.find((item) => item.field === "context");
  const sourceColumn = mapping.find((item) => item.field === "sourceLabel");
  const noteColumn = mapping.find((item) => item.field === "note");

  if (!identityColumn) {
    errors.push({
      row: 0,
      column: null,
      field: null,
      code: "required",
      message: "No astronaut identity column is mapped.",
      expected: "Map a crew_id or astronaut name column before validating.",
    });
  }
  if (!timeColumn) {
    errors.push({
      row: 0,
      column: null,
      field: null,
      code: "required",
      message: "No observation timestamp column is mapped.",
      expected: "Map an observed_at column before validating.",
    });
  }
  if (metricColumns.length === 0) {
    const longFormat = table.columns.some((column) => normalise(column) === "metric") &&
      table.columns.some((column) => normalise(column) === "value");
    errors.push({
      row: 0,
      column: null,
      field: null,
      code: "unsupported",
      message: longFormat
        ? "This looks like a long-format table (metric/value columns)."
        : "No measurement column is mapped.",
      expected: longFormat
        ? "Wide format is supported directly: one column per measurement. Write an adapter for long format — the importer will not silently reshape it."
        : "Map at least one measurement column such as heart_rate or spo2.",
    });
  }

  if (errors.some((error) => error.row === 0 && error.code === "required")) {
    return { rows, preview, errors, duplicates, warnings, notes, groupCount: table.rows.length };
  }

  const seen = new Set<string>(existingKeys);
  const unmatched = mapping.filter((item) => item.field === "ignore");
  if (unmatched.length > 0) {
    notes.push(
      `Unsupported columns kept in the summary but not converted: ${unmatched.map((item) => item.column).join(", ")}.`,
    );
  }

  const crewMatcher = (record: Record<string, string>): { id: string; name: string } | null => {
    if (!identityColumn) return null;
    const raw = (record[identityColumn.column] ?? "").trim();
    if (!raw) return null;
    const byId = crew.find((member) => member.id.toLowerCase() === raw.toLowerCase());
    if (byId) return { id: byId.id, name: byId.displayName };
    const byName = crew.find(
      (member) =>
        member.displayName.toLowerCase() === raw.toLowerCase() ||
        member.callSign.toLowerCase() === raw.toLowerCase(),
    );
    if (byName) return { id: byName.id, name: byName.displayName };
    return null;
  };

  table.rows.forEach((record, index) => {
    const rowNumber = index + 1;
    const member = crewMatcher(record);
    const rawTime = timeColumn ? (record[timeColumn.column] ?? "") : "";
    const timestamp = parseTimestamp(rawTime);
    const rowContext = contextColumn ? (record[contextColumn.column] ?? "").trim() || null : null;
    const rowUnit = unitColumn ? (record[unitColumn.column] ?? "").trim() : "";
    const rowSource = sourceColumn ? (record[sourceColumn.column] ?? "").trim() : "";
    const rowNote = noteColumn ? (record[noteColumn.column] ?? "").trim() : "";

    if (!member) {
      errors.push({
        row: rowNumber,
        column: identityColumn?.column ?? null,
        field: identityColumn ? (identityColumn.field === "ignore" ? null : identityColumn.field) : null,
        code: "identity",
        message: `"${identityColumn ? record[identityColumn.column] : ""}" does not match a fictional crew member.`,
        expected: `Use a crew id or name: ${crew.map((item) => `${item.id} (${item.displayName})`).join(", ")}.`,
      });
    }
    if ("error" in timestamp) {
      errors.push({
        row: rowNumber,
        column: timeColumn?.column ?? null,
        field: "observedAt",
        code: "timestamp",
        message: timestamp.error,
        expected: "ISO 8601 timestamp such as 2026-11-04T07:30:00Z.",
      });
    } else if (timestamp.note.includes("treated as UTC") && !warnings.includes("Some timestamps had no timezone and were treated as UTC.")) {
      warnings.push("Some timestamps had no timezone and were treated as UTC.");
    }

    metricColumns.forEach((mappingItem) => {
      const metric = mappingItem.field;
      const definition = METRICS[metric];
      const raw = (record[mappingItem.column] ?? "").trim();
      if (raw.length === 0) return;
      const unit = (rowUnit || mappingItem.unit || definition.unit || "").trim();
      const conversion = conversionFor(metric, unit);
      if (!conversion) {
        errors.push({
          row: rowNumber,
          column: mappingItem.column,
          field: metric,
          code: "unit",
          message: `Unsupported unit "${unit}" for ${definition.label.toLowerCase()}.`,
          expected: `Recognised units: ${definition.unit || "n/a"}.`,
        });
        return;
      }
      if (!member || "error" in timestamp) return;

      let numericValue: number | null = null;
      let textValue: string | null = null;

      if (definition.kind === "choice") {
        const choice = choiceValue(metric, raw);
        if (!choice) {
          errors.push({
            row: rowNumber,
            column: mappingItem.column,
            field: metric,
            code: "enum",
            message: `"${raw}" is not a recognised vision report.`,
            expected: "Use no_change / no change reported, or changes_reported / change reported.",
          });
          return;
        }
        textValue = choice;
      } else {
        const parsed = Number(raw.replace(",", "."));
        if (!Number.isFinite(parsed)) {
          errors.push({
            row: rowNumber,
            column: mappingItem.column,
            field: metric,
            code: "type",
            message: `"${raw}" is not a number.`,
            expected: `A numeric value in ${definition.unit || "the metric's unit"}.`,
          });
          return;
        }
        const converted =
          metric === "bodyTemperature" && conversion.offset
            ? (parsed - conversion.offset) * (5 / 9)
            : parsed * conversion.factor;
        const rounded = Math.round(converted * Math.pow(10, definition.decimals)) / Math.pow(10, definition.decimals);
        if (definition.min !== null && rounded < definition.min) {
          errors.push({
            row: rowNumber,
            column: mappingItem.column,
            field: metric,
            code: "range",
            message: `${rounded} is below the supported minimum for ${definition.label.toLowerCase()}.`,
            expected: `Between ${definition.min} and ${definition.max} ${definition.unit}.`,
          });
          return;
        }
        if (definition.max !== null && rounded > definition.max) {
          errors.push({
            row: rowNumber,
            column: mappingItem.column,
            field: metric,
            code: "range",
            message: `${rounded} is above the supported maximum for ${definition.label.toLowerCase()}.`,
            expected: `Between ${definition.min} and ${definition.max} ${definition.unit}.`,
          });
          return;
        }
        numericValue = rounded;
      }

      const observedAt = (timestamp as { iso: string }).iso;
      const key = observationKey(member.id, metric, observedAt, numericValue !== null ? String(numericValue) : String(textValue));
      const duplicateError = seen.has(key)
        ? {
            row: rowNumber,
            column: mappingItem.column,
            field: metric,
            code: "duplicate" as const,
            message: "This value already exists (same astronaut, metric, timestamp and value).",
            expected: "Remove the duplicate row or leave it out of the batch.",
          }
        : null;

      if (duplicateError) {
        duplicates.push(duplicateError);
        if (preview.length < IMPORT_LIMITS.previewRows) {
          preview.push({
            row: rowNumber,
            crewId: member.id,
            crewName: member.name,
            metric,
            value: raw,
            unit: definition.unit,
            observedAt,
            context: rowContext,
            status: "duplicate",
          });
        }
        return;
      }

      seen.add(key);
      const observation: ObservationInput = {
        crewId: member.id,
        metric,
        numericValue,
        textValue,
        unit: definition.unit,
        context:
          metric === "heartRate" || metric === "oxygenSaturation" || metric === "systolicBloodPressure" || metric === "diastolicBloodPressure"
            ? rowContext === "rest" || rowContext === "after_exercise" || rowContext === "unknown"
              ? rowContext
              : "unknown"
            : null,
        observedAt,
        sourceKind: "import",
        sourceLabel: rowSource ? `${sourceLabel} — ${rowSource}` : sourceLabel,
        streamId: null,
        importBatchId: null,
        note: rowNote || null,
      };
      rows.push({ row: rowNumber, observation, key });
      if (preview.length < IMPORT_LIMITS.previewRows) {
        preview.push({
          row: rowNumber,
          crewId: member.id,
          crewName: member.name,
          metric,
          value: definition.kind === "choice" ? (textValue === "no_change" ? "No vision change reported" : "Vision changes reported") : raw,
          unit: definition.unit,
          observedAt,
          context: rowContext,
          status: "valid",
        });
      }
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push({
      row: 0,
      column: null,
      field: null,
      code: "required",
      message: "No measurement cells contained values.",
      expected: "Fill at least one mapped measurement column per row.",
    });
  }

  return {
    rows,
    preview,
    errors,
    duplicates,
    warnings,
    notes,
    groupCount: table.rows.length,
  };
}

/* ------------------------------------------------------------------- export */

export function sanitiseCsvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function buildValidationReportCsv(params: {
  batchId: string;
  sourceTitle: string;
  errors: ImportRowError[];
  warnings: string[];
}): string {
  const header = ["batch_id", "source_title", "row", "column", "field", "code", "message", "expected"].map(sanitiseCsvCell).join(",");
  const lines = params.errors.map((error) =>
    [
      params.batchId,
      params.sourceTitle,
      String(error.row),
      error.column ?? "",
      error.field ?? "",
      error.code,
      error.message,
      error.expected,
    ]
      .map((value) => sanitiseCsvCell(String(value)))
      .join(","),
  );
  const warningLines = params.warnings.map((warning) =>
    [params.batchId, params.sourceTitle, "—", "", "", "warning", warning, ""].map((value) => sanitiseCsvCell(String(value))).join(","),
  );
  return [header, ...lines, ...warningLines].join("\n");
}

export function buildObservationsCsv(rows: { crewName: string; observation: ObservationInput }[]): string {
  const header = ["crew", "metric", "value", "unit", "context", "observed_at", "source", "stream", "note"].map(sanitiseCsvCell).join(",");
  const lines = rows.map((row) =>
    [
      row.crewName,
      row.observation.metric,
      row.observation.numericValue !== null ? String(row.observation.numericValue) : row.observation.textValue ?? "",
      row.observation.unit,
      row.observation.context ?? "",
      row.observation.observedAt,
      row.observation.sourceLabel,
      row.observation.streamId ?? "baseline",
      row.observation.note ?? "",
    ]
      .map((value) => sanitiseCsvCell(String(value)))
      .join(","),
  );
  return [header, ...lines].join("\n");
}
