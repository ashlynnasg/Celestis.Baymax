import {
  buildSpaceContext,
  DOMAIN_SCIENCE,
  type MissionLog,
} from "./mission-context";
/**
 * The single explainable screening engine.
 *
 * Every screen (dashboard, domain assessment, mission table, care support, cases, simulator
 * comparison, assistant and exports) reads the output of this module. Rules are deliberately
 * explicit, small and inspectable. All thresholds are demonstration engineering settings.
 */
import {
  APP_TIMEZONE,
  CATEGORY_META,
  CATEGORY_RANK,
  DOMAINS,
  METRICS,
  RELEVANT_METRICS,
  RELEVANT_METRIC_COUNT,
  RULE_SET_VERSION,
  THRESHOLDS,
  worstCategory,
  type Category,
  type DomainKey,
  type MetricKey,
  type ReferenceKey,
} from "./constants";
import type {
  AssessmentBundle,
  BaselineSummary,
  CrewProfile,
  DomainAssessment,
  EvidenceItem,
  MissionSettings,
  MetricSnapshot,
  NextCheck,
  Observation,
  PreventiveSuggestion,
} from "./domain";
import {
  formatDateTime,
  formatAge,
  formatMetricValue,
  formatNumber,
} from "./format";

export type ScreeningInput = {
  missionLogs?: MissionLog[];
  crew: CrewProfile;
  observations: Observation[];
  mission: MissionSettings | null;
  stream?: AssessmentBundle["stream"];
  now?: Date;
  ruleSetVersion?: string;
};

type Ctx = {
  crew: CrewProfile;
  observations: Observation[];
  mission: MissionSettings | null;
  now: Date;
};

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

function ageInHours(value: string, now: Date): number {
  return (now.getTime() - new Date(value).getTime()) / HOUR;
}

function isFresh(observation: Observation, now: Date): boolean {
  return (
    ageInHours(observation.observedAt, now) <=
    METRICS[observation.metric].freshnessHours
  );
}

function sortedDesc(list: Observation[]): Observation[] {
  return [...list].sort(
    (left, right) =>
      new Date(right.observedAt).getTime() -
      new Date(left.observedAt).getTime(),
  );
}

function latest(
  observations: Observation[],
  metric: MetricKey,
): Observation | null {
  const matching = sortedDesc(
    observations.filter((item) => item.metric === metric),
  );
  return matching[0] ?? null;
}

function fresh(ctx: Ctx, metric: MetricKey): Observation | null {
  const candidate = latest(ctx.observations, metric);
  if (!candidate) return null;
  return isFresh(candidate, ctx.now) ? candidate : null;
}

function series(ctx: Ctx, metric: MetricKey, days: number): Observation[] {
  return sortedDesc(
    ctx.observations.filter(
      (item) =>
        item.metric === metric &&
        ageInHours(item.observedAt, ctx.now) <= days * 24 &&
        item.numericValue !== null,
    ),
  );
}

function numbersOf(list: Observation[]): number[] {
  return list
    .map((item) => item.numericValue)
    .filter((value): value is number => value !== null && !Number.isNaN(value));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle];
  return (ordered[middle - 1] + ordered[middle]) / 2;
}

export function describeObservation(observation: Observation): string {
  const definition = METRICS[observation.metric];
  const value = formatMetricValue(
    observation.metric,
    observation.numericValue,
    observation.textValue,
  );
  const context = observation.context
    ? ` (${contextLabel(observation.context)})`
    : "";
  return `${value}${context} · ${formatDateTime(observation.observedAt)} · ${observation.sourceLabel}`;
}

export function contextLabel(context: string): string {
  switch (context) {
    case "rest":
      return "at rest";
    case "after_exercise":
      return "after exercise";
    case "unknown":
      return "context unknown";
    default:
      return context;
  }
}

function evidenceFromObservation(observation: Observation): EvidenceItem {
  const definition = METRICS[observation.metric];
  return {
    kind: "observation",
    label: definition.label,
    value: formatMetricValue(
      observation.metric,
      observation.numericValue,
      observation.textValue,
    ),
    unit: definition.unit,
    observedAt: observation.observedAt,
    context: observation.context,
    sourceLabel: observation.sourceLabel,
    observationId: observation.id,
    field: observation.metric,
  };
}

function historyEvidence(
  label: string,
  value: string,
  field: string,
): EvidenceItem {
  return {
    kind: "history",
    label,
    value,
    unit: "",
    observedAt: null,
    context: null,
    sourceLabel: "Crew medical profile",
    observationId: null,
    field,
  };
}

function snapshot(ctx: Ctx, metric: MetricKey): MetricSnapshot {
  const definition = METRICS[metric];
  const observation = latest(ctx.observations, metric);
  const age = observation ? ageInHours(observation.observedAt, ctx.now) : null;
  const stale = observation ? (age ?? 0) > definition.freshnessHours : false;
  return {
    metric,
    label: definition.label,
    unit: definition.unit,
    value: observation
      ? formatMetricValue(
          metric,
          observation.numericValue,
          observation.textValue,
        )
      : null,
    observedAt: observation?.observedAt ?? null,
    ageHours: age,
    stale,
    missing: !observation,
    sourceLabel: observation?.sourceLabel ?? null,
    context: observation?.context ?? null,
    streamLabel: null,
  };
}

function domainFreshness(
  ctx: Ctx,
  metrics: MetricKey[],
): {
  newest: string | null;
  status: "fresh" | "stale" | "missing";
  label: string;
} {
  const observations = metrics
    .map((metric) => latest(ctx.observations, metric))
    .filter((item): item is Observation => Boolean(item));
  if (observations.length === 0) {
    return {
      newest: null,
      status: "missing",
      label: "No observations for this domain yet",
    };
  }
  const newest = sortedDesc(observations)[0];
  const freshCount = observations.filter((item) =>
    isFresh(item, ctx.now),
  ).length;
  const age = ageInHours(newest.observedAt, ctx.now);
  if (freshCount > 0) {
    return {
      newest: newest.observedAt,
      status: "fresh",
      label: `Newest value ${formatAge(age)} · ${freshCount} of ${metrics.length} measures current`,
    };
  }
  return {
    newest: newest.observedAt,
    status: "stale",
    label: `Newest value ${formatAge(age)} · outside the ${METRICS[newest.metric].freshnessHours} h freshness window`,
  };
}

function domainCompleteness(
  ctx: Ctx,
  metrics: MetricKey[],
): { available: number; total: number } {
  const relevant = metrics.filter((metric) => METRICS[metric].relevant);
  const available = relevant.filter(
    (metric) => fresh(ctx, metric) !== null,
  ).length;
  return { available, total: relevant.length };
}

function missingGaps(
  ctx: Ctx,
  metrics: MetricKey[],
  domainLabel: string,
): string[] {
  const gaps: string[] = [];
  metrics.forEach((metric) => {
    if (!METRICS[metric].relevant) return;
    const definition = METRICS[metric];
    const observation = latest(ctx.observations, metric);
    if (!observation) {
      gaps.push(
        `No ${definition.label.toLowerCase()} recorded for ${domainLabel.toLowerCase()}.`,
      );
      return;
    }
    const age = ageInHours(observation.observedAt, ctx.now);
    if (age > definition.freshnessHours) {
      gaps.push(
        `${definition.label} is ${formatAge(age)}; the demonstration freshness window is ${definition.freshnessHours} h.`,
      );
    }
  });
  return gaps;
}

function nextCheck(
  domain: DomainKey,
  metric: MetricKey,
  prompt: string,
  reason: string,
  ruleIds: string[],
  urgency: "routine" | "priority" = "routine",
): NextCheck {
  return {
    id: `${domain}:${metric}`,
    domain,
    metric,
    prompt,
    reason,
    ruleIds,
    urgent: urgency === "priority",
  };
}

