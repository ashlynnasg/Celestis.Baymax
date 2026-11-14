import { parseImportText } from "./importing";
import { missionLogInputSchema, type MissionLogInput } from "./mission-context";

/** Explicit flat adapter for exposure/context/cabin logs; the vital-sign importer stays flexible. */
export function previewContextImport(params: {
  text: string;
  format: "csv" | "json";
  crewId: string;
  sourceTitle: string;
  sourceRef: string;
}) {
  const parsed = parseImportText({ text: params.text, format: params.format });
  if (!parsed.ok)
    return {
      records: [] as MissionLogInput[],
      errors: [{ row: 0, message: `${parsed.error}: ${parsed.detail}` }],
    };
  const records: MissionLogInput[] = [];
  const errors: { row: number; message: string }[] = [];
  const fields = new Set([
    "crewId",
    "kind",
    "observedAt",
    "sourceKind",
    "note",
    "phase",
    "gravity",
    "location",
    "sleepQuality",
    "scheduleChanged",
    "bedtime",
    "wakeTime",
    "exerciseType",
    "plannedSessionCompleted",
    "symptom",
    "symptomOnset",
    "symptomChange",
    "startAt",
    "quantity",
    "value",
    "unit",
    "component",
    "scope",
    "instrument",
    "temperatureC",
    "pressureKpa",
    "co2Ppm",
  ]);
  if (
    new Set(parsed.table.columns).size !== parsed.table.columns.length ||
    parsed.table.columns.some((key) => !key.trim())
  )
    errors.push({
      row: 0,
      message:
        "Duplicate or blank column names are not supported. Give each field a unique name.",
    });
  const unsupported = parsed.table.columns.filter((key) => !fields.has(key));
  if (unsupported.length)
    errors.push({
      row: 0,
      message: `Unsupported columns: ${unsupported.join(", ")}. Use the documented flat adapter; no fields are silently discarded.`,
    });
  const number = (s: string | undefined) => (!s?.trim() ? null : Number(s));
  parsed.table.rows.forEach((r, index) => {
    if (r.crewId && r.crewId !== params.crewId) {
      errors.push({
        row: index + 2,
        message:
          "Crew ID differs from the selected astronaut. Import each astronaut separately.",
      });
      return;
    }
    if (r.sourceKind && !["simulated", "import"].includes(r.sourceKind)) {
      errors.push({
        row: index + 2,
        message: "Imported sourceKind must be import or simulated.",
      });
      return;
    }
    const base = { kind: r.kind, location: r.location ?? "" };
    const data =
      r.kind === "radiation"
        ? {
            ...base,
            startAt: r.startAt,
            quantity: r.quantity,
            value: number(r.value),
            unit: r.unit,
            component: r.component || "unknown",
            scope: r.scope || "unknown",
            instrument: r.instrument || "",
          }
        : r.kind === "cabin"
          ? {
              ...base,
              temperatureC: number(r.temperatureC),
              pressureKpa: number(r.pressureKpa),
              co2Ppm: number(r.co2Ppm),
            }
          : {
              ...base,
              phase: r.phase || "unknown",
              gravity: r.gravity || "unknown",
              sleepQuality: r.sleepQuality || "unknown",
              scheduleChanged: r.scheduleChanged || "unknown",
              bedtime: r.bedtime || null,
              wakeTime: r.wakeTime || null,
              exerciseType: r.exerciseType || "",
              plannedSessionCompleted: r.plannedSessionCompleted || "unknown",
              symptom: r.symptom || "",
              symptomOnset: r.symptomOnset || null,
              symptomChange: r.symptomChange || "unknown",
            };
    const result = missionLogInputSchema.safeParse({
      crewId: params.crewId,
      observedAt: r.observedAt,
      sourceKind: r.sourceKind === "simulated" ? "simulated" : "import",
      sourceLabel: params.sourceTitle,
      sourceRef: params.sourceRef,
      note: r.note || "",
      data,
    });
    if (!result.success)
      errors.push({
        row: index + 2,
        message: result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    else records.push(result.data);
  });
  return { records, errors };
}
