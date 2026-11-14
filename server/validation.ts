import { z } from "zod";
import { METRICS, METRIC_KEYS, SCENARIO_KEYS, type MetricKey } from "../shared/constants";

const yesNoUnknown = z.enum(["yes", "no", "unknown"]);
const stringList = z.array(z.string().trim().max(200)).max(40);

export const crewHistorySchema = z.object({
  previousConditions: stringList,
  injuriesSurgeries: stringList,
  medications: z
    .array(
      z.object({
        name: z.string().trim().max(120),
        dose: z.string().trim().max(60),
        schedule: z.string().trim().max(120),
      }),
    )
    .max(30),
  allergies: stringList,
  familyHistory: z
    .array(
      z.object({
        relationship: z.string().trim().max(60),
        condition: z.string().trim().max(120),
        status: yesNoUnknown,
      }),
    )
    .max(30),
  cardiovascular: z.object({
    conditions: stringList,
    knownHypertension: yesNoUnknown,
    notes: z.string().max(2000),
  }),
  boneMuscle: z.object({
    boneDensityConcern: yesNoUnknown,
    priorFracture: yesNoUnknown,
    muscleLossConcern: yesNoUnknown,
    notes: z.string().max(2000),
  }),
  sleepWellbeing: z.object({
    baselineSleepHours: z.number().min(0).max(16).nullable(),
    insomniaHistory: yesNoUnknown,
    anxietyHistory: yesNoUnknown,
    notes: z.string().max(2000),
  }),
  vision: z.object({
    correctiveLenses: yesNoUnknown,
    priorVisionChanges: yesNoUnknown,
    notes: z.string().max(2000),
  }),
  respiratory: z.object({
    asthma: yesNoUnknown,
    notes: z.string().max(2000),
  }),
  missionHistory: z.object({
    previousConcerns: stringList,
    evaHours: z.number().min(0).max(5000).nullable(),
    notes: z.string().max(2000),
  }),
});

export const crewWriteSchema = z.object({
  displayName: z.string().trim().min(2, "Enter a name of at least 2 characters.").max(80),
  callSign: z.string().trim().min(1, "Enter a call sign.").max(40),
  role: z.string().trim().min(1, "Enter a role.").max(60),
  age: z.number().int().min(18, "Age must be between 18 and 80.").max(80, "Age must be between 18 and 80."),
  sexAtBirth: z.string().trim().min(1).max(24),
  heightCm: z.number().int().min(120, "Height must be between 120 and 220 cm.").max(220, "Height must be between 120 and 220 cm."),
  weightKg: z.number().int().min(35, "Weight must be between 35 and 200 kg.").max(200, "Weight must be between 35 and 200 kg."),
  bloodType: z.string().trim().min(1).max(8),
  missions: z.array(z.string().trim().max(120)).max(20),
  history: crewHistorySchema,
});

export type CrewWriteRequest = z.infer<typeof crewWriteSchema>;

const timestampSchema = z
  .string()
  .min(1, "Choose an observation date and time.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time.")
  .refine((value) => Date.parse(value) <= Date.now() + 5 * 60 * 1000, "The observation time cannot be in the future.")
  .refine((value) => Date.parse(value) >= Date.now() - 1000 * 60 * 60 * 24 * 365 * 5, "The observation time is too far in the past.");