function preventive(
  area: PreventiveSuggestion["area"],
  title: string,
  detail: string,
  reason: string,
): PreventiveSuggestion {
  return { area, title, detail, reason };
}

/* ------------------------------------------------------------- domains */

type Evaluation = {
  category: Category;
  headline: string;
  explanation: string;
  facts: string[];
  evidence: EvidenceItem[];
  ruleIds: string[];
  assumptions: string[];
  dataGaps: string[];
  uncertainty: string[];
  preventive: PreventiveSuggestion[];
  nextCheck: NextCheck | null;
  references: ReferenceKey[];
  historyRefs: string[];
};

function historyLine(value: string | null | undefined): string {
  if (!value) return "unknown";
  return value;
}

function evaluateCardiovascular(ctx: Ctx): Evaluation {
  const { crew, mission } = ctx;
  const hr = fresh(ctx, "heartRate");
  const spo2 = fresh(ctx, "oxygenSaturation");
  const systolic = fresh(ctx, "systolicBloodPressure");
  const diastolic = fresh(ctx, "diastolicBloodPressure");
  const history = crew.history.cardiovascular;
  const hasConditionHistory = history.conditions.length > 0;
  const hypertension = history.knownHypertension === "yes";

  const facts: string[] = [];
  const evidence: EvidenceItem[] = [];
  const ruleIds: string[] = [];
  const priorityReasons: string[] = [];
  const reviewReasons: string[] = [];
  const dataGaps: string[] = [];
  const uncertainty: string[] = [];

  const restingHr =
    hr && hr.context !== "after_exercise" ? hr.numericValue : null;

  if (hr) {
    facts.push(
      `Heart rate ${formatMetricValue("heartRate", hr.numericValue, null)} recorded ${formatDateTime(hr.observedAt)} (${contextLabel(hr.context ?? "unknown")}, ${hr.sourceLabel}).`,
    );
    evidence.push(evidenceFromObservation(hr));
  } else {
    dataGaps.push("No heart rate inside the 72 h freshness window.");
  }

  if (spo2) {
    facts.push(
      `Oxygen saturation ${formatMetricValue("oxygenSaturation", spo2.numericValue, null)} recorded ${formatDateTime(spo2.observedAt)} (${spo2.sourceLabel}).`,
    );
    evidence.push(evidenceFromObservation(spo2));
  } else {
    dataGaps.push("No oxygen saturation inside the 72 h freshness window.");
  }

  if (systolic || diastolic) {
    const reading = `${systolic?.numericValue ?? "—"}/${diastolic?.numericValue ?? "—"} mmHg`;
    facts.push(
      `Blood pressure ${reading} recorded ${formatDateTime(systolic?.observedAt ?? diastolic?.observedAt ?? null)}.`,
    );
    if (systolic) evidence.push(evidenceFromObservation(systolic));
    if (diastolic) evidence.push(evidenceFromObservation(diastolic));
  }

  if (hypertension || hasConditionHistory) {
    const detail = [
      hypertension ? "documented hypertension" : null,
      ...history.conditions,
    ]
      .filter(Boolean)
      .join(", ");
    facts.push(`Cardiovascular history: ${detail}.`);
    evidence.push(
      historyEvidence(
        "Cardiovascular history",
        detail,
        "cardiovascular.conditions",
      ),
    );
  }

  if (restingHr !== null) {
    if (restingHr >= THRESHOLDS.heartRate.priorityRest) {
      priorityReasons.push(
        `Resting heart rate ${formatNumber(restingHr)} bpm is at or above the demonstration priority threshold of ${THRESHOLDS.heartRate.priorityRest} bpm.`,
      );
      ruleIds.push("CV-HR-PRIORITY-1");
    } else if (restingHr >= THRESHOLDS.heartRate.reviewRest) {
      reviewReasons.push(
        `Resting heart rate ${formatNumber(restingHr)} bpm exceeds the demonstration review threshold of ${THRESHOLDS.heartRate.reviewRest} bpm.`,
      );
      ruleIds.push("CV-HR-REVIEW-1");
    }
    if (
      hypertension &&
      restingHr >= THRESHOLDS.heartRate.priorityWithHypertension
    ) {
      priorityReasons.push(
        `Documented hypertension with a resting heart rate of ${formatNumber(restingHr)} bpm meets the tighter ${THRESHOLDS.heartRate.priorityWithHypertension} bpm combined rule.`,
      );
      ruleIds.push("CV-HTN-HR-1");
    }
  } else if (hr) {
    uncertainty.push(
      "The most recent heart rate was recorded after exercise, so it is not compared with resting thresholds. Rest and post-exercise values are not interchangeable.",
    );
    dataGaps.push(
      "No resting heart rate; only a post-exercise value is available.",
    );
  }

  if (spo2?.numericValue !== null && spo2?.numericValue !== undefined) {
    const value = spo2.numericValue;
    if (value <= THRESHOLDS.oxygenSaturation.priority) {
      priorityReasons.push(
        `Oxygen saturation ${formatNumber(value)}% is at or below the demonstration priority threshold of ${THRESHOLDS.oxygenSaturation.priority}%.`,
      );
      ruleIds.push("CV-SPO2-PRIORITY-1");
    } else if (value <= THRESHOLDS.oxygenSaturation.reviewUpper) {
      reviewReasons.push(
        `Oxygen saturation ${formatNumber(value)}% falls in the ${THRESHOLDS.oxygenSaturation.reviewLow}–${THRESHOLDS.oxygenSaturation.reviewUpper}% review band.`,
      );
      ruleIds.push("CV-SPO2-REVIEW-1");
    }
  }

  if (systolic?.numericValue != null) {
    const value = systolic.numericValue;
    if (value >= THRESHOLDS.bloodPressure.systolicPriority) {
      priorityReasons.push(
        `Systolic blood pressure ${formatNumber(value)} mmHg is at or above ${THRESHOLDS.bloodPressure.systolicPriority} mmHg.`,
      );
      ruleIds.push("CV-BP-PRIORITY-1");
    } else if (value >= THRESHOLDS.bloodPressure.systolicReview) {
      reviewReasons.push(
        `Systolic blood pressure ${formatNumber(value)} mmHg is at or above the ${THRESHOLDS.bloodPressure.systolicReview} mmHg review threshold.`,
      );
      ruleIds.push("CV-BP-REVIEW-1");
    }
  }
  if (diastolic?.numericValue != null) {
    const value = diastolic.numericValue;
    if (value >= THRESHOLDS.bloodPressure.diastolicPriority) {
      priorityReasons.push(
        `Diastolic blood pressure ${formatNumber(value)} mmHg is at or above ${THRESHOLDS.bloodPressure.diastolicPriority} mmHg.`,
      );
      ruleIds.push("CV-BP-PRIORITY-2");
    } else if (value >= THRESHOLDS.bloodPressure.diastolicReview) {
      reviewReasons.push(
        `Diastolic blood pressure ${formatNumber(value)} mmHg is at or above the ${THRESHOLDS.bloodPressure.diastolicReview} mmHg review threshold.`,
      );
      ruleIds.push("CV-BP-REVIEW-2");
    }
  }

  if (hasConditionHistory && priorityReasons.length === 0) {
    reviewReasons.push(
      "A documented cardiovascular condition is present; the demonstration rules keep it in review even when current vitals look unremarkable.",
    );
    ruleIds.push("CV-HISTORY-1");
  }

  if (mission?.evaRequired) {
    if (!hr || !spo2) {
      dataGaps.push(
        "This mission requires EVA: a current resting heart rate and oxygen saturation are needed before any EVA medical review.",
      );
      ruleIds.push("CV-EVA-DATA-1");
    }
  }

  let category: Category;
  if (priorityReasons.length > 0) category = "priority";
  else if (reviewReasons.length > 0) category = "review";
  else if (!hr && !spo2) category = "more_data";
  else if (mission?.evaRequired && (!hr || !spo2)) category = "more_data";
  else category = "no_flags";

  const headline =
    category === "priority"
      ? priorityReasons[0]
      : category === "review"
        ? reviewReasons[0]
        : category === "more_data"
          ? "Not enough current cardiovascular information to screen."
          : "Cardiovascular measures are inside the demonstration thresholds.";

  const explanation =
    category === "no_flags"
      ? `The most recent resting heart rate${restingHr !== null ? ` (${formatNumber(restingHr)} bpm)` : ""} and oxygen saturation${spo2?.numericValue != null ? ` (${formatNumber(spo2.numericValue)}%)` : ""} are inside the demonstration ranges. This is not a medical clearance and does not exclude disease.`
      : [...priorityReasons, ...reviewReasons].join(" ") ||
        "Recent cardiovascular values are missing, so no conclusion can be drawn.";

  const assumptions = [
    "Heart rate is compared only when the recorded context is rest or unknown; after-exercise values are excluded from resting thresholds.",
    "One value per metric is used: the most recent inside its freshness window (72 h for heart rate and oxygen saturation, 7 days for blood pressure).",
    `Demonstration thresholds: priority resting heart rate ≥ ${THRESHOLDS.heartRate.priorityRest} bpm, review ≥ ${THRESHOLDS.heartRate.reviewRest} bpm, oxygen saturation priority ≤ ${THRESHOLDS.oxygenSaturation.priority}%, review ≤ ${THRESHOLDS.oxygenSaturation.reviewUpper}%.`,
  ];

  const preventiveSuggestions: PreventiveSuggestion[] = [];
  if (category === "priority" || category === "review") {
    preventiveSuggestions.push(
      preventive(
        "monitoring",
        "Repeat the measurement at rest before exercise",
        "Sit quietly for five minutes and record heart rate, oxygen saturation and blood pressure again, marking the context as rest.",
        "A single elevated value may reflect activity, caffeine, stress or a poor cuff fit; a rest repeat is the cheapest way to separate those from a persistent pattern.",
      ),
      preventive(
        "review",
        "Escalate to the responsible medical officer",
        "Share this assessment and its evidence with the flight surgeon before assigning demanding activity.",
        "The demonstration rules flag significance, not a diagnosis. Authorised review decides what it means.",
      ),
      preventive(
        "hydration",
        "Keep fluid intake steady through the duty day",
        "Log hydration notes with each rest measurement so low intake can be excluded as a contributor.",
        "Dehydration can raise resting heart rate and reduce orthostatic tolerance; recording it keeps the comparison honest.",
      ),
    );
  } else {
    preventiveSuggestions.push(
      preventive(
        "exercise",
        "Keep the aerobic baseline steady",
        "Maintain the current daily exercise record so personal baselines stay comparable across the week.",
        "Comparable contexts and routines make a change detectable instead of hidden in variation.",
      ),
      preventive(
        "monitoring",
        "Record one resting reading each day",
        "Take heart rate and oxygen saturation at the same time of day, marked as rest.",
        "Frequent, consistent records make the freshness and baseline comparisons meaningful.",
      ),
    );
  }

  return {
    category,
    headline,
    explanation,
    facts,
    evidence,
    ruleIds: ruleIds.length > 0 ? ruleIds : ["CV-NONE-1"],
    assumptions,
    dataGaps,
    uncertainty,
    preventive: preventiveSuggestions,
    nextCheck:
      category === "more_data"
        ? nextCheck(
            "cardiovascular",
            "heartRate",
            "Record a resting heart rate",
            "The cardiovascular screen has no current resting value, so it cannot tell an unremarkable result from an unmeasured one.",
            ["CV-DATA-1"],
            mission?.evaRequired ? "priority" : "routine",
          )
        : category === "priority"
          ? nextCheck(
              "cardiovascular",
              "oxygenSaturation",
              "Record oxygen saturation at rest",
              "The cardiovascular screen is elevated; a current resting saturation is the fastest supporting measure for the review.",
              ["CV-FOLLOWUP-1"],
              "priority",
            )
          : nextCheck(
              "cardiovascular",
              "heartRate",
              "Repeat a resting heart rate tomorrow",
              "A second rest value shows whether the current reading is a persistent pattern or a single point.",
              ["CV-FOLLOWUP-2"],
            ),
    references: ["hrpCardio", "demoEngineering"],
    historyRefs:
      hasConditionHistory || hypertension
        ? ["cardiovascular.conditions", "cardiovascular.knownHypertension"]
        : [],
  };
}

