import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  DOMAINS,
  RULE_SET_VERSION,
  APP_TIMEZONE,
  type DomainKey,
} from "../../shared/constants";
import { buildCarePlan } from "../../shared/care";
import { publicProcedure, router } from "../_core/trpc";
import {
  buildBundle,
  buildCrewTable,
  syncAllCrewCases,
  syncCrewCases,
} from "../assessment";
import {
  applyMission,
  getAppliedMission,
  getCrew,
  getDraftMission,
  getState,
  listObservations,
  saveDraftMission,
} from "../db";
import { firstZodMessage, missionDraftSchema } from "../validation";

export const assessmentRouter = router({
  forCrew: publicProcedure
    .input(z.object({ crewId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        return await buildBundle(input.crewId);
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Crew not found.",
        });
      }
    }),

  domain: publicProcedure
    .input(z.object({ crewId: z.string().min(1), domain: z.string().min(1) }))
    .query(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      const domain = bundle.domains.find(
        (item) => item.domain === input.domain,
      );
      if (!domain)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Unknown screening domain.",
        });
      return { bundle, domain, care: buildCarePlan(domain) };
    }),

  care: publicProcedure
    .input(z.object({ crewId: z.string().min(1), domain: z.string().min(1) }))
    .query(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      const domain = bundle.domains.find(
        (item) => item.domain === input.domain,
      );
      if (!domain)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Unknown screening domain.",
        });
      return buildCarePlan(domain);
    }),

  series: publicProcedure
    .input(
      z.object({
        crewId: z.string().min(1),
        metric: z.string().min(1),
        days: z.number().int().min(1).max(365).nullable(),
      }),
    )
    .query(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      const streamId = bundle.stream?.id ?? null;
      const observations = await listObservations(input.crewId, streamId);
      const cutoff = input.days
        ? Date.now() - input.days * 24 * 60 * 60 * 1000
        : null;
      return observations
        .filter((item) => item.metric === input.metric)
        .filter((item) =>
          cutoff ? new Date(item.observedAt).getTime() >= cutoff : true,
        )
        .sort(
          (left, right) =>
            new Date(left.observedAt).getTime() -
            new Date(right.observedAt).getTime(),
        );
    }),

  crewTable: publicProcedure.query(() => buildCrewTable()),

  resyncCases: publicProcedure.mutation(async () => {
    const crew = await getCrew("crew-01");
    if (!crew)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Seed data is not present.",
      });
    const bundle = await buildBundle(crew.id);
    await syncCrewCases(crew.id, bundle);
    return { ok: true };
  }),
});

export const missionRouter = router({
  current: publicProcedure.query(async () => {
    const state = await getState();
    const applied = await getAppliedMission(state);
    const draft = await getDraftMission(state);
    return { applied, draft, state };
  }),

  saveDraft: publicProcedure
    .input(missionDraftSchema)
    .mutation(async ({ input }) => {
      const parsed = missionDraftSchema.safeParse(input);
      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: firstZodMessage(parsed.error),
        });
      }
      const state = await getState();
      const draft = await saveDraftMission(parsed.data, state.draftMissionId);
      await getState();
      return { draft };
    }),

  applyDraft: publicProcedure.mutation(async () => {
    const state = await getState();
    if (!state.draftMissionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Save a mission draft before applying it.",
      });
    }
    const applied = await applyMission(state.draftMissionId);
    await syncAllCrewCases();
    return {
      applied,
      ruleSetVersion: RULE_SET_VERSION,
      timezone: APP_TIMEZONE,
    };
  }),

  table: publicProcedure.query(() => buildCrewTable()),

  influences: publicProcedure.query(() => {
    const rows = Object.values(DOMAINS).map((domain) => ({
      domain: domain.key,
      label: domain.label,
      affectedBy: domain.metrics,
    }));
    return {
      durationDays:
        "Changes the bone and conditioning loading floor at 180 days or more.",
      workload: "A demanding workload raises the sleep review floor by 0.5 h.",
      evaRequired:
        "Adds a pre-EVA data requirement for resting heart rate and oxygen saturation.",
      descriptive: [
        "Destination is descriptive metadata only.",
        "Activity level (activities) is descriptive metadata only.",
        "Crew scope decides which profiles the table shows; it does not change thresholds.",
      ],
      domains: rows,
      ruleSetVersion: RULE_SET_VERSION,
    };
  }),
});

export const DOMAIN_KEYS_EXPORT = DOMAINS as Record<DomainKey, unknown>;
