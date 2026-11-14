import { describe, expect, it } from "vitest";

import type { CrewProfile, Observation } from "../shared/domain";
import { buildAssessment } from "../shared/screening";
import { allowedTransitions, canTransition, scheduledTransitions } from "../shared/handover";
import { radiationDataSchema } from "../shared/mission-context";
import { parseImportText, sanitiseCsvCell, suggestMapping, validateImport } from "../shared/importing";
import { METRICS } from "../shared/constants";

const NOW = new Date("2026-11-14T06:00:00.000Z");

function crew(overrides: Partial<CrewProfile> = {}): CrewProfile {
  return {
    id: "crew-test",
    displayName: "Test Astronaut",
    callSign: "Test",
    role: "Mission specialist",
    age: 38,
    sexAtBirth: "Female",
    heightCm: 170,
    weightKg: 64,
    bloodType: "O+",
    missions: ["Demo mission"],
    archived: false,
    history: {
      previousConditions: [],
      injuriesSurgeries: [],
      medications: [],
      allergies: [],
      familyHistory: [],
      cardiovascular: { conditions: [], knownHypertension: "no", notes: "" },
      boneMuscle: { boneDensityConcern: "no", priorFracture: "no", muscleLossConcern: "no", notes: "" },
      sleepWellbeing: { baselineSleepHours: 7.5, insomniaHistory: "no", anxietyHistory: "no", notes: "" },
      vision: { correctiveLenses: "no", priorVisionChanges: "no", notes: "" },
      respiratory: { asthma: "no", notes: "" },
      missionHistory: { previousConcerns: [], evaHours: 0, notes: "" },
    },
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function observation(metric: keyof typeof METRICS, value: number, hoursAgo: number): Observation {
  const observedAt = new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();
  return {
    id: `obs-${metric}-${hoursAgo}`,
    crewId: "crew-test",
    metric,
    numericValue: value,
    textValue: null,
    unit: METRICS[metric].unit,
    context: null,
    observedAt,
    sourceKind: "seed",
    sourceLabel: "Test fixture",
    streamId: null,
    importBatchId: null,
    note: null,
    createdAt: observedAt,
  };
}

describe("screening: unknown data is never a reassuring result", () => {
  it("keeps a domain in More Data Needed when nothing is recorded, instead of No Demo Flags", () => {
    const bundle = buildAssessment({
      crew: crew(),
      observations: [],
      mission: null,
      now: NOW,
    });
    expect(bundle.overallCategory).not.toBe("no_flags");
    const respiratory = bundle.domains.find((domain) => domain.domain === "respiratory");
    expect(respiratory?.category).toBe("more_data");
    expect(bundle.completeness.available).toBe(0);
    expect(bundle.dataGaps.length).toBeGreaterThan(0);
  });

  it("distinguishes an explicit zero from a missing value", () => {
    const withZero = buildAssessment({
      crew: crew(),
      observations: [observation("exerciseDuration", 0, 1)],
      mission: null,
      now: NOW,
    });
    const muscle = withZero.domains.find((domain) => domain.domain === "muscleConditioning");
    const exercise = muscle?.metrics.find((snapshot) => snapshot.metric === "exerciseDuration");
    expect(exercise?.missing).toBe(false);
    expect(exercise?.value).toContain("0");

    const missing = buildAssessment({ crew: crew(), observations: [], mission: null, now: NOW });
    const missingMuscle = missing.domains.find((domain) => domain.domain === "muscleConditioning");
    expect(
      missingMuscle?.metrics.find((snapshot) => snapshot.metric === "exerciseDuration")?.missing,
    ).toBe(true);
  });

  it("sorts the overall category worst-first and keeps rule IDs traceable", () => {
    const bundle = buildAssessment({
      crew: crew(),
      observations: [observation("heartRate", 132, 1), observation("oxygenSaturation", 89, 1)],
      mission: null,
      now: NOW,
    });
    const ranks = { priority: 0, review: 1, more_data: 2, no_flags: 3 } as const;
    const order = bundle.domains.map((domain) => ranks[domain.category]);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
    const cardio = bundle.domains.find((domain) => domain.domain === "cardiovascular");
    expect(cardio?.ruleIds.length ?? 0).toBeGreaterThan(0);
    expect(cardio?.category === "priority" || cardio?.category === "review").toBe(true);
  });

  it("ignores observations recorded after the assessment clock", () => {
    const future = { ...observation("heartRate", 150, 0), observedAt: "2026-11-15T00:00:00.000Z" };
    const bundle = buildAssessment({ crew: crew(), observations: [future], mission: null, now: NOW });
    const cardio = bundle.domains.find((domain) => domain.domain === "cardiovascular");
    expect(cardio?.metrics.find((snapshot) => snapshot.metric === "heartRate")?.missing).toBe(true);
  });
});

describe("Deep Space Link state machine", () => {
  it("only allows the documented forward transitions", () => {
    expect(allowedTransitions("draft")).toEqual(["queued"]);
    expect(canTransition("queued", "sent")).toBe(true);
    expect(canTransition("draft", "sent")).toBe(false);
    expect(canTransition("reply_received", "queued")).toBe(false);
  });

  it("does not release a delivery before the one-way delay has elapsed", () => {
    const early = scheduledTransitions(
      "sent",
      { linkAvailable: true, oneWayDelayMinutes: 42, groundReviewMinutes: 90, sentAt: "2026-11-14T06:00:00.000Z" },
      "2026-11-14T06:30:00.000Z",
    );
    expect(early).toHaveLength(0);
    const due = scheduledTransitions(
      "sent",
      { linkAvailable: true, oneWayDelayMinutes: 42, groundReviewMinutes: 90, sentAt: "2026-11-14T06:00:00.000Z" },
      "2026-11-14T06:42:00.000Z",
    );
    expect(due[0]?.status).toBe("delivered");
  });

  it("keeps a queued handover queued while the link is unavailable", () => {
    const transitions = scheduledTransitions(
      "queued",
      { linkAvailable: false, oneWayDelayMinutes: 42, groundReviewMinutes: 90, queuedAt: "2026-11-14T05:00:00.000Z" },
      "2026-11-14T06:00:00.000Z",
    );
    expect(transitions).toHaveLength(0);
  });
});

describe("radiation and cabin record validation", () => {
  const base = {
    kind: "radiation" as const,
    startAt: "2026-11-10T00:00:00.000Z",
    quantity: "absorbed_dose" as const,
    value: 2.5,
    component: "unknown" as const,
    location: "Habitat module",
    instrument: "Passive dosimeter",
  };

  it("accepts a dose with its original unit and scope", () => {
    const parsed = radiationDataSchema.safeParse({ ...base, unit: "mGy", scope: "personal" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a dose equivalent recorded in Gy without conversion", () => {
    const parsed = radiationDataSchema.safeParse({
      ...base,
      quantity: "dose_equivalent",
      unit: "Gy",
      scope: "personal",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a record without scope or with a negative value", () => {
    expect(radiationDataSchema.safeParse({ ...base, unit: "mGy" }).success).toBe(false);
    expect(radiationDataSchema.safeParse({ ...base, unit: "mGy", scope: "area", value: -1 }).success).toBe(false);
  });
});

describe("importer validation", () => {
  it("treats blank cells as unknown and keeps an explicit zero", () => {
    const parsed = parseImportText({
      text: "crew_id,observed_at,exercise_minutes\ncrew-test,2026-11-13T06:00:00Z,0\ncrew-test,2026-11-13T07:00:00Z,\n",
      format: "csv",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const mapping = suggestMapping(parsed.table.columns);
    const result = validateImport({
      table: parsed.table,
      mapping,
      crew: [{ id: "crew-test", displayName: "Test Astronaut", callSign: "Test" }],
      existingKeys: [],
      sourceLabel: "Unit test fixture",
    });
    const exerciseRows = result.rows.filter((row) => row.observation.metric === "exerciseDuration");
    expect(exerciseRows[0]?.observation.numericValue).toBe(0);
    expect(exerciseRows.length).toBe(1);
  });

  it("neutralises spreadsheet formula injection on export", () => {
    expect(sanitiseCsvCell("=HYPERLINK(\"http://x\")")).not.toBe("=HYPERLINK(\"http://x\")");
    expect(sanitiseCsvCell("72")).toBe('"72"');
  });
});