function evaluateBoneHealth(ctx: Ctx): Evaluation {
  const { crew, mission } = ctx;
  const history = crew.history.boneMuscle;
  const exercise = series(ctx, "exerciseDuration", THRESHOLDS.lookbackDays);
  const exerciseMean = mean(numbersOf(exercise));
  const duration = mission?.durationDays ?? null;
  const longMission =
    duration !== null && duration >= THRESHOLDS.exercise.longDurationDays;
  const requiredMinutes = longMission
    ? THRESHOLDS.exercise.longDurationReviewMinutes
    : THRESHOLDS.exercise.reviewMinutesPerDay;
  const dataGaps: string[] = [];
  const uncertainty: string[] = [];
  const facts: string[] = [];
  const evidence: EvidenceItem[] = [];
  const ruleIds: string[] = [];

  if (exerciseMean !== null) {
    facts.push(
      `Loading exercise averages ${formatNumber(exerciseMean)} min/day across ${exercise.length} record${exercise.length === 1 ? "" : "s"} in the last ${THRESHOLDS.lookbackDays} days.`,
    );
    evidence.push(evidenceFromObservation(exercise[0]));
  } else {
    dataGaps.push(
      "No exercise record in the last 96 h, so loading history cannot be screened.",
    );
  }

  if (
    history.boneDensityConcern !== "unknown" ||
    history.priorFracture !== "unknown"
  ) {
    facts.push(
      `Bone history: density concern ${historyLine(history.boneDensityConcern)}, prior fracture ${historyLine(history.priorFracture)}.`,
    );
    evidence.push(
      historyEvidence(
        "Bone and muscle history",
        `density concern: ${historyLine(history.boneDensityConcern)} · prior fracture: ${historyLine(history.priorFracture)}`,
        "boneMuscle",
      ),
    );
  }

  if (longMission) {
    facts.push(
      `Applied mission duration is ${duration} days, so the long-duration loading floor of ${requiredMinutes} min/day applies.`,
    );
    ruleIds.push("BONE-DURATION-1");
  }

  let category: Category = "no_flags";
  const reasons: string[] = [];

  if (history.boneDensityConcern === "yes") {
    reasons.push(
      "A documented bone-density concern keeps bone-health monitoring in review regardless of current exercise.",
    );
    ruleIds.push("BONE-HISTORY-1");
    category = "review";
  }
  if (exerciseMean !== null && exerciseMean < requiredMinutes) {
    reasons.push(
      `Average loading exercise ${formatNumber(exerciseMean)} min/day is below the demonstration floor of ${requiredMinutes} min/day${longMission ? " for a mission of 180 days or more" : ""}.`,
    );
    ruleIds.push(longMission ? "BONE-EXERCISE-LONG-1" : "BONE-EXERCISE-1");
    category = category === "no_flags" ? "review" : category;
  }
  if (
    history.priorFracture === "yes" &&
    exerciseMean !== null &&
    exerciseMean < THRESHOLDS.exercise.reviewMinutesPerDay
  ) {
    reasons.push(
      "A prior fracture combined with reduced loading exercise adds a bone-health monitoring need.",
    );
    ruleIds.push("BONE-FRACTURE-1");
    category = category === "no_flags" ? "review" : category;
  }
  if (
    category === "no_flags" &&
    exerciseMean === null &&
    history.boneDensityConcern !== "no"
  ) {
    category = "more_data";
  }
  if (mission?.evaRequired && exerciseMean === null) {
    dataGaps.push(
      "EVA operations add load; without recent exercise records the loading picture is unknown.",
    );
  }

  uncertainty.push(
    "Exercise minutes are a proxy for mechanical loading only. They cannot measure bone mineral density, and no bone-loss forecast is made.",
  );

  return {
    category,
    headline:
      category === "review"
        ? reasons[0]
        : category === "more_data"
          ? "Exercise loading records are missing, so bone-health monitoring cannot be assessed."
          : "Loading exercise is at or above the demonstration floor.",
    explanation:
      category === "no_flags"
        ? `Loading exercise averages ${exerciseMean !== null ? `${formatNumber(exerciseMean)} min/day` : "an unknown amount"}, which meets the demonstration floor. Bone density is not measured by this app and cannot be inferred from exercise logs.`
        : reasons.join(" "),
    facts,
    evidence,
    ruleIds: ruleIds.length > 0 ? ruleIds : ["BONE-NONE-1"],
    assumptions: [
      "Only recorded exercise minutes are used; there is no bone-density measurement in this demonstration.",
      `The loading floor is ${THRESHOLDS.exercise.reviewMinutesPerDay} min/day, rising to ${THRESHOLDS.exercise.longDurationReviewMinutes} min/day when the applied mission is ${THRESHOLDS.exercise.longDurationDays} days or longer.`,
    ],
    dataGaps,
    uncertainty,
    preventive: [
      preventive(
        "exercise",
        "Protect the loading block, not just the total time",
        "Keep the daily resistive or treadmill loading session in the schedule even on busy duty days; log it immediately afterwards.",
        "Loading, rather than total activity minutes, is what the demonstration rules track for bone-health monitoring.",
      ),
      preventive(
        "nutrition",
        "Keep calcium and vitamin D intake as planned",
        "Follow the crew nutrition plan and note any missed intake in the hydration/nutrition note.",
        "Nutrition supports bone health; the app records intake notes but cannot assess bone mineral status.",
      ),
      preventive(
        "monitoring",
        "Report bone or joint pain as a new observation",
        "Add a note when pain limits loading exercise.",
        "Persistent pain that changes loading capacity is a reason for medical review, not an exercise tweak.",
      ),
    ],
    nextCheck:
      category === "more_data" || exerciseMean === null
        ? nextCheck(
            "boneHealth",
            "exerciseDuration",
            "Record today's loading exercise",
            "The bone-health screen needs recent exercise minutes before it can say anything useful.",
            ["BONE-DATA-1"],
          )
        : nextCheck(
            "boneHealth",
            "exerciseDuration",
            "Log tomorrow's loading session",
            "A second day of loading data shows whether the current pattern is a one-off or the weekly norm.",
            ["BONE-FOLLOWUP-1"],
          ),
    references: ["hrpBone", "demoEngineering"],
    historyRefs: ["boneMuscle.boneDensityConcern", "boneMuscle.priorFracture"],
  };
}

