/**
 * Celestial Baymax — shared demonstration constants.
 *
 * Everything here is deliberately explicit so the app can show the exact rule it used.
 * Thresholds are illustrative software settings for a fictional demonstration. They are NOT
 * NASA clinical standards, validated triage criteria or an operational medical protocol.
 */

export const RULE_SET_VERSION = "demo-rules-1.1.0-evidence";
export const SEED_VERSION = "seed-1.0.0";
export const APP_TIMEZONE = "UTC";

export const COLORS = {
  // Deep-space base: intentionally dark dominant; not an all-purple wash.
  background: "#0C1426",
  panel: "#1A263D",
  panelSoft: "#141F34",
  panelRaised: "#273650",
  primary: "#8655E8",
  primarySoft: "#B599FF",
  rose: "#F779A5",
  roseSoft: "#FFADC9",
  teal: "#40D8BB",
  sky: "#74B9FF",
  amber: "#FFC66B",
  coral: "#FB8494",
  // Small, deliberately chosen high-contrast reading areas.
  lightSurface: "#F7F9FE",
  lightBorder: "#DDE4F1",
  ink: "#17253A",
  inkMuted: "#52657E",
  text: "#F8FAFF",
  textMuted: "#C1CEE0",
  textFaint: "#A3B3CD",
  border: "#324360",
  borderStrong: "#526584",
  // Medical status colours remain semantic and do not follow decorative accents.
  priority: "#FF8491",
  review: "#FFC66B",
  moreData: "#B4BECD",
  noFlags: "#4FE2AF",
  unknown: "#A3B3CD",
} as const;

export type Category = "priority" | "review" | "more_data" | "no_flags";

export const CATEGORY_ORDER: Category[] = [
  "priority",
  "review",
  "more_data",
  "no_flags",
];

export const CATEGORY_META: Record<
  Category,
  {
    label: string;
    short: string;
    meaning: string;
    instruction: string;
    color: string;
    icon: string;
    order: number;
  }
> = {
  priority: {
    label: "Priority Review",
    short: "Priority",
    meaning:
      "Significant concerns warrant priority medical assessment before demanding activities.",
    instruction:
      "Arrange priority review with the responsible medical officer before demanding activity. This app cannot clear or disqualify a crew member.",
    color: COLORS.priority,
    icon: "alert",
    order: 0,
  },
  review: {
    label: "Review Before Assignment",
    short: "Review",
    meaning: "Concerns warrant further evaluation.",
    instruction:
      "Plan a medical review before assignment. Continue monitoring and record the next useful check.",
    color: COLORS.review,
    icon: "eye",
    order: 1,
  },
  more_data: {
    label: "More Data Needed",
    short: "More data",
    meaning: "Insufficient information for meaningful screening.",
    instruction:
      "Record the missing measurement or mark it as unavailable. Unknown data is not a normal result.",
    color: COLORS.moreData,
    icon: "help",
    order: 2,
  },
  no_flags: {
    label: "No Demo Flags",
    short: "No flags",
    meaning:
      "No implemented demonstration screening alerts identified. Formal medical clearance is still required.",
    instruction:
      "No demonstration flag is present. Keep routine monitoring; formal medical clearance remains with authorised personnel.",
    color: COLORS.noFlags,
    icon: "check",
    order: 3,
  },
};

export type MetricKey =
  | "heartRate"
  | "oxygenSaturation"
  | "systolicBloodPressure"
  | "diastolicBloodPressure"
  | "sleepDuration"
  | "stress"
  | "exerciseDuration"
  | "fatigue"
  | "visionChange"
  | "bodyTemperature";

export type HeartRateContext = "rest" | "after_exercise" | "unknown";

export type MetricDefinition = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  kind: "number" | "choice";
  min: number | null;
  max: number | null;
  step: number | null;
  decimals: number;
  freshnessHours: number;
  relevant: boolean;
  contexts: HeartRateContext[] | null;
  description: string;
  choices: { value: string; label: string }[] | null;
  /** Field name used in CSV/JSON imports when the column is not otherwise recognised. */
  importAliases: string[];
};

