import { z } from "zod";
import { ANSWER_STARTERS, SUPPORTED_QUESTIONS, answerQuestion } from "../../shared/assistant";
import { publicProcedure, router } from "../_core/trpc";
import { buildBundle, buildCrewTable } from "../assessment";

export const assistantRouter = router({
  ask: publicProcedure
    .input(z.object({ crewId: z.string().min(1), question: z.string().trim().min(1).max(500) }))
    .mutation(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      const crewTable = await buildCrewTable();
      return answerQuestion({ question: input.question, bundle, crewTable });
    }),

  context: publicProcedure.input(z.object({ crewId: z.string().min(1) })).query(async ({ input }) => {
    const bundle = await buildBundle(input.crewId);
    return {
      crew: bundle.crew,
      stream: bundle.stream,
      mission: bundle.mission,
      overallCategory: bundle.overallCategory,
      assessedAt: bundle.assessedAt,
      ruleSetVersion: bundle.ruleSetVersion,
      suggestions: [...ANSWER_STARTERS, ...SUPPORTED_QUESTIONS],
      supported: SUPPORTED_QUESTIONS,
      label:
        "Baymax Assistant — local explanations generated from predefined logic and your selected demonstration record.",
    };
  }),
});
