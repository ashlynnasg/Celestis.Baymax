import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { APP_TIMEZONE, RULE_SET_VERSION, SEED_VERSION } from "../../shared/constants";
import { publicProcedure, router } from "../_core/trpc";
import { syncAllCrewCases } from "../assessment";
import {
  getAppliedMission,
  getDraftMission,
  getRun,
  getState,
  listCrew,
  setRunStatus,
  updateState,
} from "../db";
import { resetAndReseed } from "../seed";

export const stateRouter = router({
  get: publicProcedure.query(async () => {
    const state = await getState();
    const applied = await getAppliedMission(state);
    const draft = await getDraftMission(state);
    const crew = await listCrew(true);
    const stream = state.activeStreamId ? await getRun(state.activeStreamId) : null;
    return {
      state,
      applied,
      draft,
      crew: crew.map((member) => ({
        id: member.id,
        displayName: member.displayName,
        callSign: member.callSign,
        archived: member.archived,
      })),
      stream,
      meta: {
        ruleSetVersion: RULE_SET_VERSION,
        seedVersion: SEED_VERSION,
        timezone: APP_TIMEZONE,
      },
    };
  }),

  setStream: publicProcedure
    .input(z.object({ streamId: z.string().nullable(), crewId: z.string().nullable() }))
    .mutation(async ({ input }) => {
      if (!input.streamId) {
        await updateState({ activeStreamId: null, activeStreamCrewId: null });
        return { activeStreamId: null };
      }
      const run = await getRun(input.streamId);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Simulation run not found." });
      if (input.crewId && input.crewId !== run.crewId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This simulation run belongs to a different crew member; switch crew first.",
        });
      }
      await updateState({ activeStreamId: run.id, activeStreamCrewId: run.crewId });
      await setRunStatus(run.id, "active");
      return { activeStreamId: run.id, crewId: run.crewId };
    }),

  resetDemo: publicProcedure
    .input(z.object({ confirm: z.literal("RESET DEMO") }))
    .mutation(async () => {
      await resetAndReseed();
      await syncAllCrewCases();
      const state = await getState();
      return { ok: true, seedVersion: state.seedVersion, activeStreamId: state.activeStreamId };
    }),

  about: publicProcedure.query(() => ({
    name: "Celestial Baymax",
    tagline: "Predict. Prevent. Protect. Recover.",
    ruleSetVersion: RULE_SET_VERSION,
    seedVersion: SEED_VERSION,
    timezone: APP_TIMEZONE,
    statement:
      "A local demonstration of connected crew-health workflow for the NASA Space Apps 'Health Monitoring Software' brief. Taglines are branding only: the app does not predict disease, demonstrate clinical benefit or certify flight readiness.",
  })),
});