export const METRICS: Record<MetricKey, MetricDefinition> = {
  heartRate: {
    key: "heartRate",
    label: "Heart rate",
    shortLabel: "Heart rate",
    unit: "bpm",
    kind: "number",
    min: 30,
    max: 220,
    step: 1,
    decimals: 0,
    freshnessHours: 72,
    relevant: true,
    contexts: ["rest", "after_exercise", "unknown"],
    description:
      "Pulse rate entered manually or simulated. Cannot diagnose cardiovascular disease, and rest values must not be compared with post-exercise values.",
    choices: null,
    importAliases: [
      "hr",
      "heart_rate",
      "heartrate",
      "pulse",
      "bpm",
      "heart_rate_bpm",
    ],
  },
  oxygenSaturation: {
    key: "oxygenSaturation",
    label: "Oxygen saturation",
    shortLabel: "SpO₂",
    unit: "%",
    kind: "number",
    min: 70,
    max: 100,
    step: 1,
    decimals: 0,
    freshnessHours: 72,
    relevant: true,
    contexts: ["rest", "after_exercise", "unknown"],
    description:
      "Peripheral oxygen saturation entered manually or simulated. A single value cannot establish respiratory diagnosis.",
    choices: null,
    importAliases: ["spo2", "oxygen_saturation", "o2", "sat", "spo2_pct"],
  },
  systolicBloodPressure: {
    key: "systolicBloodPressure",
    label: "Systolic blood pressure",
    shortLabel: "Systolic",
    unit: "mmHg",
    kind: "number",
    min: 70,
    max: 220,
    step: 1,
    decimals: 0,
    freshnessHours: 168,
    relevant: true,
    contexts: ["rest", "unknown"],
    description:
      "Upper blood-pressure value if available. Cuff measurement is not simulated by the app; entered values are records only.",
    choices: null,
    importAliases: ["systolic", "sbp", "systolic_bp", "bp_systolic"],
  },
  diastolicBloodPressure: {
    key: "diastolicBloodPressure",
    label: "Diastolic blood pressure",
    shortLabel: "Diastolic",
    unit: "mmHg",
    kind: "number",
    min: 40,
    max: 140,
    step: 1,
    decimals: 0,
    freshnessHours: 168,
    relevant: false,
    contexts: ["rest", "unknown"],
    description:
      "Lower blood-pressure value if available. Entered values are records only.",
    choices: null,
    importAliases: ["diastolic", "dbp", "diastolic_bp", "bp_diastolic"],
  },
  sleepDuration: {
    key: "sleepDuration",
    label: "Sleep duration",
    shortLabel: "Sleep",
    unit: "h",
    kind: "number",
    min: 0,
    max: 16,
    step: 0.25,
    decimals: 1,
    freshnessHours: 48,
    relevant: true,
    contexts: null,
    description:
      "Self-reported or simulated sleep in the previous 24 hours. Sleep logs are reports, not measured polysomnography.",
    choices: null,
    importAliases: ["sleep", "sleep_hours", "sleep_duration", "hours_sleep"],
  },
  stress: {
    key: "stress",
    label: "Self-reported stress",
    shortLabel: "Stress",
    unit: "0–10",
    kind: "number",
    min: 0,
    max: 10,
    step: 1,
    decimals: 0,
    freshnessHours: 72,
    relevant: true,
    contexts: null,
    description:
      "Subjective 0–10 rating reported by the crew member (0 = none, 10 = worst imaginable). Not a clinical instrument.",
    choices: null,
    importAliases: ["stress", "stress_score", "stress_0_10"],
  },
  exerciseDuration: {
    key: "exerciseDuration",
    label: "Exercise duration",
    shortLabel: "Exercise",
    unit: "min/day",
    kind: "number",
    min: 0,
    max: 300,
    step: 5,
    decimals: 0,
    freshnessHours: 96,
    relevant: true,
    contexts: null,
    description:
      "Recorded or simulated exercise minutes per day. Exercise logs cannot establish bone density or muscle mass.",
    choices: null,
    importAliases: [
      "exercise",
      "exercise_minutes",
      "exercise_duration",
      "activity_minutes",
    ],
  },
  fatigue: {
    key: "fatigue",
    label: "Self-reported fatigue",
    shortLabel: "Fatigue",
    unit: "0–10",
    kind: "number",
    min: 0,
    max: 10,
    step: 1,
    decimals: 0,
    freshnessHours: 48,
    relevant: true,
    contexts: null,
    description:
      "Subjective 0–10 fatigue rating (0 = none, 10 = unable to perform duties). A report, not an objective measure.",
    choices: null,
    importAliases: ["fatigue", "fatigue_score", "tiredness"],
  },
  visionChange: {
    key: "visionChange",
    label: "Reported vision change",
    shortLabel: "Vision",
    unit: "",
    kind: "choice",
    min: null,
    max: null,
    step: null,
    decimals: 0,
    freshnessHours: 336,
    relevant: true,
    contexts: null,
    description:
      "Explicit report of a vision change, or an explicit statement that no change was reported. Self-report cannot diagnose a spaceflight-associated eye condition.",
    choices: [
      { value: "no_change", label: "No vision change reported" },
      { value: "changes_reported", label: "Vision changes reported" },
    ],
    importAliases: [
      "vision",
      "vision_change",
      "vision_changes",
      "visual_change",
    ],
  },
  bodyTemperature: {
    key: "bodyTemperature",
    label: "Body temperature",
    shortLabel: "Temperature",
    unit: "°C",
    kind: "number",
    min: 34,
    max: 42,
    step: 0.1,
    decimals: 1,
    freshnessHours: 72,
    relevant: false,
    contexts: null,
    description:
      "Entered temperature reading. The app does not measure temperature itself.",
    choices: null,
    importAliases: ["temperature", "temp_c", "body_temperature"],
  },
};