function evaluateMuscle(ctx: Ctx): Evaluation {
  const { crew, mission } = ctx;
  const history = crew.history.boneMuscle;
  const exercise = series(ctx, "exerciseDuration", THRESHOLDS.lookbackDays);
  const exerciseMean = mean(numbersOf(exercise));
  const longMission =
    (mission?.durationDays ?? 0) >= THRESHOLDS.exercise.longDurationDays;
  const floor = longMission
    ? THRESHOLDS.exercise.longDurationReviewMinutes
    : THRESHOLDS.exercise.reviewMinutesPerDay;
  const facts: string[] = [];
  const evidence: EvidenceItem[] = [];
  const ruleIds: string[] = [];
  const dataGaps: string[] = [];
  let category: Category = "no_flags";
  const reasons: string[] = [];

  if (exerciseMean !== null) {
    facts.push(
      `Average recorded exercise is ${formatNumber(exerciseMean)} min/day over the trailing ${THRESHOLDS.lookbackDays} days.`,
    );
    evidence.push(evidenceFromObservation(exercise[0]));
  } else {
    dataGaps.push("No exercise record inside the 96 h freshness window.");
  }
  if (history.muscleLossConcern !== "unknown") {
    facts.push(
      `Muscle-conditioning history: ${historyLine(history.muscleLossConcern)}.`,
    );
    evidence.push(
      historyEvidence(
        "Muscle conditioning history",
        historyLine(history.muscleLossConcern),
        "boneMuscle.muscleLossConcern",
      ),
    );
  }

  if (history.muscleLossConcern === "yes") {
    reasons.push(
      "A documented muscle-loss concern keeps conditioning in review; current exercise does not clear it.",
    );
    ruleIds.push("MUSCLE-HISTORY-1");
    category = "review";
  }
  if (exerciseMean !== null && exerciseMean < floor) {
    reasons.push(
      `Average exercise ${formatNumber(exerciseMean)} min/day is below the ${floor} min/day conditioning floor.`,
    );
    ruleIds.push("MUSCLE-VOLUME-1");
    if (
      history.muscleLossConcern === "yes" &&
      exerciseMean < THRESHOLDS.exercise.priorityMinutesPerDay
    ) {
      category = "priority";
      ruleIds.push("MUSCLE-PRIORITY-1");
      reasons.push(
        `Documented muscle-loss concern with under ${THRESHOLDS.exercise.priorityMinutesPerDay} min/day of exercise meets the demonstration priority rule.`,
      );
    } else if (category === "no_flags") {
      category = "review";
    }
  }
  if (
    category === "no_flags" &&
    exerciseMean === null &&
    history.muscleLossConcern !== "no"
  ) {
    category = "more_data";
  }

  return {
    category,
    headline:
      category === "no_flags"
        ? "Conditioning volume is inside the demonstration band."
        : category === "more_data"
          ? "No recent exercise record to assess conditioning."
          : reasons[0],
    explanation:
      category === "no_flags"
        ? "Recorded exercise meets the demonstration conditioning floor. Muscle mass and strength are not measured, so this is a volume check only."
        : reasons.join(" "),
    facts,
    evidence,
    ruleIds: ruleIds.length > 0 ? ruleIds : ["MUSCLE-NONE-1"],
    assumptions: [
      `Conditioning is inferred from recorded exercise minutes only (floor ${floor} min/day).`,
      "No strength, circumference or imaging measurement exists in this demonstration.",
    ],
    dataGaps,
    uncertainty: [
      "Exercise minutes do not measure muscle mass or strength; reduced minutes can also reflect schedule, not deconditioning.",
    ],
    preventive: [
      preventive(
        "exercise",
        "Restart with short, frequent loading",
        "Begin with two 10-minute resistive sessions per day and log each one.",
        "Short repeated loading is easier to sustain than a single long session and rebuilds a comparable record.",
      ),
      preventive(
        "nutrition",
        "Match protein intake to the training load",
        "Keep protein intake at the planned level and record missed meals.",
        "Protein intake supports adaptation to loading; the app records it but cannot measure body composition.",
      ),
    ],
    nextCheck: nextCheck(
      "muscleConditioning",
      "exerciseDuration",
      exerciseMean === null
        ? "Record today's exercise minutes"
        : "Record tomorrow's exercise minutes",
      "The conditioning screen compares weekly volume; one more recent day makes that comparison meaningful.",
      ["MUSCLE-DATA-1"],
    ),
    references: ["hrpMuscle", "demoEngineering"],
    historyRefs: ["boneMuscle.muscleLossConcern"],
  };
}

