import { z } from "zod";
import type {
  AssessmentBundle,
  DomainAssessment,
  MissionSettings,
} from "./domain";
import type { DomainKey, ReferenceKey } from "./constants";

export const CONTEXT_VERSION = "space-context-1.0.0";
export const CONTEXT_FRESHNESS_HOURS = 72; // demo display setting, not a clinical cadence
export const PHASES = [
  "unknown",
  "preflight",
  "transit",
  "orbital",
  "surface",
  "recovery",
] as const;
export const GRAVITY = [
  "unknown",
  "microgravity",
  "partial_gravity",
  "earth_gravity",
] as const;
const yn = z.enum(["unknown", "yes", "no"]);
const timestamp = z
  .string()
  .refine(
    (s) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(s) && Number.isFinite(Date.parse(s)),
    "Use an ISO timestamp with a timezone, for example 2026-11-14T10:00:00Z.",
  )
  .transform((s) => new Date(s).toISOString());
const short = z.string().trim().max(160);
export const contextDataSchema = z.object({
  kind: z.literal("context"),
  phase: z.enum(PHASES),
  gravity: z.enum(GRAVITY),
  location: short,
  sleepQuality: z.enum(["unknown", "good", "fair", "poor"]),
  scheduleChanged: yn,
  bedtime: timestamp.nullable(),
  wakeTime: timestamp.nullable(),
  exerciseType: short,
  plannedSessionCompleted: yn,
  symptom: z.string().trim().max(600),
  symptomOnset: timestamp.nullable(),
  symptomChange: z.enum(["unknown", "new", "ongoing", "improving", "resolved"]),
});
export const RADIATION_UNITS = {
  absorbed_dose: ["Gy", "mGy", "uGy"],
  dose_equivalent: ["Sv", "mSv", "uSv"],
} as const;

export const radiationDataSchema = z
  .object({
    kind: z.literal("radiation"),
    startAt: timestamp,
    quantity: z.enum(["absorbed_dose", "dose_equivalent"]),
    value: z.number().finite().min(0),
    unit: z.enum(["Gy", "mGy", "uGy", "Sv", "mSv", "uSv"]),
    component: z.enum(["unknown", "neutron", "mixed"]),
    scope: z.enum(["unknown", "personal", "area"]),
    location: short.min(1),
    instrument: short,
  })
  .superRefine((record, ctx) => {
    // Units are never converted: an absorbed dose must stay in gray units and a dose equivalent in
    // sievert units. Mixing them would silently change the meaning of the recorded value.
    const allowed = RADIATION_UNITS[record.quantity] as readonly string[];
    if (!allowed.includes(record.unit)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unit"],
        message:
          record.quantity === "absorbed_dose"
            ? "Absorbed dose uses Gy, mGy or uGy. Record a dose equivalent (Sv/mSv/uSv) as a separate quantity."
            : "Dose equivalent uses Sv, mSv or uSv. Record an absorbed dose (Gy/mGy/uGy) as a separate quantity.",
      });
    }
  });
