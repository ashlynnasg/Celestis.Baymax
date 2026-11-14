import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { buildBundle, listCrewItems, syncCrewCases } from "../assessment";
import { createCrew, getCrew, listCrew, setCrewArchived, updateCrew } from "../db";
import { crewWriteSchema, firstZodMessage } from "../validation";
import { z } from "zod";

export const crewRouter = router({
  list: publicProcedure
    .input(z.object({ includeArchived: z.boolean().optional() }).optional())
    .query(async ({ input }) => listCrew(input?.includeArchived ?? true)),

  items: publicProcedure.query(() => listCrewItems()),

  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const crew = await getCrew(input.id);
    if (!crew) throw new TRPCError({ code: "NOT_FOUND", message: "Crew profile not found." });
    return crew;
  }),

  bundle: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    try {
      return await buildBundle(input.id);
    } catch (error) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: error instanceof Error ? error.message : "Crew profile not found.",
      });
    }
  }),

  create: publicProcedure.input(crewWriteSchema).mutation(async ({ input }) => {
    const parsed = crewWriteSchema.safeParse(input);
    if (!parsed.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: firstZodMessage(parsed.error) });
    }
    const created = await createCrew(parsed.data);
    const bundle = await buildBundle(created.id, { withCaseLinks: false });
    await syncCrewCases(created.id, bundle);
    return created;
  }),

  update: publicProcedure
    .input(crewWriteSchema.extend({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const parsed = crewWriteSchema.safeParse(input);
      if (!parsed.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: firstZodMessage(parsed.error) });
      }
      const existing = await getCrew(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Crew profile not found." });
      const updated = await updateCrew(input.id, parsed.data);
      const bundle = await buildBundle(updated.id, { withCaseLinks: false });
      await syncCrewCases(updated.id, bundle);
      return updated;
    }),

  archive: publicProcedure
    .input(z.object({ id: z.string().min(1), archived: z.boolean(), reason: z.string().max(400).optional() }))
    .mutation(async ({ input }) => {
      const existing = await getCrew(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Crew profile not found." });
      await setCrewArchived(input.id, input.archived);
      return { id: input.id, archived: input.archived, reason: input.reason ?? null };
    }),
});