export const observationInputSchema = z
  .object({
    crewId: z.string().min(1),
    metric: z.enum(METRIC_KEYS as [MetricKey, ...MetricKey[]]),
    numericValue: z.number().nullable(),
    textValue: z.string().max(64).nullable(),
    context: z.enum(["rest", "after_exercise", "unknown"]).nullable(),
    observedAt: timestampSchema,
    note: z.string().max(2000).nullable(),
    clientRequestId: z.string().max(64).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const definition = METRICS[value.metric];
    if (definition.kind === "choice") {
      if (!value.textValue) {
        ctx.addIssue({
          code: "custom",
          path: ["textValue"],
          message: "Choose the reported vision status.",
        });
        return;
      }
      const allowed = definition.choices?.map((choice) => choice.value) ?? [];
      if (!allowed.includes(value.textValue)) {
        ctx.addIssue({ code: "custom", path: ["textValue"], message: "Choose a supported vision option." });
      }
      return;
    }
    if (value.numericValue === null || Number.isNaN(value.numericValue)) {
      ctx.addIssue({ code: "custom", path: ["numericValue"], message: `Enter a ${definition.label.toLowerCase()} value.` });
      return;
    }
    if (definition.min !== null && value.numericValue < definition.min) {
      ctx.addIssue({
        code: "custom",
        path: ["numericValue"],
        message: `${definition.label} must be at least ${definition.min} ${definition.unit}.`,
      });
    }
    if (definition.max !== null && value.numericValue > definition.max) {
      ctx.addIssue({
        code: "custom",
        path: ["numericValue"],
        message: `${definition.label} must be at most ${definition.max} ${definition.unit}.`,
      });
    }
    if (definition.contexts && !value.context) {
      ctx.addIssue({ code: "custom", path: ["context"], message: "Choose the measurement context." });
    }
  });

export const missionDraftSchema = z.object({
  destination: z.string().trim().min(2, "Describe the destination.").max(80),
  durationDays: z.number().int().min(1, "Duration must be at least 1 day.").max(1000, "Duration must be at most 1000 days."),
  activityLevel: z.enum(["low", "moderate", "high"]),
  workload: z.enum(["light", "standard", "demanding"]),
  evaRequired: z.boolean(),
  crewScope: z.enum(["all_crew", "selected_crew"]),
});

export const guidedCheckSubmitSchema = z.object({
  checkId: z.string().min(1),
  numericValue: z.number().nullable(),
  textValue: z.string().max(64).nullable(),
  context: z.enum(["rest", "after_exercise", "unknown"]).nullable(),
  note: z.string().max(2000).nullable(),
  observedAt: timestampSchema,
  clientRequestId: z.string().max(64),
});

export const unableSchema = z.object({
  checkId: z.string().min(1),
  reason: z.string().trim().max(600).optional(),
});

export const simulationRunSchema = z.object({
  crewId: z.string().min(1),
  scenario: z.enum(SCENARIO_KEYS as [string, ...string[]]),
  seed: z.number().int().optional(),
  anchorToNow: z.boolean().optional(),
});

export const importPreviewSchema = z.object({
  sourceTitle: z.string().trim().min(2, "Give the source a title.").max(160),
  sourceRef: z.string().trim().max(240).optional(),
  text: z.string().min(1, "Paste CSV or JSON content."),
  format: z.enum(["csv", "json"]),
  recordPath: z.string().trim().max(200).optional().nullable(),
  mapping: z
    .array(
      z.object({
        column: z.string(),
        field: z.string(),
        unit: z.string().nullable(),
        confidence: z.enum(["suggested", "manual", "unmapped"]),
        reason: z.string(),
      }),
    )
    .optional(),
});

export const handoverCreateSchema = z.object({
  crewId: z.string().min(1),
  caseId: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  recordedActions: z.string().max(2000).optional(),
  followUpQuestions: z.string().max(2000).optional(),
});

export const replySchema = z.object({
  handoverId: z.string().min(1),
  body: z.string().trim().min(4, "Write the fictional ground reply.").max(4000),
  author: z.string().trim().max(120).optional(),
});

export const clockAdvanceSchema = z.object({
  minutes: z.number().int().min(1).max(60 * 24 * 30),
});

export const linkConfigSchema = z.object({
  oneWayDelayMinutes: z.number().int().min(1, "The one-way delay must be at least 1 minute.").max(1440, "Keep the demonstration delay under 24 hours."),
  groundReviewMinutes: z.number().int().min(1, "Ground review needs at least 1 minute.").max(1440),
  linkAvailable: z.boolean(),
});

export function firstZodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "The submitted data is not valid.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