function evaluateSleep(ctx: Ctx): Evaluation {
  const { crew, mission } = ctx;
  const history = crew.history.sleepWellbeing;
  const sleepSeries = series(ctx, "sleepDuration", THRESHOLDS.lookbackDays);
  const sleepValues = numbersOf(sleepSeries);
  const sleepMedian = median(sleepValues);
  const latestSleep = fresh(ctx, "sleepDuration");
  const demanding = mission?.workload === "demanding";
  const floor =
    THRESHOLDS.sleep.reviewMedianHours +
    (demanding ? THRESHOLDS.demandingWorkloadSleepShift : 0);
  const facts: string[] = [];
  const evidence: EvidenceItem[] = [];
  const ruleIds: string[] = [];
  const dataGaps: string[] = [];
  let category: Category = "no_flags";
  const reasons: string[] = [];

  if (sleepValues.length > 0) {
    facts.push(
      `Median sleep ${formatNumber(sleepMedian, 1)} h across ${sleepValues.length} record${sleepValues.length === 1 ? "" : "s"} in the last ${THRESHOLDS.lookbackDays} days.`,
    );
    evidence.push(evidenceFromObservation(sleepSeries[0]));
    if (latestSleep)
      facts.push(
        `Most recent sleep ${formatMetricValue("sleepDuration", latestSleep.numericValue, null)} on ${formatDateTime(latestSleep.observedAt)}.`,
      );
  } else {
    dataGaps.push("No sleep duration recorded in the last 48 h.");
  }
  if (demanding) {
    facts.push(
      `The applied mission workload is demanding, which raises the demonstration sleep floor to ${floor} h.`,
    );
    ruleIds.push("SLEEP-WORKLOAD-1");
  }
  if (history.baselineSleepHours !== null) {
    facts.push(
      `Crew-reported habitual sleep is ${history.baselineSleepHours} h.`,
    );
    evidence.push(
      historyEvidence(
        "Habitual sleep",
        `${history.baselineSleepHours} h`,
        "sleepWellbeing.baselineSleepHours",
      ),
    );
  }

  if (sleepMedian !== null) {
    if (sleepMedian < THRESHOLDS.sleep.priorityMedianHours) {
      reasons.push(
        `Seven-day median sleep ${formatNumber(sleepMedian, 1)} h is below the demonstration priority floor of ${THRESHOLDS.sleep.priorityMedianHours} h.`,
      );
      ruleIds.push("SLEEP-PRIORITY-1");
      category = "priority";
    } else if (
      latestSleep?.numericValue != null &&
      latestSleep.numericValue < THRESHOLDS.sleep.prioritySingleNightHours
    ) {
      reasons.push(
        `The most recent night was ${formatNumber(latestSleep.numericValue, 1)} h, below the ${THRESHOLDS.sleep.prioritySingleNightHours} h single-night priority floor.`,
      );
      ruleIds.push("SLEEP-PRIORITY-2");
      category = "priority";
    } else if (sleepMedian < floor) {
      reasons.push(
        `Median sleep ${formatNumber(sleepMedian, 1)} h is below the demonstration floor of ${floor} h${demanding ? " (raised for demanding workload)" : ""}.`,
      );
      ruleIds.push("SLEEP-REVIEW-1");
      category = "review";
    }
  }
  if (
    history.insomniaHistory === "yes" &&
    category !== "priority" &&
    sleepMedian !== null &&
    sleepMedian < floor + 0.5
  ) {
    reasons.push(
      "Documented insomnia history with borderline sleep keeps sleep restriction in review.",
    );
    ruleIds.push("SLEEP-HISTORY-1");
    category = category === "no_flags" ? "review" : category;
  }
  if (category === "no_flags" && sleepMedian === null) {
    category = "more_data";
  }

  return {
    category,
    headline:
      category === "no_flags"
        ? "Sleep duration is at or above the demonstration floor."
        : category === "more_data"
          ? "No current sleep record, so sleep restriction cannot be screened."
          : reasons[0],
    explanation:
      category === "no_flags"
        ? `Median sleep is ${sleepMedian !== null ? `${formatNumber(sleepMedian, 1)} h` : "unknown"}, at or above the ${floor} h demonstration floor. This does not prove adequate recovery; sleep quality is not measured.`
        : reasons.join(" "),
    facts,
    evidence,
    ruleIds: ruleIds.length > 0 ? ruleIds : ["SLEEP-NONE-1"],
    assumptions: [
      `Sleep is screened on the median of recorded nights in the trailing ${THRESHOLDS.lookbackDays} days; one night alone can miss restriction.`,
      `Priority floor ${THRESHOLDS.sleep.priorityMedianHours} h median or ${THRESHOLDS.sleep.prioritySingleNightHours} h for the latest night; review floor ${THRESHOLDS.sleep.reviewMedianHours} h${demanding ? ", raised to 6.5 h for demanding workload" : ""}.`,
      "Durations are self-reported and not measured by the app.",
    ],
    dataGaps,
    uncertainty: [
      "Sleep duration is self-reported and says nothing about sleep quality or circadian timing.",
      "Short sleep can be intentional (duty schedule) or a symptom; the app cannot tell which.",
    ],
    preventive: [
      preventive(
        "sleep",
        "Protect a 7.5 h sleep opportunity",
        "Plan the sleep period with a fixed start time, dim lighting before bed and no late caffeine.",
        "A protected opportunity is the most direct way to lift recorded duration; the app records what actually happened.",
      ),
      preventive(
        "monitoring",
        "Log sleep and fatigue together each morning",
        "Record sleep hours and the 0–10 fatigue rating at the same time.",
        "Pairing the two shows whether short sleep is translating into reported fatigue.",
      ),
      preventive(
        "stress",
        "Use the planned wind-down routine",
        "Keep the pre-sleep routine and note any disruption in the sleep record.",
        "Consistent routine supports sleep onset; the app records the routine but cannot measure sleep stages.",
      ),
    ],
    nextCheck: nextCheck(
      "sleepRestriction",
      "sleepDuration",
      "Record last night's sleep duration",
      category === "more_data"
        ? "Sleep restriction cannot be screened without a current night of sleep data."
        : "A current night keeps the seven-day median meaningful and shows whether restriction persists.",
      ["SLEEP-DATA-1"],
      category === "priority" ? "priority" : "routine",
    ),
    references: ["hrpSleep", "demoEngineering"],
    historyRefs: [
      "sleepWellbeing.baselineSleepHours",
      "sleepWellbeing.insomniaHistory",
    ],
  };
}

