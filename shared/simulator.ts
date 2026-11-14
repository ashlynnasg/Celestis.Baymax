/**
 * Mission Health Simulator — deterministic, documented scenario generation.
 *
 * Generated data is fictional and labelled as a named scenario run. No scenario is a predicted
 * clinical outcome, and a recovery scenario does not demonstrate that a treatment worked.
 */
import {
  METRICS,
  RULE_SET_VERSION,
  SCENARIOS,
  type MetricKey,
  type ScenarioKey,
} from "./constants";
import type {
  CrewProfile,
  DomainAssessment,
  MissionSettings,
  Observation,
  ObservationInput,
  ScenarioPreviewRow,
} from "./domain";
import { formatNumber } from "./format";

export type GeneratedDay = {
  day: number;
  date: string;
  observations: ObservationInput[];
};

export type GeneratedRun = {
  days: GeneratedDay[];
  assumptions: string[];
  preview: ScenarioPreviewRow[];
  startDate: string;
};

const DAYS = 7;

const FALLBACKS: Record<MetricKey, number | null> = {
  heartRate: 76,
  oxygenSaturation: 97,
  systolicBloodPressure: 122,
  diastolicBloodPressure: 78,
  sleepDuration: 7.1,
  stress: 4,
  exerciseDuration: 30,
  fatigue: 4,
  visionChange: null,
  bodyTemperature: 36.6,
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function baselineValues(observations: Observation[]): Partial<Record<MetricKey, number>> {
  const result: Partial<Record<MetricKey, number>> = {};
  (Object.keys(FALLBACKS) as MetricKey[]).forEach((metric) => {
    const values = observations
      .filter((item) => item.metric === metric && item.numericValue !== null)
      .map((item) => item.numericValue as number);
    const median = medianOf(values);
    if (median !== null) result[metric] = median;
  });
  return result;
}

function clamp(metric: MetricKey, value: number): number {
  const definition = METRICS[metric];
  const min = definition.min ?? -Infinity;
  const max = definition.max ?? Infinity;
  return Math.min(max, Math.max(min, value));
}

function round(metric: MetricKey, value: number): number {
  const factor = Math.pow(10, METRICS[metric].decimals);
  return Math.round(value * factor) / factor;
}

type Modifier = (day: number, baseline: number, noise: number) => number;

type ScenarioSpec = {
  modifiers: Partial<Record<MetricKey, Modifier>>;
  vision?: (day: number) => "no_change" | "changes_reported" | null;
  notes: Partial<Record<MetricKey, string>>;
};

const SPECS: Record<ScenarioKey, ScenarioSpec> = {
  normal: {
    modifiers: {
      heartRate: (day, base, noise) => base + (noise - 0.5) * 4,
      oxygenSaturation: (day, base, noise) => base + (noise - 0.5) * 2,
      sleepDuration: (day, base, noise) => base + (noise - 0.5) * 0.8,
      stress: (day, base, noise) => base + (noise - 0.5) * 2,
      exerciseDuration: (day, base, noise) => base + (noise - 0.5) * 12,
      fatigue: (day, base, noise) => base + (noise - 0.5) * 2,
      systolicBloodPressure: (day, base, noise) => base + (noise - 0.5) * 6,
    },
    vision: (day) => (day === 1 || day === 7 ? "no_change" : null),
    notes: {
      heartRate: "Stable around the recorded baseline.",
      sleepDuration: "Sleep stays near the recorded median.",
    },
  },
  sleep_deprivation: {
    modifiers: {
      sleepDuration: (day, base, noise) => Math.max(3.2, base - 0.5 - day * 0.28 + (noise - 0.5) * 0.4),
      fatigue: (day, base, noise) => Math.min(10, base + 2 + day * 0.42 + (noise - 0.5) * 1.2),
      stress: (day, base, noise) => Math.min(10, base + 1.4 + day * 0.3 + (noise - 0.5) * 1.4),
      heartRate: (day, base, noise) => base + 5 + day * 1.1 + (noise - 0.5) * 4,
      exerciseDuration: (day, base, noise) => Math.max(0, base * (0.85 - day * 0.04) + (noise - 0.5) * 6),
      oxygenSaturation: (day, base, noise) => base - (noise - 0.5) * 2,
    },
    vision: (day) => (day === 1 ? "no_change" : null),
    notes: {
      sleepDuration: "Sleep opportunity shortens by roughly 0.3 h per day.",
      fatigue: "Fatigue rises about 0.4 points per day after a 2-point initial shift.",
      heartRate: "Resting heart rate drifts up with accumulated sleep debt.",
    },
  },
  cardiovascular_strain: {
    modifiers: {
      heartRate: (day, base, noise) => base + 16 + day * 2.1 + (noise - 0.5) * 5,
      oxygenSaturation: (day, base, noise) => Math.max(86, base - 1.5 - day * 0.45 + (noise - 0.5) * 1.4),
      exerciseDuration: (day, base, noise) => Math.max(0, base * (0.6 - day * 0.04) + (noise - 0.5) * 5),
      fatigue: (day, base, noise) => Math.min(10, base + 1.5 + day * 0.3 + (noise - 0.5) * 1),
      systolicBloodPressure: (day, base, noise) => base + 8 + day * 1.6 + (noise - 0.5) * 5,
      sleepDuration: (day, base, noise) => base - 0.4 + (noise - 0.5) * 0.6,
    },
    vision: (day) => (day === 1 ? "no_change" : null),
    notes: {
      heartRate: "Resting heart rate climbs from +16 bpm toward +30 bpm by day 7.",
      oxygenSaturation: "Saturation falls a little each day.",
      systolicBloodPressure: "Systolic pressure rises alongside heart rate.",
    },
  },
  vision_changes: {
    modifiers: {
      stress: (day, base, noise) => Math.min(10, base + 1 + day * 0.25 + (noise - 0.5) * 1.2),
      sleepDuration: (day, base, noise) => base - 0.6 + (noise - 0.5) * 0.6,
      fatigue: (day, base, noise) => Math.min(10, base + 0.8 + day * 0.2 + (noise - 0.5) * 1),
      heartRate: (day, base, noise) => base + 3 + (noise - 0.5) * 4,
      exerciseDuration: (day, base, noise) => base - 4 + (noise - 0.5) * 8,
    },
    vision: (day) => (day <= 2 ? "no_change" : "changes_reported"),
    notes: {
      visionChange: "A vision change is reported from day 3 onward.",
      stress: "Stress creeps up after the vision report.",
    },
  },
  reduced_exercise: {
    modifiers: {
      exerciseDuration: (day, base, noise) => Math.max(0, base * 0.22 - day * 1.1 + (noise - 0.5) * 5),
      fatigue: (day, base, noise) => Math.min(10, base + 1.2 + day * 0.26 + (noise - 0.5) * 1),
      heartRate: (day, base, noise) => base + 4 + day * 0.5 + (noise - 0.5) * 4,
      sleepDuration: (day, base, noise) => base - 0.3 + (noise - 0.5) * 0.7,
      stress: (day, base, noise) => base + 0.6 + (noise - 0.5) * 2,
    },
    vision: (day) => (day === 1 ? "no_change" : null),
    notes: {
      exerciseDuration: "Exercise falls to roughly a fifth of the recorded median.",
      fatigue: "Fatigue accumulates slowly as conditioning volume drops.",
    },
  },
  recovery: {
    modifiers: {
      sleepDuration: (day, base, noise) => Math.min(base, 5.2 + (day - 1) * 0.42 + (noise - 0.5) * 0.4),
      fatigue: (day, base, noise) => Math.max(1, 7.4 - (day - 1) * 0.8 + (noise - 0.5) * 1),
      stress: (day, base, noise) => Math.max(1, 6.4 - (day - 1) * 0.6 + (noise - 0.5) * 1.2),
      heartRate: (day, base, noise) => Math.max(base, 93 - (day - 1) * 2.6 + (noise - 0.5) * 4),
      exerciseDuration: (day, base, noise) => Math.max(6, 10 + (day - 1) * 3.4 + (noise - 0.5) * 4),
      oxygenSaturation: (day, base, noise) => Math.min(base, 95 + (day - 1) * 0.35 + (noise - 0.5) * 1.2),
    },
    vision: (day) => (day === 1 ? "changes_reported" : day >= 6 ? "no_change" : null),
    notes: {
      sleepDuration: "Starts restricted at 5.2 h and lengthens to the crew baseline.",
      fatigue: "Fatigue falls from 7.4 toward 3 across the week.",
      heartRate: "Resting heart rate eases back toward the recorded baseline.",
    },
  },
};

export function scenarioAssumptions(scenario: ScenarioKey): string[] {
  return [
    `Seven consecutive daily simulated observations are generated for the ${SCENARIOS[scenario].label.toLowerCase()} scenario.`,
    "Values are derived from the crew member's recorded baseline medians and a fixed pseudo-random seed, so the same run always reproduces the same numbers.",
    "Simulated rows are labelled 'Scenario simulation' and stored in their own stream; baseline observations are never modified.",
    `Screening uses ${RULE_SET_VERSION} with the same thresholds as live data.`,
    "A generated scenario is a demonstration input, not a predicted clinical outcome, and a recovery scenario does not show that a treatment worked.",
  ];
}

function numericObservation(
  crewId: string,
  metric: MetricKey,
  value: number,
  streamId: string,
  sourceLabel: string,
  observedAt: string,
): ObservationInput {
  return {
    crewId,
    metric,
    numericValue: round(metric, value),
    textValue: null,
    unit: METRICS[metric].unit,
    context: metric === "heartRate" || metric === "oxygenSaturation" || metric === "systolicBloodPressure" ? "rest" : null,
    observedAt,
    sourceKind: "simulated",
    sourceLabel,
    streamId,
    importBatchId: null,
    note: "Generated scenario value — fictional.",
  };
}

export function generateScenario(params: {
  runId: string;
  crew: CrewProfile;
  baselineObservations: Observation[];
  scenario: ScenarioKey;
  seed: number;
  startDate: Date;
  streamLabel: string;
}): GeneratedRun {
  const { crew, baselineObservations, scenario, seed, runId, startDate, streamLabel } = params;
  const spec = SPECS[scenario];
  const baselines = { ...FALLBACKS, ...baselineValues(baselineObservations) } as Record<MetricKey, number | null>;
  const random = mulberry32(seed);
  const days: GeneratedDay[] = [];

  for (let day = 1; day <= DAYS; day += 1) {
    const date = new Date(startDate.getTime() + (day - 1) * 24 * 60 * 60 * 1000);
    date.setUTCHours(7, 30, 0, 0);
    const observedAt = date.toISOString();
    const observations: ObservationInput[] = [];
    const sourceLabel = `${streamLabel} · day ${day}/${DAYS}`;

    (Object.keys(spec.modifiers) as MetricKey[]).forEach((metric) => {
      const modifier = spec.modifiers[metric];
      if (!modifier) return;
      const baseline = baselines[metric];
      if (baseline === null || baseline === undefined) return;
      const noise = random();
      const value = clamp(metric, modifier(day, baseline, noise));
      observations.push(numericObservation(crew.id, metric, value, runId, sourceLabel, observedAt));
    });

    const vision = spec.vision?.(day) ?? null;
    if (vision) {
      observations.push({
        crewId: crew.id,
        metric: "visionChange",
        numericValue: null,
        textValue: vision,
        unit: "",
        context: null,
        observedAt,
        sourceKind: "simulated",
        sourceLabel,
        streamId: runId,
        importBatchId: null,
        note: "Generated scenario report — fictional.",
      });
    }

    days.push({ day, date: observedAt, observations });
  }

  return {
    days,
    assumptions: scenarioAssumptions(scenario),
    preview: previewFromDays(scenario, baselines, days),
    startDate: days[0].date,
  };
}

function previewFromDays(
  scenario: ScenarioKey,
  baselines: Record<MetricKey, number | null>,
  days: GeneratedDay[],
): ScenarioPreviewRow[] {
  const spec = SPECS[scenario];
  const lastDay = days[days.length - 1];
  const metrics = Object.keys(spec.modifiers) as MetricKey[];
  return metrics.map((metric) => {
    const baselineValue = baselines[metric] ?? null;
    const final = lastDay.observations.find((item) => item.metric === metric);
    const first = days[0].observations.find((item) => item.metric === metric);
    const targetValue = final?.numericValue ?? null;
    const direction: ScenarioPreviewRow["direction"] =
      baselineValue === null || targetValue === null
        ? "flat"
        : targetValue > baselineValue + 0.05
          ? "up"
          : targetValue < baselineValue - 0.05
            ? "down"
            : "flat";
    return {
      metric,
      label: METRICS[metric].label,
      unit: METRICS[metric].unit,
      baseline: baselineValue !== null ? `${formatNumber(baselineValue, METRICS[metric].decimals)} ${METRICS[metric].unit}`.trim() : "no baseline",
      target:
        targetValue !== null
          ? `${formatNumber(targetValue, METRICS[metric].decimals)} ${METRICS[metric].unit}`.trim()
          : first?.textValue ?? "—",
      direction,
      note: spec.notes[metric] ?? "Generated variation around the baseline.",
    };
  });
}

export function previewScenario(params: {
  crew: CrewProfile;
  baselineObservations: Observation[];
  scenario: ScenarioKey;
  seed?: number;
  startDate?: Date;
}): ScenarioPreviewRow[] {
  const generated = generateScenario({
    runId: "preview",
    crew: params.crew,
    baselineObservations: params.baselineObservations,
    scenario: params.scenario,
    seed: params.seed ?? 20260101,
    startDate: params.startDate ?? new Date(),
    streamLabel: `Preview · ${SCENARIOS[params.scenario].label}`,
  });
  return generated.preview;
}

export function describeCategoryChanges(
  baseline: DomainAssessment[],
  scenario: DomainAssessment[],
): {
  domain: DomainAssessment["domain"];
  label: string;
  from: DomainAssessment["category"];
  to: DomainAssessment["category"];
  reason: string;
}[] {
  return baseline
    .map((baseDomain) => {
      const match = scenario.find((item) => item.domain === baseDomain.domain);
      if (!match || match.category === baseDomain.category) return null;
      return {
        domain: baseDomain.domain,
        label: baseDomain.label,
        from: baseDomain.category,
        to: match.category,
        reason: match.headline,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export const SIMULATOR_HELPERS = { DAYS, FALLBACKS };