export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

export const RELEVANT_METRICS: MetricKey[] = METRIC_KEYS.filter(
  (key) => METRICS[key].relevant,
);

export const RELEVANT_METRIC_COUNT = RELEVANT_METRICS.length; // 8

export type DomainKey =
  | "cardiovascular"
  | "boneHealth"
  | "muscleConditioning"
  | "sleepRestriction"
  | "fatigue"
  | "visionChange"
  | "stressWellbeing"
  | "respiratory";

export type DomainDefinition = {
  key: DomainKey;
  label: string;
  shortLabel: string;
  summary: string;
  metrics: MetricKey[];
  bodyRegion: string;
};

export const DOMAINS: Record<DomainKey, DomainDefinition> = {
  cardiovascular: {
    key: "cardiovascular",
    label: "Cardiovascular",
    shortLabel: "Cardio",
    summary:
      "Resting heart rate, oxygen saturation and blood pressure reviewed against cardiovascular history.",
    metrics: [
      "heartRate",
      "oxygenSaturation",
      "systolicBloodPressure",
      "diastolicBloodPressure",
    ],
    bodyRegion: "chest",
  },
  boneHealth: {
    key: "boneHealth",
    label: "Bone health monitoring",
    shortLabel: "Bone",
    summary:
      "Loading-exercise records and bone history that indicate whether bone-health monitoring needs attention.",
    metrics: ["exerciseDuration"],
    bodyRegion: "legs",
  },
  muscleConditioning: {
    key: "muscleConditioning",
    label: "Muscle conditioning",
    shortLabel: "Muscle",
    summary:
      "Exercise duration trend and conditioning history for muscle-loading support.",
    metrics: ["exerciseDuration", "fatigue"],
    bodyRegion: "arms",
  },
  sleepRestriction: {
    key: "sleepRestriction",
    label: "Sleep restriction",
    shortLabel: "Sleep",
    summary:
      "Sleep duration across the lookback window compared with the demonstration floor.",
    metrics: ["sleepDuration"],
    bodyRegion: "head",
  },
  fatigue: {
    key: "fatigue",
    label: "Fatigue",
    shortLabel: "Fatigue",
    summary:
      "Self-reported fatigue together with sleep duration and duty load.",
    metrics: ["fatigue", "sleepDuration"],
    bodyRegion: "head",
  },
  visionChange: {
    key: "visionChange",
    label: "Reported vision changes",
    shortLabel: "Vision",
    summary:
      "Explicit vision reports; an unanswered field is not the same as 'no change reported'.",
    metrics: ["visionChange"],
    bodyRegion: "eyes",
  },
  stressWellbeing: {
    key: "stressWellbeing",
    label: "Stress & well-being",
    shortLabel: "Stress",
    summary:
      "Subjective stress ratings and sleep interaction across the lookback window.",
    metrics: ["stress", "sleepDuration"],
    bodyRegion: "chest",
  },
  respiratory: {
    key: "respiratory",
    label: "Respiratory",
    shortLabel: "Resp",
    summary: "Oxygen saturation values and respiratory history.",
    metrics: ["oxygenSaturation"],
    bodyRegion: "lungs",
  },
};