function evaluateFatigue(ctx: Ctx): Evaluation {
  const history = ctx.crew.history.sleepWellbeing;
  const fatigue = fresh(ctx, "fatigue");
  const sleepSeries = series(ctx, "sleepDuration", THRESHOLDS.lookbackDays);
  const sleepMedian = median(numbersOf(sleepSeries));
  const facts: string[] = [];
  const evidence: EvidenceItem[] = [];
  const ruleIds: string[] = [];
  const dataGaps: string[] = [];
  const reasons: string[] = [];
  let category: Category = "no_flags";

  if (fatigue?.numericValue != null) {
    facts.push(
      `Self-reported fatigue ${formatNumber(fatigue.numericValue)}/10 on ${formatDateTime(fatigue.observedAt)} (${fatigue.sourceLabel}).`,
    );
    evidence.push(evidenceFromObservation(fatigue));
    if (fatigue.numericValue >= THRESHOLDS.fatigue.priorityScore) {
      reasons.push(
        `Fatigue ${formatNumber(fatigue.numericValue)}/10 meets the demonstration priority threshold of ${THRESHOLDS.fatigue.priorityScore}.`,
      );
      ruleIds.push("FATIGUE-PRIORITY-1");
      category = "priority";
    } else if (fatigue.numericValue >= THRESHOLDS.fatigue.reviewScore) {
      reasons.push(
        `Fatigue ${formatNumber(fatigue.numericValue)}/10 meets the demonstration review threshold of ${THRESHOLDS.fatigue.reviewScore}.`,
      );
      ruleIds.push("FATIGUE-REVIEW-1");
      category = "review";
    }
  } else {
    dataGaps.push("No fatigue rating in the last 48 h.");
  }

  if (sleepMedian !== null) {
    facts.push(
      `Median sleep in the same window is ${formatNumber(sleepMedian, 1)} h.`,
    );
    if (
      fatigue?.numericValue != null &&
      fatigue.numericValue >= THRESHOLDS.fatigue.reviewScore &&
      sleepMedian < THRESHOLDS.sleep.reviewMedianHours
    ) {
      facts.push("Reported fatigue and short sleep co-occur in this window.");
      ruleIds.push("FATIGUE-SLEEP-1");
    }
  }
  if (history.anxietyHistory === "yes") {
    facts.push(
      "Behavioural-health history records anxiety, which can overlap with fatigue.",
    );
  }
  if (category === "no_flags" && !fatigue) {
    category = "more_data";
  }

  return {
    category,
    headline:
      category === "no_flags"
        ? "Reported fatigue is below the demonstration review threshold."
        : category === "more_data"
          ? "No recent fatigue rating to screen."
          : reasons[0],
    explanation:
      category === "no_flags"
        ? `Fatigue is reported at ${fatigue?.numericValue != null ? `${formatNumber(fatigue.numericValue)}/10` : "an unknown level"}, below the ${THRESHOLDS.fatigue.reviewScore}/10 review threshold. A subjective rating cannot exclude fatigue-related risk on its own.`
        : reasons.join(" "),
    facts,
    evidence,
    ruleIds: ruleIds.length > 0 ? ruleIds : ["FATIGUE-NONE-1"],
    assumptions: [
      "Fatigue is a 0–10 self-report, recorded as reported and never inferred from other metrics.",
      `Review at ${THRESHOLDS.fatigue.reviewScore}/10, priority at ${THRESHOLDS.fatigue.priorityScore}/10.`,
    ],
    dataGaps,
    uncertainty: [
      "Self-reported fatigue is subjective and can be under- or over-stated depending on crew culture and duty pressure.",
    ],
    preventive: [
      preventive(
        "sleep",
        "Use a recovery sleep block before demanding work",
        "Schedule the next sleep opportunity above 7.5 h and protect it from task creep.",
        "Reported fatigue at this level is usually paired with accumulated sleep debt.",
      ),
      preventive(
        "monitoring",
        "Re-rate fatigue before the next demanding task",
        "Record the 0–10 rating immediately before the task, not at the end of the day.",
        "A pre-task rating is more useful for duty planning than a retrospective one.",
      ),
      preventive(
        "stress",
        "Report workload pressure explicitly",
        "Add a note when duty load, not sleep, is driving fatigue.",
        "Fatigue has multiple causes; recording the driver keeps the care plan relevant.",
      ),
    ],
    nextCheck: nextCheck(
      "fatigue",
      "fatigue",
      "Record the current fatigue rating",
      category === "more_data"
        ? "The fatigue screen needs a current self-report."
        : "A second rating shows whether fatigue is resolving or persistent.",
      ["FATIGUE-DATA-1"],
      category === "priority" ? "priority" : "routine",
    ),
    references: ["hrpBehavioural", "demoEngineering"],
    historyRefs: ["sleepWellbeing.anxietyHistory"],
  };
}

function evaluateVision(ctx: Ctx): Evaluation {
  const history = ctx.crew.history.vision;
  const report = fresh(ctx, "visionChange");
  const facts: string[] = [];
  const evidence: EvidenceItem[] = [];
  const ruleIds: string[] = [];
  const dataGaps: string[] = [];
  const reasons: string[] = [];
  let category: Category = "no_flags";

  if (report) {
    facts.push(
      `Vision report on ${formatDateTime(report.observedAt)}: ${formatMetricValue("visionChange", null, report.textValue)} (${report.sourceLabel}).`,
    );
    evidence.push(evidenceFromObservation(report));
  } else {
    dataGaps.push(
      "No vision report in the last 14 days. An unanswered field is not the same as 'no change reported'.",
    );
  }
  if (
    history.priorVisionChanges !== "unknown" ||
    history.correctiveLenses !== "unknown"
  ) {
    facts.push(
      `Vision history: prior changes ${historyLine(history.priorVisionChanges)}, corrective lenses ${historyLine(history.correctiveLenses)}.`,
    );
    evidence.push(
      historyEvidence(
        "Vision history",
        `prior changes: ${historyLine(history.priorVisionChanges)} · lenses: ${historyLine(history.correctiveLenses)}`,
        "vision",
      ),
    );
  }

  if (report?.textValue === "changes_reported") {
    if (history.priorVisionChanges === "yes") {
      reasons.push(
        "A reported vision change with a history of prior vision changes meets the demonstration priority rule.",
      );
      ruleIds.push("VISION-PRIORITY-1");
      category = "priority";
    } else {
      reasons.push(
        "A vision change is reported; the demonstration rules require review before assignment.",
      );
      ruleIds.push("VISION-REVIEW-1");
      category = "review";
    }
  } else if (report?.textValue === "no_change") {
    facts.push(
      "The crew member explicitly reported no vision change, which differs from leaving the field unanswered.",
    );
  } else if (!report) {
    category = "more_data";
  }

  return {
    category,
    headline:
      category === "no_flags"
        ? "No vision change is currently reported."
        : category === "review"
          ? reasons[0]
          : category === "priority"
            ? reasons[0]
            : "No current vision report, so vision changes cannot be screened.",
    explanation:
      category === "no_flags"
        ? "The most recent explicit vision report states no change. This is a self-report; it does not assess the retina, optic disc or refraction."
        : reasons.join(" ") ||
          "The vision field is unanswered. Silence is treated as unknown, not as a normal finding.",
    facts,
    evidence,
    ruleIds: ruleIds.length > 0 ? ruleIds : ["VISION-NONE-1"],
    assumptions: [
      "Vision screening uses the most recent explicit report inside a 14-day freshness window.",
      "An unanswered vision field is treated as unknown and never as 'no change'.",
      "Self-report cannot diagnose a spaceflight-associated neuro-ocular condition.",
    ],
    dataGaps,
    uncertainty: [
      "A reported change is a symptom description, not a clinical finding; severity cannot be graded from a self-report.",
    ],
    preventive: [
      preventive(
        "monitoring",
        "Record the next explicit vision check",
        "Ask the crew member to state either 'no change reported' or 'changes reported' at the next scheduled check.",
        "An explicit statement keeps unknown and normal distinct in the record.",
      ),
      preventive(
        "review",
        "Arrange a clinical eye assessment",
        "Refer a reported change for authorised ophthalmological review before demanding visual tasks.",
        "Only clinical examination can characterise a vision change; the app cannot.",
      ),
    ],
    nextCheck: nextCheck(
      "visionChange",
      "visionChange",
      "Record the current vision report",
      category === "more_data"
        ? "The vision field is unanswered, so a normal result cannot be assumed."
        : "A repeat report shows whether the change persists and whether review is still needed.",
      ["VISION-DATA-1"],
      category === "priority" ? "priority" : "routine",
    ),
    references: ["hrpVision", "demoEngineering"],
    historyRefs: ["vision.priorVisionChanges", "vision.correctiveLenses"],
  };
}

