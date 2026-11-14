/**
 * Fictional demonstration seed.
 *
 * Six crew members, seeded simulated observations and one applied mission. Seeding is idempotent:
 * it runs only when the stored seed version differs, and it never overwrites user edits afterwards.
 * The demo reset is explicit and never automatic.
 */
import { SEED_VERSION } from "../shared/constants";
import type { CrewHistory, HeartRateContext, MetricKey } from "./types";
import {
  createCrew,
  emptyHistory,
  getState,
  insertObservation,
  listCrew,
  resetDemoData,
  saveDraftMission,
  applyMission,
  updateState,
} from "./db";

const SEED_LABEL = "Seeded demonstration data (fictional)";

function history(overrides: Partial<CrewHistory> = {}): CrewHistory {
  const base = emptyHistory();
  return {
    ...base,
    ...overrides,
    cardiovascular: {
      ...base.cardiovascular,
      ...(overrides.cardiovascular ?? {}),
    },
    boneMuscle: { ...base.boneMuscle, ...(overrides.boneMuscle ?? {}) },
    sleepWellbeing: {
      ...base.sleepWellbeing,
      ...(overrides.sleepWellbeing ?? {}),
    },
    vision: { ...base.vision, ...(overrides.vision ?? {}) },
    respiratory: { ...base.respiratory, ...(overrides.respiratory ?? {}) },
    missionHistory: {
      ...base.missionHistory,
      ...(overrides.missionHistory ?? {}),
    },
  };
}

type SeedObservation = {
  metric: MetricKey;
  numeric?: number;
  text?: string;
  daysAgo: number;
  hour?: number;
  context?: HeartRateContext;
  note?: string;
};

