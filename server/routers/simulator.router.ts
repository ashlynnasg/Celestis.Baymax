import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  RULE_SET_VERSION,
  SCENARIOS,
  type ScenarioKey,
} from "../../shared/constants";
import {
  describeCategoryChanges,
  generateScenario,
  previewScenario,
} from "../../shared/simulator";
import { publicProcedure, router } from "../_core/trpc";
import { buildBundle } from "../assessment";
import {
  createRun,
  getCrew,
  getRun,
  getState,
  insertObservation,
  listObservations,
  listObservationsByStream,
  listRuns,
  setRunStatus,
  updateRun,
  updateState,
} from "../db";

const scenarioEnum = z.enum(
  Object.keys(SCENARIOS) as [ScenarioKey, ...ScenarioKey[]],
);

export const simulatorRouter = router({
  preview: publicProcedure
    .input(z.object({ crewId: z.string().min(1), scenario: scenarioEnum }))
    .query(async ({ input }) => {
      const crew = await getCrew(input.crewId);
      if (!crew)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crew member not found.",
        });
      const baseline = await listObservations(input.crewId, null);
      return {
        scenario: input.scenario,
        label: SCENARIOS[input.scenario].label,
        blurb: SCENARIOS[input.scenario].blurb,
        rows: previewScenario({
          crew,
          baselineObservations: baseline,
          scenario: input.scenario,
        }),
        assumptions: [
          "Seven daily simulated observations per metric, derived from the recorded baseline medians.",
          "Values are generated deterministically from a seed, so the same run reproduces the same numbers.",
          "Baseline observations are never modified; the run is stored in its own stream.",
          "No scenario is a predicted clinical outcome.",
        ],
      };
    }),

  run: publicProcedure
    .input(
      z.object({
        crewId: z.string().min(1),
        scenario: scenarioEnum,
        seed: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const crew = await getCrew(input.crewId);
      if (!crew)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crew member not found.",
        });
      const baseline = await listObservations(input.crewId, null);
      const seed = input.seed ?? Math.floor(Date.now() / 1000) % 100000;
      const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      startDate.setUTCHours(7, 30, 0, 0);
      if (startDate.getTime() + 6 * 24 * 60 * 60_000 > Date.now())
        startDate.setTime(Date.now() - 6 * 24 * 60 * 60_000 - 5 * 60_000);

      const run = await createRun({
        crewId: input.crewId,
        scenario: input.scenario,
        label: `${SCENARIOS[input.scenario].label} · ${crew.callSign}`,
        seed,
        startDate: startDate.toISOString(),
        dayCount: 7,
        assumptions: [],
        preview: [],
        ruleSetVersion: RULE_SET_VERSION,
      });

      const generated = generateScenario({
        runId: run.id,
        crew,
        baselineObservations: baseline,
        scenario: input.scenario,
        seed,
        startDate,
        streamLabel: `${SCENARIOS[input.scenario].label} run ${run.id}`,
      });

      for (const day of generated.days) {
        for (const observation of day.observations) {
          await insertObservation({
            ...observation,
            streamId: run.id,
            importBatchId: null,
            clientRequestId: null,
          });
        }
      }

      await createRun({
        crewId: input.crewId,
        scenario: input.scenario,
        label: run.label,
        seed,
        startDate: generated.startDate,
        dayCount: 7,
        assumptions: generated.assumptions,
        preview: generated.preview,
        ruleSetVersion: RULE_SET_VERSION,
      });

      const refreshed = await getRun(run.id);
      return refreshed ?? run;
    }),

  list: publicProcedure
    .input(z.object({ crewId: z.string().optional() }).optional())
    .query(async ({ input }) => listRuns(input?.crewId)),

  get: publicProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      const run = await getRun(input.runId);
      if (!run)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Simulation run not found.",
        });
      const observations = await listObservationsByStream(input.runId);
      const state = await getState();
      return { run, observations, active: state.activeStreamId === run.id };
    }),

  compare: publicProcedure
    .input(
      z.object({
        runId: z.string().min(1),
        day: z.number().int().min(1).max(7),
      }),
    )
    .query(async ({ input }) => {
      const run = await getRun(input.runId);
      if (!run)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Simulation run not found.",
        });
      const crew = await getCrew(run.crewId);
      if (!crew)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crew member not found.",
        });

      const state = await getState();
      const streamObservations = await listObservationsByStream(run.id);
      const distinctDays = Array.from(
        new Set(streamObservations.map((item) => item.observedAt.slice(0, 10))),
      ).sort();
      const selectedDay =
        distinctDays[Math.min(input.day, distinctDays.length) - 1] ??
        run.startDate;
      const allowed = new Set(distinctDays.slice(0, input.day));
      const replayObservations = streamObservations.filter((item) =>
        allowed.has(item.observedAt.slice(0, 10)),
      );

      const baselineBundle = await buildBundle(run.crewId, {
        streamId: null,
        withCaseLinks: false,
      });
      const replayBundle = await buildBundle(run.crewId, {
        streamId: run.id,
        observations: replayObservations,
        now: new Date(`${selectedDay}T23:59:59.000Z`),
        withCaseLinks: false,
      });

      const baselineObservations = await listObservations(run.crewId, null);

      return {
        run,
        day: input.day,
        dayDate: selectedDay,
        dayCount: distinctDays.length,
        baselineBundle,
        replayBundle,
        categoryChanges: describeCategoryChanges(
          baselineBundle.domains,
          replayBundle.domains,
        ),
        baselineObservations,
        scenarioObservations: replayObservations,
        readOnly: true,
        activeStreamId: state.activeStreamId,
        note:
          state.activeStreamId === run.id
            ? "This run is currently applied, so the rest of the app reads this stream. Replay itself stays read-only and does not change any stored record."
            : "Replay is read-only: it does not modify live observations, case state, the current assessment or the applied stream.",
      };
    }),

  activate: publicProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const run = await getRun(input.runId);
      if (!run)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Simulation run not found.",
        });
      await setRunStatus(run.id, "active");
      await updateState({
        activeStreamId: run.id,
        activeStreamCrewId: run.crewId,
      });
      return { activeStreamId: run.id, crewId: run.crewId, label: run.label };
    }),

  deactivate: publicProcedure.mutation(async () => {
    await updateState({ activeStreamId: null, activeStreamCrewId: null });
    return { activeStreamId: null };
  }),
});