function evaluateStress(ctx: Ctx): Evaluation {
  const history = ctx.crew.history.sleepWellbeing;
  const stress = fresh(ctx, "stress");
  const sleepSeries = series(ctx, "sleepDuration", THRESHOLDS.lookbackDays);
  const sleepMedian = median(numbersOf(sleepSeries));
  const facts: string[] = [];
  const evidence: EvidenceItem[] = [];
  const ruleIds: string[] = [];
  const dataGaps: string[] = [];
  const reasons: string[] = [];
  let category: Category = "no_flags";

  if (stress?.numericValue != null) {
    facts.push(
      `Self-reported stress ${formatNumber(stress.numericValue)}/10 on ${formatDateTime(stress.observedAt)}.`,
    );
    evidence.push(evidenceFromObservation(stress));
    if (stress.numericValue >= THRESHOLDS.stress.priorityScore) {
      reasons.push(
        `Stress ${formatNumber(stress.numericValue)}/10 meets the demonstration priority threshold of ${THRESHOLDS.stress.priorityScore}.`,
      );
      ruleIds.push("STRESS-PRIORITY-1");
      category = "priority";
    } else if (stress.numericValue >= THRESHOLDS.stress.reviewScore) {
      reasons.push(
        `Stress ${formatNumber(stress.numericValue)}/10 meets the demonstration review threshold of ${THRESHOLDS.stress.reviewScore}.`,
      );
      ruleIds.push("STRESS-REVIEW-1");
      category = "review";
    }
  } else {
    dataGaps.push("No stress rating in the last 72 h.");
  }
  if (history.anxietyHistory === "yes" && category !== "priority") {
    facts.push("Behavioural-health history records anxiety.");
    ruleIds.push("STRESS-HISTORY-1");
    if (category === "no_flags" && stress) category = "review";
  }
  if (
    sleepMedian !== null &&
    stress?.numericValue != null &&
    stress.numericValue >= THRESHOLDS.stress.reviewScore &&
    sleepMedian < THRESHOLDS.sleep.reviewMedianHours
  ) {
    facts.push(
      `Elevated stress coincides with a ${formatNumber(sleepMedian, 1)} h sleep median.`,
    );
    ruleIds.push("STRESS-SLEEP-1");
  }
  if (category === "no_flags" && !stress) category = "more_data";

  return {
    category,
    headline:
      category === "no_flags"
        ? "Reported stress is below the demonstration review threshold."
        : category === "more_data"
          ? "No recent stress rating to screen."
          : reasons[0],
    explanation:
      category === "no_flags"
        ? `Stress is reported at ${stress?.numericValue != null ? `${formatNumber(stress.numericValue)}/10` : "an unknown level"}, below the ${THRESHOLDS.stress.reviewScore}/10 review threshold. A single rating cannot describe behavioural health.`
        : reasons.join(" "),
    facts,
    evidence,
    ruleIds: ruleIds.length > 0 ? ruleIds : ["STRESS-NONE-1"],
    assumptions: [
      "Stress is a 0–10 self-report; nothing is inferred from speech, behaviour or other metrics.",
      `Review at ${THRESHOLDS.stress.reviewScore}/10, priority at ${THRESHOLDS.stress.priorityScore}/10.`,
    ],
    dataGaps,
    uncertainty: [
      "Subjective ratings can be influenced by reporting culture; they are a conversation starter, not a diagnosis.",
    ],
    preventive: [
      preventive(
        "stress",
        "Schedule a protected recovery period",
        "Plan a low-demand block with communication with home and a private space.",
        "Behavioural health support works best before stress accumulates further.",
      ),
      preventive(
        "monitoring",
        "Re-rate stress and sleep daily for a week",
        "Record both ratings each morning so a trend is visible.",
        "Trends are more informative than a single rating and make review conversations concrete.",
      ),
    ],
    nextCheck: nextCheck(
      "stressWellbeing",
      "stress",
      "Record the current stress rating",
      "The stress screen needs a current self-report to separate a passed peak from a persistent pattern.",
      ["STRESS-DATA-1"],
      category === "priority" ? "priority" : "routine",
    ),
    references: ["hrpBehavioural", "demoEngineering"],
    historyRefs: ["sleepWellbeing.anxietyHistory"],
  };
}

function evaluateRespiratory(ctx: Ctx): Evaluation {
  const history = ctx.crew.history.respiratory;
  const spo2 = fresh(ctx, "oxygenSaturation");
  const facts: string[] = [];
  const evidence: EvidenceItem[] = [];
  const ruleIds: string[] = [];
  const dataGaps: string[] = [];
  const reasons: string[] = [];
  let category: Category = "no_flags";

  if (spo2?.numericValue != null) {
    facts.push(
      `Oxygen saturation ${formatNumber(spo2.numericValue)}% on ${formatDateTime(spo2.observedAt)} (${contextLabel(spo2.context ?? "unknown")}, ${spo2.sourceLabel}).`,
    );
    evidence.push(evidenceFromObservation(spo2));
    if (spo2.numericValue <= THRESHOLDS.oxygenSaturation.reviewLow) {
      reasons.push(
        `Oxygen saturation ${formatNumber(spo2.numericValue)}% is at or below the ${THRESHOLDS.oxygenSaturation.reviewLow}% demonstration threshold.`,
      );
      ruleIds.push("RESP-PRIORITY-1");
      category = "priority";
    } else if (spo2.numericValue <= THRESHOLDS.oxygenSaturation.reviewUpper) {
      reasons.push(
        `Oxygen saturation ${formatNumber(spo2.numericValue)}% falls in the 93–${THRESHOLDS.oxygenSaturation.reviewUpper}% review band.`,
      );
      ruleIds.push("RESP-REVIEW-1");
      category = "review";
    }
  } else {
    dataGaps.push("No oxygen saturation inside the 72 h freshness window.");
  }
  if (history.asthma === "yes") {
    facts.push("Respiratory history records asthma.");
    evidence.push(
      historyEvidence(
        "Respiratory history",
        "asthma: yes",
        "respiratory.asthma",
      ),
    );
    ruleIds.push("RESP-HISTORY-1");
    if (category === "no_flags" && spo2) category = "review";
  }
  if (category === "no_flags" && !spo2) category = "more_data";

  return {
    category,
    headline:
      category === "no_flags"
        ? "Oxygen saturation is inside the demonstration band."
        : category === "review"
          ? reasons[0]
          : category === "priority"
            ? reasons[0]
            : "No current oxygen saturation to screen.",
    explanation:
      category === "no_flags"
        ? "The most recent oxygen saturation is inside the demonstration band. A pulse oximetry value cannot diagnose respiratory disease, and altitude or sensor placement can affect it."
        : reasons.join(" ") ||
          "No current saturation value, so the respiratory screen cannot conclude anything.",
    facts,
    evidence,
    ruleIds: ruleIds.length > 0 ? ruleIds : ["RESP-NONE-1"],
    assumptions: [
      `Priority at ${THRESHOLDS.oxygenSaturation.reviewLow}% or below, review at ${THRESHOLDS.oxygenSaturation.reviewUpper}% or below.`,
      "Only entered or simulated oximetry values are used; the app has no sensor.",
    ],
    dataGaps,
    uncertainty: [
      "Peripheral saturation can be affected by cold extremities, nail polish, motion or sensor placement; a single reading is not a diagnosis.",
    ],
    preventive: [
      preventive(
        "monitoring",
        "Repeat the saturation at rest, warm hands",
        "Rest for five minutes, warm the hands and repeat with the same device.",
        "A repeat removes the most common measurement artefacts before any escalation.",
      ),
      preventive(
        "review",
        "Escalate breathlessness immediately",
        "Follow the crew emergency procedure for breathing difficulty rather than waiting for the next questionnaire step.",
        "Breathing difficulty is an emergency pathway, not a screening question.",
      ),
    ],
    nextCheck: nextCheck(
      "respiratory",
      "oxygenSaturation",
      "Record oxygen saturation at rest",
      category === "more_data"
        ? "The respiratory screen has no current saturation value."
        : "A repeat value shows whether the low reading persists.",
      ["RESP-DATA-1"],
      category === "priority" ? "priority" : "routine",
    ),
    references: ["hrpCardio", "demoEngineering"],
    historyRefs: ["respiratory.asthma"],
  };
}

const EVALUATORS: Record<DomainKey, (ctx: Ctx) => Evaluation> = {
  cardiovascular: evaluateCardiovascular,
  boneHealth: evaluateBoneHealth,
  muscleConditioning: evaluateMuscle,
  sleepRestriction: evaluateSleep,
  fatigue: evaluateFatigue,
  visionChange: evaluateVision,
  stressWellbeing: evaluateStress,
  respiratory: evaluateRespiratory,
};