export const cabinDataSchema = z.object({
  kind: z.literal("cabin"),
  location: short.min(1),
  temperatureC: z.number().finite().nullable(),
  pressureKpa: z.number().finite().positive().nullable(),
  co2Ppm: z.number().finite().nonnegative().nullable(),
});
export const missionLogInputSchema = z
  .object({
    crewId: z.string().min(1),
    observedAt: timestamp,
    sourceKind: z.enum(["manual", "import", "simulated"]),
    sourceLabel: z.string().trim().min(2).max(160),
    sourceRef: z.string().trim().max(400).default(""),
    note: z.string().trim().max(2000).default(""),
    data: z.discriminatedUnion("kind", [
      contextDataSchema,
      radiationDataSchema,
      cabinDataSchema,
    ]),
  })
  .superRefine((item, ctx) => {
    const at = Date.parse(item.observedAt);
    if (at > Date.now() + 300_000)
      ctx.addIssue({
        code: "custom",
        path: ["observedAt"],
        message: "Observation time cannot be in the future.",
      });
    const data = item.data;
    if (data.kind === "radiation") {
      if (Date.parse(data.startAt) > at)
        ctx.addIssue({
          code: "custom",
          path: ["data", "startAt"],
          message: "Exposure start must precede its end (observation time).",
        });
      const doseUnit = ["Gy", "mGy", "uGy"].includes(data.unit);
      if ((data.quantity === "absorbed_dose") !== doseUnit)
        ctx.addIssue({
          code: "custom",
          path: ["data", "unit"],
          message:
            "Absorbed dose requires Gy units; dose equivalent requires Sv units. No conversion is inferred.",
        });
    }
    if (
      data.kind === "cabin" &&
      data.temperatureC === null &&
      data.pressureKpa === null &&
      data.co2Ppm === null
    )
      ctx.addIssue({
        code: "custom",
        path: ["data"],
        message:
          "Record at least one cabin measurement; blank values remain unknown.",
      });
    if (data.kind === "context") {
      if (
        data.bedtime &&
        data.wakeTime &&
        Date.parse(data.bedtime) > Date.parse(data.wakeTime)
      )
        ctx.addIssue({
          code: "custom",
          path: ["data", "wakeTime"],
          message: "Wake time must follow bedtime.",
        });
      for (const key of ["bedtime", "wakeTime", "symptomOnset"] as const)
        if (data[key] && Date.parse(data[key]!) > at)
          ctx.addIssue({
            code: "custom",
            path: ["data", key],
            message: "This event cannot follow the observation time.",
          });
      if (
        data.phase === "unknown" &&
        data.gravity === "unknown" &&
        !data.location &&
        data.sleepQuality === "unknown" &&
        data.scheduleChanged === "unknown" &&
        !data.bedtime &&
        !data.wakeTime &&
        !data.exerciseType &&
        data.plannedSessionCompleted === "unknown" &&
        !data.symptom
      )
        ctx.addIssue({
          code: "custom",
          path: ["data"],
          message:
            "Add at least one context detail. Unknown fields do not count as measured coverage.",
        });
    }
  });
export type MissionLogInput = z.infer<typeof missionLogInputSchema>;
export type MissionLog = MissionLogInput & {
  id: string;
  streamId: string | null;
  missionId: string | null;
  createdAt: string;
};
export type HazardKey =
  | "radiation"
  | "isolation"
  | "distance"
  | "gravity"
  | "environment";
export type ScienceContext = {
  hazards: HazardKey[];
  riskTopic: string;
  referenceKeys: ReferenceKey[];
  boundary: string;
  thresholdBasis: string;
};
export const DOMAIN_SCIENCE: Record<
  DomainKey,
  Omit<ScienceContext, "thresholdBasis">