function hoursAgo(daysAgo: number, hour = 7): string {
  const date = new Date();
  date.setUTCHours(hour, 30, 0, 0);
  // Demo records are generated in the past even when setup runs before the chosen UTC hour.
  if (date.getTime() > Date.now()) date.setTime(Date.now() - 5 * 60_000);
  date.setTime(date.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

async function seedObservations(
  crewId: string,
  rows: SeedObservation[],
): Promise<void> {
  for (const row of rows) {
    await insertObservation({
      crewId,
      metric: row.metric,
      numericValue: row.numeric ?? null,
      textValue: row.text ?? null,
      unit: "",
      context: row.context ?? null,
      observedAt: hoursAgo(row.daysAgo, row.hour ?? 7),
      sourceKind: "seed",
      sourceLabel: SEED_LABEL,
      streamId: null,
      importBatchId: null,
      note: row.note ?? null,
    });
  }
}

async function seedCrewOne(): Promise<void> {
  await createCrew(
    {
      displayName: "Maya Chen",
      callSign: "Aster",
      role: "Mission commander",
      age: 41,
      sexAtBirth: "Female",
      heightCm: 168,
      weightKg: 62,
      bloodType: "O+",
      missions: ["Lunar Gateway · 190 d (applied)", "ISS Expedition 71"],
      history: history({
        previousConditions: ["Mild seasonal allergy"],
        allergies: ["Pollen (mild)"],
        familyHistory: [
          {
            relationship: "Mother",
            condition: "Type 2 diabetes",
            status: "yes",
          },
        ],
        cardiovascular: {
          conditions: [],
          knownHypertension: "no",
          notes: "Annual ECG normal in the demo record.",
        },
        boneMuscle: {
          boneDensityConcern: "no",
          priorFracture: "no",
          muscleLossConcern: "no",
          notes: "Regular resistive training.",
        },
        sleepWellbeing: {
          baselineSleepHours: 7.4,
          insomniaHistory: "no",
          anxietyHistory: "no",
          notes: "Stable sleep on orbit.",
        },
        vision: {
          correctiveLenses: "yes",
          priorVisionChanges: "no",
          notes: "Corrective lenses since age 16; no flight-related change.",
        },
        respiratory: { asthma: "no", notes: "" },
        missionHistory: {
          previousConcerns: [],
          evaHours: 26,
          notes: "Three EVAs, no medical events.",
        },
      }),
    },
    "crew-01",
  );

  const findings: SeedObservation[] = [];
  for (let day = 0; day < 21; day += 1) {
    findings.push({
      metric: "sleepDuration",
      numeric: 7.4 + (day % 3 === 0 ? -0.4 : day % 4 === 0 ? 0.5 : 0.1),
      daysAgo: day,
      hour: 6,
    });
  }
  [7.2, 7.3, 7.1, 7.4, 7.2, 7.3, 7.1].forEach((value, index) => {
    findings.push({
      metric: "heartRate",
      numeric: Math.round(value * 10 + 8),
      daysAgo: index,
      context: "rest",
      hour: 7,
    });
    findings.push({
      metric: "oxygenSaturation",
      numeric: 97 + (index % 2),
      daysAgo: index,
      context: "rest",
      hour: 7,
    });
  });
  [0, 2, 4, 6].forEach((day, index) => {
    findings.push({
      metric: "stress",
      numeric: [3, 4, 3, 2][index],
      daysAgo: day,
      hour: 8,
    });
    findings.push({
      metric: "fatigue",
      numeric: [3, 4, 3, 2][index],
      daysAgo: day,
      hour: 8,
    });
    findings.push({
      metric: "exerciseDuration",
      numeric: [45, 40, 50, 35][index],
      daysAgo: day,
      hour: 18,
    });
  });
  findings.push({
    metric: "systolicBloodPressure",
    numeric: 118,
    daysAgo: 2,
    context: "rest",
    hour: 7,
  });
  findings.push({
    metric: "diastolicBloodPressure",
    numeric: 74,
    daysAgo: 2,
    context: "rest",
    hour: 7,
  });
  findings.push({ metric: "visionChange", text: "no_change", daysAgo: 3 });

  await seedObservations("crew-01", findings);
}

async function seedCrewTwo(): Promise<void> {
  await createCrew(
    {
      displayName: "Diego Ramos",
      callSign: "Tomo",
      role: "Flight engineer",
      age: 36,
      sexAtBirth: "Male",
      heightCm: 179,
      weightKg: 78,
      bloodType: "A-",
      missions: ["Lunar Gateway · 190 d (applied)"],
      history: history({
        previousConditions: ["Childhood asthma (resolved)"],
        injuriesSurgeries: ["Right wrist fracture (2019, healed)"],
        medications: [
          {
            name: "Melatonin (crew sleep protocol)",
            dose: "3 mg",
            schedule: "As needed before sleep",
          },
        ],
        familyHistory: [
          { relationship: "Father", condition: "Hypertension", status: "yes" },
        ],
        cardiovascular: { conditions: [], knownHypertension: "no", notes: "" },
        boneMuscle: {
          boneDensityConcern: "unknown",
          priorFracture: "yes",
          muscleLossConcern: "no",
          notes: "Wrist fracture healed without complication.",
        },
        sleepWellbeing: {
          baselineSleepHours: 6.2,
          insomniaHistory: "yes",
          anxietyHistory: "no",
          notes: "Reports difficulty falling asleep after late shifts.",
        },
        vision: {
          correctiveLenses: "no",
          priorVisionChanges: "unknown",
          notes: "",
        },
        respiratory: {
          asthma: "no",
          notes: "Childhood asthma, no symptoms in the demo record.",
        },
        missionHistory: {
          previousConcerns: ["Sleep debt during handover week"],
          evaHours: 12,
          notes: "",
        },
      }),
    },
    "crew-02",
  );

  const findings: SeedObservation[] = [];
  for (let day = 0; day < 18; day += 1) {
    findings.push({
      metric: "sleepDuration",
      numeric: Math.max(4.4, 6.1 - day * 0.05 - (day % 3) * 0.25),
      daysAgo: day,
      hour: 6,
    });
  }
  [5, 6, 7, 7, 8, 7, 6].forEach((value, index) => {
    findings.push({
      metric: "fatigue",
      numeric: value,
      daysAgo: index,
      hour: 8,
    });
    findings.push({
      metric: "stress",
      numeric: index < 3 ? 6 : 5,
      daysAgo: index,
      hour: 8,
    });
  });
  [0, 2, 4, 6].forEach((day, index) => {
    findings.push({
      metric: "heartRate",
      numeric: [78, 82, 84, 80][index],
      daysAgo: day,
      context: "rest",
      hour: 7,
    });
    findings.push({
      metric: "oxygenSaturation",
      numeric: [97, 96, 97, 97][index],
      daysAgo: day,
      context: "rest",
      hour: 7,
    });
  });
  [1, 3, 5].forEach((day) => {
    findings.push({
      metric: "exerciseDuration",
      numeric: [20, 25, 15][day % 3],
      daysAgo: day,
      hour: 18,
    });
  });
  findings.push({ metric: "visionChange", text: "no_change", daysAgo: 5 });
  findings.push({
    metric: "systolicBloodPressure",
    numeric: 128,
    daysAgo: 3,
    context: "rest",
    hour: 7,
  });

  await seedObservations("crew-02", findings);
}

async function seedCrewThree(): Promise<void> {
  await createCrew(
    {
      displayName: "Priya Nair",
      callSign: "Lyra",
      role: "Systems engineer",
      age: 44,
      sexAtBirth: "Female",
      heightCm: 162,
      weightKg: 59,
      bloodType: "B+",
      missions: ["Lunar Gateway · 190 d (applied)"],
      history: history({
        previousConditions: ["Hypertension, managed", "Migraine without aura"],
        medications: [
          {
            name: "Amlodipine (per crew medical plan)",
            dose: "5 mg",
            schedule: "Daily, 08:00",
          },
          {
            name: "Sumatriptan (per crew medical plan)",
            dose: "As prescribed",
            schedule: "Migraine only",
          },
        ],
        familyHistory: [
          {
            relationship: "Father",
            condition: "Myocardial infarction at 58",
            status: "yes",
          },
          { relationship: "Sister", condition: "Hypertension", status: "yes" },
        ],
        cardiovascular: {
          conditions: [
            "Documented hypertension",
            "Family history of premature coronary disease",
          ],
          knownHypertension: "yes",
          notes:
            "Managed before flight; monitoring requested during demanding operations.",
        },
        boneMuscle: {
          boneDensityConcern: "unknown",
          priorFracture: "no",
          muscleLossConcern: "no",
          notes: "",
        },
        sleepWellbeing: {
          baselineSleepHours: 6.9,
          insomniaHistory: "no",
          anxietyHistory: "unknown",
          notes: "",
        },
        vision: {
          correctiveLenses: "yes",
          priorVisionChanges: "no",
          notes: "",
        },
        respiratory: { asthma: "no", notes: "" },
        missionHistory: {
          previousConcerns: [],
          evaHours: 8,
          notes: "Prefers morning exercise.",
        },
      }),
    },
    "crew-03",
  );

  const findings: SeedObservation[] = [];
  [108, 114, 118, 121, 119, 123].forEach((value, index) => {
    findings.push({
      metric: "heartRate",
      numeric: value,
      daysAgo: index,
      context: "rest",
      hour: 7,
      note: "Resting, before exercise.",
    });
  });
  [94, 93, 93, 92].forEach((value, index) => {
    findings.push({
      metric: "oxygenSaturation",
      numeric: value,
      daysAgo: index,
      context: "rest",
      hour: 7,
    });
  });
  [152, 156, 158].forEach((value, index) => {
    findings.push({
      metric: "systolicBloodPressure",
      numeric: value,
      daysAgo: index * 2,
      context: "rest",
      hour: 7,
    });
    findings.push({
      metric: "diastolicBloodPressure",
      numeric: 94 + index,
      daysAgo: index * 2,
      context: "rest",
      hour: 7,
    });
  });
  [6.8, 6.9, 6.7, 6.9, 6.8].forEach((value, index) => {
    findings.push({
      metric: "sleepDuration",
      numeric: value,
      daysAgo: index,
      hour: 6,
    });
  });
  [6, 6, 7].forEach((value, index) => {
    findings.push({
      metric: "fatigue",
      numeric: value,
      daysAgo: index,
      hour: 8,
    });
  });
  [15, 10, 12].forEach((value, index) => {
    findings.push({
      metric: "exerciseDuration",
      numeric: value,
      daysAgo: index * 2,
      hour: 18,
    });
  });
  findings.push({ metric: "visionChange", text: "no_change", daysAgo: 6 });
  findings.push({ metric: "stress", numeric: 5, daysAgo: 1, hour: 8 });

  await seedObservations("crew-03", findings);
}

async function seedCrewFour(): Promise<void> {
  await createCrew(
    {
      displayName: "Kenji Watanabe",
      callSign: "Kite",
      role: "Research specialist",
      age: 39,
      sexAtBirth: "Male",
      heightCm: 174,
      weightKg: 70,
      bloodType: "AB+",
      missions: ["Lunar Gateway · 190 d (applied)"],
      history: history({
        previousConditions: ["Myopia"],
        medications: [{ name: "None recorded", dose: "—", schedule: "—" }],
        familyHistory: [
          { relationship: "Mother", condition: "Glaucoma", status: "yes" },
          { relationship: "Father", condition: "Unknown", status: "unknown" },
        ],
        cardiovascular: {
          conditions: [],
          knownHypertension: "unknown",
          notes: "No recent measurement before this mission.",
        },
        boneMuscle: {
          boneDensityConcern: "no",
          priorFracture: "no",
          muscleLossConcern: "no",
          notes: "",
        },
        sleepWellbeing: {
          baselineSleepHours: 7,
          insomniaHistory: "no",
          anxietyHistory: "no",
          notes: "",
        },
        vision: {
          correctiveLenses: "yes",
          priorVisionChanges: "yes",
          notes:
            "Reported transient blurring during a previous mission; resolved.",
        },
        respiratory: { asthma: "no", notes: "" },
        missionHistory: {
          previousConcerns: ["Transient visual blurring"],
          evaHours: 4,
          notes: "",
        },
      }),
    },
    "crew-04",
  );

  const findings: SeedObservation[] = [];
  [0, 3, 7].forEach((day) => {
    findings.push({
      metric: "visionChange",
      text: "changes_reported",
      daysAgo: day,
      note: "Reports intermittent blurred vision at distance.",
    });
  });
  [76, 78, 77, 79].forEach((value, index) => {
    findings.push({
      metric: "heartRate",
      numeric: value,
      daysAgo: index,
      context: "rest",
      hour: 7,
    });
    findings.push({
      metric: "oxygenSaturation",
      numeric: 97,
      daysAgo: index,
      context: "rest",
      hour: 7,
    });
  });
  [6.9, 7, 6.8, 7.1].forEach((value, index) => {
    findings.push({
      metric: "sleepDuration",
      numeric: value,
      daysAgo: index,
      hour: 6,
    });
  });
  [4, 5, 5].forEach((value, index) => {
    findings.push({
      metric: "stress",
      numeric: value,
      daysAgo: index,
      hour: 8,
    });
    findings.push({
      metric: "fatigue",
      numeric: value,
      daysAgo: index,
      hour: 8,
    });
  });
  [30, 25, 35].forEach((value, index) => {
    findings.push({
      metric: "exerciseDuration",
      numeric: value,
      daysAgo: index * 2,
      hour: 18,
    });
  });

  await seedObservations("crew-04", findings);
}

async function seedCrewFive(): Promise<void> {
  await createCrew(
    {
      displayName: "Amara Okafor",
      callSign: "Vela",
      role: "Pilot",
      age: 33,
      sexAtBirth: "Female",
      heightCm: 171,
      weightKg: 64,
      bloodType: "O-",
      missions: ["Lunar Gateway · 190 d (applied)"],
      history: history({
        previousConditions: ["Iron-deficiency anaemia (2018, resolved)"],
        allergies: ["Penicillin"],
        familyHistory: [
          {
            relationship: "Grandmother",
            condition: "Osteoporosis",
            status: "yes",
          },
        ],
        cardiovascular: { conditions: [], knownHypertension: "no", notes: "" },
        boneMuscle: {
          boneDensityConcern: "yes",
          priorFracture: "no",
          muscleLossConcern: "no",
          notes: "Family history of osteoporosis; monitoring requested.",
        },
        sleepWellbeing: {
          baselineSleepHours: 7.2,
          insomniaHistory: "no",
          anxietyHistory: "no",
          notes: "",
        },
        vision: { correctiveLenses: "no", priorVisionChanges: "no", notes: "" },
        respiratory: {
          asthma: "unknown",
          notes: "Childhood wheeze reported but not confirmed.",
        },
        missionHistory: {
          previousConcerns: [],
          evaHours: 18,
          notes: "Schedule heavy with piloting duties.",
        },
      }),
    },
    "crew-05",
  );

  const findings: SeedObservation[] = [];
  [8, 6, 5, 9, 7, 4, 6].forEach((value, index) => {
    findings.push({
      metric: "exerciseDuration",
      numeric: value,
      daysAgo: index,
      hour: 18,
      note: "Short session, piloted simulators most of the day.",
    });
  });
  [7.1, 7.2, 7, 7.3, 7.1].forEach((value, index) => {
    findings.push({
      metric: "sleepDuration",
      numeric: value,
      daysAgo: index,
      hour: 6,
    });
  });
  [4, 5, 5, 6].forEach((value, index) => {
    findings.push({
      metric: "fatigue",
      numeric: value,
      daysAgo: index,
      hour: 8,
    });
  });
  [72, 74, 73].forEach((value, index) => {
    findings.push({
      metric: "heartRate",
      numeric: value,
      daysAgo: index,
      context: "rest",
      hour: 7,
    });
    findings.push({
      metric: "oxygenSaturation",
      numeric: 97,
      daysAgo: index,
      context: "rest",
      hour: 7,
    });
  });
  findings.push({ metric: "visionChange", text: "no_change", daysAgo: 4 });
  findings.push({ metric: "stress", numeric: 4, daysAgo: 2, hour: 8 });

  await seedObservations("crew-05", findings);
}

async function seedCrewSix(): Promise<void> {
  await createCrew(
    {
      displayName: "Lars Bergström",
      callSign: "Nord",
      role: "Medical officer",
      age: 47,
      sexAtBirth: "Male",
      heightCm: 183,
      weightKg: 81,
      bloodType: "A+",
      missions: ["Lunar Gateway · 190 d (applied)"],
      history: history({
        previousConditions: ["Chronic low back pain"],
        injuriesSurgeries: ["Lumbar discectomy (2015)"],
        familyHistory: [
          { relationship: "Brother", condition: "Unknown", status: "unknown" },
        ],
        cardiovascular: {
          conditions: [],
          knownHypertension: "unknown",
          notes: "No blood pressure entry recorded this mission.",
        },
        boneMuscle: {
          boneDensityConcern: "unknown",
          priorFracture: "unknown",
          muscleLossConcern: "unknown",
          notes: "History incomplete at handover.",
        },
        sleepWellbeing: {
          baselineSleepHours: null,
          insomniaHistory: "unknown",
          anxietyHistory: "unknown",
          notes: "Baseline sleep never recorded.",
        },
        vision: {
          correctiveLenses: "unknown",
          priorVisionChanges: "unknown",
          notes: "",
        },
        respiratory: { asthma: "unknown", notes: "" },
        missionHistory: {
          previousConcerns: [],
          evaHours: 22,
          notes: "Record transfer from previous crew incomplete.",
        },
      }),
    },
    "crew-06",
  );

  await seedObservations("crew-06", [
    {
      metric: "heartRate",
      numeric: 74,
      daysAgo: 9,
      context: "unknown",
      note: "Single entry before the record transfer.",
    },
    {
      metric: "oxygenSaturation",
      numeric: 96,
      daysAgo: 12,
      context: "unknown",
    },
  ]);
}

export async function ensureSeeded(): Promise<{
  seeded: boolean;
  caution?: string;
}> {
  const state = await getState();
  if (state.seedVersion === SEED_VERSION) return { seeded: false };

  const existing = await listCrew(true);
  const existingIds = new Set(existing.map((member) => member.id));
  console.log("[seed] creating fictional crew profiles");

  if (!existingIds.has("crew-01")) await seedCrewOne();
  if (!existingIds.has("crew-02")) await seedCrewTwo();
  if (!existingIds.has("crew-03")) await seedCrewThree();
  if (!existingIds.has("crew-04")) await seedCrewFour();
  if (!existingIds.has("crew-05")) await seedCrewFive();
  if (!existingIds.has("crew-06")) await seedCrewSix();
  console.log("[seed] crew profiles created");

  const mission = await saveDraftMission(
    {
      destination: "Lunar Gateway",
      durationDays: 190,
      activityLevel: "moderate",
      workload: "demanding",
      evaRequired: true,
      crewScope: "all_crew",
    },
    null,
  );
  await applyMission(mission.id);
  await updateState({
    appliedMissionId: mission.id,
    draftMissionId: mission.id,
    seedVersion: SEED_VERSION,
  });

  return { seeded: true };
}

export async function resetAndReseed(): Promise<void> {
  await resetDemoData();
  await ensureSeeded();
}