function toDomainAssessment(ctx: Ctx, domain: DomainKey): DomainAssessment {
  const definition = DOMAINS[domain];
  const evaluation = EVALUATORS[domain](ctx);
  const freshness = domainFreshness(ctx, definition.metrics);
  const completeness = domainCompleteness(ctx, definition.metrics);
  const gaps = [
    ...new Set([
      ...evaluation.dataGaps,
      ...missingGaps(ctx, definition.metrics, definition.label),
    ]),
  ];
  const snapped = definition.metrics.map((metric) => snapshot(ctx, metric));

  return {
    domain,
    scientificContext: {
      ...DOMAIN_SCIENCE[domain],
      thresholdBasis:
        "Illustrative demo rules; agency sources support monitoring relevance only and do not validate these numeric cutoffs.",
    },
    label: definition.label,
    category: evaluation.category,
    headline: evaluation.headline,
    explanation: evaluation.explanation,
    facts: evaluation.facts,
    evidence: evaluation.evidence,
    observationIds: evaluation.evidence
      .map((item) => item.observationId)
      .filter((value): value is string => Boolean(value)),
    historyRefs: evaluation.historyRefs,
    ruleIds: evaluation.ruleIds,
    assumptions: evaluation.assumptions,
    dataGaps: gaps,
    uncertainty: evaluation.uncertainty,
    preventive: evaluation.preventive,
    nextCheck: evaluation.nextCheck,
    references: [
      ...new Set([
        ...evaluation.references,
        ...DOMAIN_SCIENCE[domain].referenceKeys,
      ]),
    ],
    metrics: snapped.map((item) => ({
      ...item,
      streamLabel: ctx.observations.find(
        (observation) => observation.metric === item.metric,
      )?.streamId
        ? "Simulation stream"
        : null,
    })),
    freshness,
    completeness,
  };
}

function buildBaselines(ctx: Ctx): BaselineSummary[] {
  return RELEVANT_METRICS.filter(
    (metric) => METRICS[metric].kind === "number",
  ).map((metric) => {
    const definition = METRICS[metric];
    const windowDays = 14;
    const history = series(ctx, metric, windowDays);
    const values = numbersOf(history);
    const average = mean(values);
    const latestValue = fresh(ctx, metric)?.numericValue ?? null;
    return {
      metric,
      label: definition.label,
      unit: definition.unit,
      mean: average,
      sampleCount: values.length,
      windowDays,
      latestValue,
      delta:
        average !== null && latestValue !== null ? latestValue - average : null,
      note:
        values.length === 0
          ? "No values in the comparison window."
          : `Descriptive comparison only: mean of ${values.length} recorded value${values.length === 1 ? "" : "s"} in the trailing ${windowDays} days. Not a prediction.`,
    };
  });
}

function buildNextStep(
  domains: DomainAssessment[],
  casesByDomain: Map<DomainKey, string>,
): AssessmentBundle["nextStep"] {
  const ordered = [...domains].sort(
    (left, right) =>
      CATEGORY_RANK[left.category] - CATEGORY_RANK[right.category],
  );
  const lead = ordered[0];
  if (!lead) return null;
  const meta = CATEGORY_META[lead.category];
  const check = lead.nextCheck;
  if (lead.category === "no_flags") {
    const stale = domains.find((domain) => domain.freshness.status !== "fresh");
    if (stale) {
      return {
        title: `Refresh ${stale.label.toLowerCase()} data`,
        detail: `No demonstration flag is present. ${stale.freshness.label}. Recording one new value keeps the screening current.`,
        domain: stale.domain,
        category: lead.category,
        check: stale.nextCheck,
        openCaseId: casesByDomain.get(stale.domain) ?? null,
      };
    }
    return {
      title: "Keep routine monitoring",
      detail:
        "No demonstration screening flag is present and current data is available. Formal medical clearance still belongs to authorised personnel.",
      domain: lead.domain,
      category: lead.category,
      check: null,
      openCaseId: null,
    };
  }
  return {
    title:
      lead.category === "priority"
        ? `Priority review: ${lead.label.toLowerCase()}`
        : lead.category === "review"
          ? `Review before assignment: ${lead.label.toLowerCase()}`
          : `Record the missing ${check ? METRICS[check.metric].label.toLowerCase() : "measurement"}`,
    detail:
      `${meta.meaning} ${check ? `Next useful check: ${check.prompt.toLowerCase()}.` : ""}`.trim(),
    domain: lead.domain,
    category: lead.category,
    check,
    openCaseId: casesByDomain.get(lead.domain) ?? null,
  };
}

export function buildAssessment(
  input: ScreeningInput,
  casesByDomain = new Map<DomainKey, string>(),
): AssessmentBundle {
  const now = input.now ?? new Date();
  const ctx: Ctx = {
    crew: input.crew,
    observations: input.observations.filter(
      (o) => Date.parse(o.observedAt) <= now.getTime(),
    ),
    mission: input.mission,
    now,
  };

  const domains = (Object.keys(DOMAINS) as DomainKey[])
    .map((domain) => toDomainAssessment(ctx, domain))
    .sort((left, right) => {
      const byCategory =
        CATEGORY_RANK[left.category] - CATEGORY_RANK[right.category];
      if (byCategory !== 0) return byCategory;
      return DOMAINS[left.domain].label.localeCompare(
        DOMAINS[right.domain].label,
      );
    });

  const missing = RELEVANT_METRICS.filter(
    (metric) => fresh(ctx, metric) === null,
  );
  const available = RELEVANT_METRIC_COUNT - missing.length;
  const dataGaps = Array.from(
    new Set(domains.flatMap((domain) => domain.dataGaps)),
  );

  const missionInfluences: string[] = [];
  if (ctx.mission) {
    missionInfluences.push(
      `Mission duration (${ctx.mission.durationDays} days) changes the bone and conditioning loading floor when it reaches ${THRESHOLDS.exercise.longDurationDays} days.`,
    );
    missionInfluences.push(
      `Workload "${ctx.mission.workload}" raises the sleep review floor by ${THRESHOLDS.demandingWorkloadSleepShift} h when demanding.`,
    );
    missionInfluences.push(
      `EVA requirement ${ctx.mission.evaRequired ? "adds a pre-EVA data check for resting heart rate and oxygen saturation" : "is not set, so no pre-EVA data check is added"}.`,
    );
    missionInfluences.push(
      `Destination (${ctx.mission.destination}) and activity level (${ctx.mission.activityLevel}) are descriptive metadata only; they do not change any demonstration threshold.`,
    );
  } else {
    missionInfluences.push(
      "No mission has been applied, so mission-dependent thresholds use defaults.",
    );
  }

  const spaceContext = buildSpaceContext({
    crewId: input.crew.id,
    streamId: input.stream?.id ?? null,
    logs: input.missionLogs ?? [],
    domains,
    mission: ctx.mission,
    now,
  });
  return {
    spaceContext,
    crew: input.crew,
    mission: ctx.mission,
    stream: input.stream ?? null,
    ruleSetVersion: input.ruleSetVersion ?? RULE_SET_VERSION,
    assessedAt: now.toISOString(),
    timezoneLabel: APP_TIMEZONE,
    overallCategory: worstCategory(domains.map((domain) => domain.category)),
    domains,
    completeness: { available, total: RELEVANT_METRIC_COUNT, missing },
    dataGaps,
    nextStep: buildNextStep(domains, casesByDomain),
    baselines: buildBaselines(ctx),
    missionInfluences,
  };
}

/** Convenience for tests and screens that only need one domain. */
export function buildDomainAssessment(
  input: ScreeningInput,
  domain: DomainKey,
): DomainAssessment {
  const bundle = buildAssessment(input);
  const found = bundle.domains.find((item) => item.domain === domain);
  if (!found) throw new Error(`Unknown domain: ${domain}`);
  return found;
}

export const SCREENING_HELPERS = {
  mean,
  median,
  isFresh,
  ageInHours,
  sortedDesc,
  Day: DAY,
};