> = {
  cardiovascular: {
    hazards: ["gravity", "environment"],
    riskTopic: "Cardiovascular adaptation",
    referenceKeys: ["hrpCardio"],
    boundary:
      "Vital signs cannot establish cardiovascular disease or its cause.",
  },
  boneHealth: {
    hazards: ["gravity"],
    riskTopic: "Spaceflight-induced bone changes",
    referenceKeys: ["hrpBone"],
    boundary:
      "Exercise logs are not bone scans and do not measure density or percentage bone loss.",
  },
  muscleConditioning: {
    hazards: ["gravity"],
    riskTopic: "Reduced musculoskeletal fitness",
    referenceKeys: ["hrpMuscle"],
    boundary: "Exercise minutes cannot measure muscle mass or prove fitness.",
  },
  sleepRestriction: {
    hazards: ["isolation", "environment"],
    riskTopic: "Sleep loss and irregular schedules",
    referenceKeys: ["hrpSleep", "standardMeasures"],
    boundary:
      "A sleep report cannot diagnose a sleep disorder; schedule and light exposure also matter.",
  },
  fatigue: {
    hazards: ["isolation", "distance"],
    riskTopic: "Sleep, workload and performance",
    referenceKeys: ["hrpSleep"],
    boundary:
      "A subjective fatigue rating is not a validated task-performance prediction.",
  },
  visionChange: {
    hazards: ["gravity"],
    riskTopic: "Spaceflight-associated eye changes",
    referenceKeys: ["hrpVision"],
    boundary:
      "A reported change cannot establish SANS. The cause requires professional assessment.",
  },
  stressWellbeing: {
    hazards: ["isolation", "distance"],
    riskTopic: "Behavioral health and performance",
    referenceKeys: ["hrpBehavioural"],
    boundary: "An app rating cannot diagnose a psychiatric condition.",
  },
  respiratory: {
    hazards: ["environment"],
    riskTopic: "Oxygen-related and environmental concerns",
    referenceKeys: ["nasaRisks"],
    boundary:
      "Blood oxygen saturation is not a measurement of cabin oxygen or carbon dioxide.",
  },
};
export const HAZARDS: {
  key: HazardKey;
  label: string;
  source: ReferenceKey;
  detail: string;
}[] = [
  {
    key: "radiation",
    label: "Space radiation",
    source: "csaRadiation",
    detail: "Track exposure records and their measurement meaning.",
  },
  {
    key: "isolation",
    label: "Isolation & confinement",
    source: "nasaHazards",
    detail: "Review sleep and well-being reports in their mission context.",
  },
  {
    key: "distance",
    label: "Distance from Earth",
    source: "csaDeepSpace",
    detail: "Keep checks, evidence and handovers available locally.",
  },
  {
    key: "gravity",
    label: "Gravity fields",
    source: "nasaHazards",
    detail: "Record phase, gravity context and conditioning information.",
  },
  {
    key: "environment",
    label: "Hostile / closed environment",
    source: "nasaHazards",
    detail: "Cabin measurements are separate from personal vital signs.",
  },
];
export type HazardCoverage = {
  key: HazardKey;
  label: string;
  status: "partial" | "stale" | "not_assessed";
  summary: string;
  gaps: string[];
  domainKeys: DomainKey[];
  referenceKey: ReferenceKey;
};
export type SpaceContextReport = {
  version: string;
  logs: MissionLog[];
  coverage: HazardCoverage[];
  contextFacts: string[];
  workflowChecks: {
    title: string;
    reason: string;
    kind: "context" | "radiation" | "cabin";
  }[];
  limitation: string;
};
export function logSummary(log: MissionLog): string {
  const d = log.data;
  if (d.kind === "radiation")
    return `${d.value} ${d.unit} · ${d.quantity.replace(/_/g, " ")} · ${d.component} component · ${d.scope} record · ${d.location}. No clinical interpretation.`;
  if (d.kind === "cabin")
    return `${d.location}: temperature ${d.temperatureC === null ? "unknown" : `${d.temperatureC} °C`}; pressure ${d.pressureKpa === null ? "unknown" : `${d.pressureKpa} kPa`}; CO₂ ${d.co2Ppm === null ? "unknown" : `${d.co2Ppm} ppm`}.`;
  return [
    d.phase !== "unknown" ? `phase ${d.phase}` : "",
    d.gravity !== "unknown" ? d.gravity.replace(/_/g, " ") : "",
    d.location,
    d.sleepQuality !== "unknown" ? `sleep quality ${d.sleepQuality}` : "",
    d.scheduleChanged !== "unknown"
      ? `schedule changed: ${d.scheduleChanged}`
      : "",
    d.bedtime ? `bedtime ${d.bedtime}` : "",
    d.wakeTime ? `wake ${d.wakeTime}` : "",
    d.exerciseType ? `exercise ${d.exerciseType}` : "",
    d.plannedSessionCompleted !== "unknown"
      ? `planned exercise completed: ${d.plannedSessionCompleted}`
      : "",
    d.symptom
      ? `report: ${d.symptom} (${d.symptomChange}; onset ${d.symptomOnset ?? "unknown"})`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Coverage describes evidence availability, never severity or medical clearance. */
export function buildSpaceContext(params: {
  crewId: string;
  streamId: string | null;
  logs: MissionLog[];
  domains: DomainAssessment[];
  mission: MissionSettings | null;
  now: Date;
}): SpaceContextReport {
  const { crewId, streamId, now, domains, mission } = params;
  const logs = params.logs
    .filter(
      (l) =>
        l.crewId === crewId &&
        l.streamId === streamId &&
        l.missionId === (mission?.id ?? null) &&
        Date.parse(l.observedAt) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  const fresh = (l: MissionLog) =>
    now.getTime() - Date.parse(l.observedAt) <=
    CONTEXT_FRESHNESS_HOURS * 3600_000;
  const ctx = logs.find((l) => l.data.kind === "context" && fresh(l));
  const facts = ctx
    ? [
        `${logSummary(ctx)} · ${ctx.observedAt} · ${ctx.sourceLabel} (${ctx.sourceKind})`,
      ]
    : [];
  const coverage: HazardCoverage[] = HAZARDS.map((h) => {
    const linked = domains.filter((d) =>
      DOMAIN_SCIENCE[d.domain].hazards.includes(h.key),
    );
    let matching = logs.filter(
      (l) =>
        l.data.kind ===
        (h.key === "radiation"
          ? "radiation"
          : h.key === "environment"
            ? "cabin"
            : "context"),
    );
    if (h.key === "gravity")
      matching = matching.filter(
        (l) => l.data.kind === "context" && l.data.gravity !== "unknown",
      );
    if (h.key === "isolation")
      matching = matching.filter(
        (l) =>
          l.data.kind === "context" &&
          (l.data.sleepQuality !== "unknown" ||
            l.data.scheduleChanged !== "unknown"),
      );
    const hasPersonal =
      h.key === "isolation" &&
      linked.some((d) => d.metrics.some((m) => !m.missing && !m.stale));
    const hasWorkflow = h.key === "distance" && Boolean(mission);
    const current = matching.some(fresh) || hasPersonal || hasWorkflow;
    const status = current
      ? "partial"
      : matching.length
        ? "stale"
        : "not_assessed";
    const gap =
      h.key === "radiation"
        ? "No radiation safety limit or individual risk model is implemented."
        : h.key === "environment"
          ? "Personal vital signs do not establish cabin safety; no environmental alarm thresholds are implemented."
          : h.key === "distance"
            ? "Handover is a local communication simulation, not a connection to medical personnel."
            : h.key === "gravity"
              ? "Gravity context and exercise logs do not measure bone density or muscle strength."
              : "Sleep and stress reports do not fully assess isolation or diagnose behavioral conditions.";
    return {
      key: h.key,
      label: h.label,
      status,
      referenceKey: h.source,
      domainKeys: linked.map((d) => d.domain),
      summary:
        status === "not_assessed"
          ? "No relevant records available in this mission and stream."
          : status === "stale"
            ? "Only older context records available."
            : hasWorkflow
              ? "Applied mission and local handover workflow available; operational support is unassessed."
              : "Some relevant records available; coverage remains incomplete.",
      gaps: [
        ...(!current
          ? [
              "Record or import relevant context when available; unknown is not a normal result.",
            ]
          : []),
        gap,
      ],
    };
  });
  const workflowChecks: SpaceContextReport["workflowChecks"] = [];
  const active = domains.some((d) =>
    ["priority", "review"].includes(d.category),
  );
  if (!ctx)
    workflowChecks.push({
      title: "Record mission and observation context",
      reason:
        "Current phase, schedule and activity context are unavailable for this mission/stream.",
      kind: "context",
    });
  if (mission?.evaRequired || mission?.workload === "demanding")
    workflowChecks.push({
      title: "Review schedule and task context before demanding activity",
      reason:
        "This applied mission requests EVA or demanding work. Context complements the medical review; it cannot authorize the activity.",
      kind: "context",
    });
  if (active)
    workflowChecks.push({
      title: "Prepare evidence for medical review",
      reason:
        "A demonstration concern is open. Record symptoms and actions; use Deep Space Link only as a handover simulation.",
      kind: "context",
    });
  for (const h of coverage.filter(
    (h) =>
      h.status !== "partial" && ["radiation", "environment"].includes(h.key),
  ))
    workflowChecks.push({
      title:
        h.key === "radiation"
          ? "Add an exposure record if available"
          : "Add cabin measurements if available",
      reason: h.gaps[0],
      kind: h.key === "radiation" ? "radiation" : "cabin",
    });
  return {
    version: CONTEXT_VERSION,
    logs,
    coverage,
    contextFacts: facts,
    workflowChecks,
    limitation:
      "Coverage is separate from review priority. Freshness uses a 72-hour demo display window. Sources support monitoring relevance, not numeric alert cutoffs. Optional context does not change clinical categories.",
  };
}
