import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DOMAINS, METRICS } from "../../shared/constants";
import { publicProcedure, router } from "../_core/trpc";
import { buildBundle, syncCrewCases } from "../assessment";
import {
  addCaseEvent,
  findOpenCase,
  getCrew,
  insertObservation,
  listCases,
  listObservations,
  listObservationsByStream,
} from "../db";
import type { MetricKey } from "../types";
import { firstZodMessage, observationInputSchema } from "../validation";

function domainsForMetric(metric: MetricKey) {
  return Object.values(DOMAINS).filter((domain) =>
    domain.metrics.includes(metric),
  );
}

export const observationRouter = router({
  list: publicProcedure
    .input(
      z.object({
        crewId: z.string().min(1),
        streamId: z.string().nullable().optional(),
      }),
    )
    .query(async ({ input }) => {
      if (input.streamId) {
        const all = await listObservationsByStream(input.streamId);
        return all.filter((item) => item.crewId === input.crewId);
      }
      return listObservations(input.crewId, null);
    }),

  create: publicProcedure
    .input(observationInputSchema)
    .mutation(async ({ input }) => {
      const parsed = observationInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: firstZodMessage(parsed.error),
        });
      }
      const crew = await getCrew(parsed.data.crewId);
      if (!crew)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crew profile not found.",
        });

      const definition = METRICS[parsed.data.metric];
      const bundleBefore = await buildBundle(parsed.data.crewId, {
        withCaseLinks: false,
      });
      const streamId = bundleBefore.stream?.id ?? null;

      const observation = await insertObservation({
        crewId: parsed.data.crewId,
        metric: parsed.data.metric,
        numericValue:
          definition.kind === "choice" ? null : parsed.data.numericValue,
        textValue: definition.kind === "choice" ? parsed.data.textValue : null,
        unit: definition.unit,
        context: parsed.data.context,
        observedAt: parsed.data.observedAt,
        sourceKind: "manual",
        sourceLabel: "Manual entry (recorded, not measured)",
        streamId,
        importBatchId: null,
        note: parsed.data.note,
        clientRequestId: parsed.data.clientRequestId ?? null,
      });

      const cases = await listCases({ crewId: parsed.data.crewId });
      for (const domain of domainsForMetric(parsed.data.metric)) {
        const openCase =
          cases.find(
            (item) =>
              item.domain === domain.key &&
              item.status !== "archived" &&
              item.streamId === streamId,
          ) ?? (await findOpenCase(parsed.data.crewId, domain.key, streamId));
        if (!openCase) continue;
        await addCaseEvent({
          caseId: openCase.id,
          kind: "observation_added",
          title: `New observation: ${definition.label}`,
          body: `${definition.label} recorded as ${
            observation.numericValue !== null
              ? `${observation.numericValue} ${definition.unit}`
              : observation.textValue
          } at ${observation.observedAt} (${observation.sourceLabel}).`,
          actor: "crew_mode",
          occurredAt: observation.createdAt,
          dedupeKey: `obs:${observation.id}`,
          data: {
            observationId: observation.id,
            metric: observation.metric,
            domain: domain.key,
          },
        });
      }

      const bundleAfter = await buildBundle(parsed.data.crewId, {
        withCaseLinks: false,
      });
      await syncCrewCases(parsed.data.crewId, bundleAfter);

      return {
        observation,
        previousCategory: bundleBefore.overallCategory,
        category: bundleAfter.overallCategory,
        nextStep: bundleAfter.nextStep,
      };
    }),
});