export const DOMAIN_KEYS: DomainKey[] = [
  "cardiovascular",
  "boneHealth",
  "muscleConditioning",
  "sleepRestriction",
  "fatigue",
  "visionChange",
  "stressWellbeing",
  "respiratory",
];

/** Lookback windows in days. Documented for the in-app rules screen. */
export const STALE_AFTER_HOURS = 72;

/**
 * Illustration thresholds. Changing one of these changes screening output and must be reflected in
 * docs/RULES_AND_LIMITATIONS.md.
 */
export const THRESHOLDS = {
  heartRate: {
    priorityRest: 110,
    reviewRest: 90,
    priorityWithHypertension: 100,
    afterExerciseDeltaNote: 15,
  },
  oxygenSaturation: {
    priority: 90,
    reviewLow: 92,
    reviewUpper: 94,
    priorityWithSymptoms: 92,
  },
  bloodPressure: {
    systolicReview: 140,
    systolicPriority: 160,
    diastolicReview: 90,
    diastolicPriority: 100,
  },
  sleep: {
    reviewMedianHours: 6,
    priorityMedianHours: 4.5,
    prioritySingleNightHours: 3.5,
  },
  fatigue: {
    reviewScore: 6,
    priorityScore: 8,
  },
  stress: {
    reviewScore: 6,
    priorityScore: 9,
  },
  exercise: {
    reviewMinutesPerDay: 20,
    priorityMinutesPerDay: 10,
    longDurationDays: 180,
    longDurationReviewMinutes: 30,
  },
  lookbackDays: 7,
  longMissionDays: 180,
  /** A mission input above this workload tightens the sleep review floor by 0.5 h. */
  demandingWorkloadSleepShift: 0.5,
} as const;

export { SCIENCE_REFERENCES as REFERENCE_LIBRARY } from "./references";
import { SCIENCE_REFERENCES } from "./references";

export type ReferenceKey = keyof typeof SCIENCE_REFERENCES;

export const DEMO_RESET_MARKER = "demo-reset";

export const LINK_DEFAULTS = {
  oneWayDelayMinutes: 42,
  groundReviewMinutes: 90,
  linkAvailable: true,
};

export const SCENARIOS = {
  normal: {
    key: "normal",
    label: "Normal health",
    blurb:
      "Stable sleep, conditioning and vitals with mild day-to-day variation.",
  },
  sleep_deprivation: {
    key: "sleep_deprivation",
    label: "Sleep deprivation",
    blurb:
      "Sleep shortens across the week, fatigue and stress climb, resting heart rate drifts up.",
  },
  cardiovascular_strain: {
    key: "cardiovascular_strain",
    label: "Cardiovascular strain",
    blurb:
      "Resting heart rate rises, saturation dips and tolerance to exercise drops.",
  },
  vision_changes: {
    key: "vision_changes",
    label: "Vision changes",
    blurb:
      "A vision change is reported mid-week with secondary sleep and stress effects.",
  },
  reduced_exercise: {
    key: "reduced_exercise",
    label: "Reduced exercise",
    blurb:
      "Daily exercise minutes fall sharply, with gradual fatigue accumulation.",
  },
  recovery: {
    key: "recovery",
    label: "Recovery and improvement",
    blurb:
      "Starts from a restricted pattern and improves across seven days of logged recovery.",
  },
} as const;

export type ScenarioKey = keyof typeof SCENARIOS;

export const SCENARIO_KEYS = Object.keys(SCENARIOS) as ScenarioKey[];

export const CATEGORY_RANK: Record<Category, number> = {
  priority: 0,
  review: 1,
  more_data: 2,
  no_flags: 3,
};

export function worstCategory(categories: Category[]): Category {
  return categories.reduce<Category>(
    (worst, current) =>
      CATEGORY_RANK[current] < CATEGORY_RANK[worst] ? current : worst,
    "no_flags",
  );
}
