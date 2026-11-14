import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { METRICS, type DomainKey } from "../../shared/constants";
import { publicProcedure, router } from "../_core/trpc";
import { buildBundle, resolveCheck, syncCrewCases } from "../assessment";
import {
  addCaseEvent,
  createCheck,
  findOpenCase,
  getCaseRow,
  getCheck,
  getCrew,
  insertObservation,
  listCaseEvents,
  listCases,
  listChecks,
  updateCase,
  updateCheck,
} from "../db";
import {
  firstZodMessage,
  guidedCheckSubmitSchema,
  unableSchema,
} from "../validation";

export const casesRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          crewId: z.string().optional(),
          includeArchived: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) =>
      listCases({
        crewId: input?.crewId,
        includeArchived: input?.includeArchived ?? false,
      }),
    ),

  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const record = await getCaseRow(input.id);
      if (!record)
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found." });
      const events = await listCaseEvents(input.id);
      const bundle = await buildBundle(record.crewId, {
        streamId: record.streamId,
      });
      const domain =
        bundle.domains.find((item) => item.domain === record.domain) ?? null;
      return { case: record, events, domain, bundle };
    }),

  acknowledge: publicProcedure
    .input(z.object({ caseId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const record = await getCaseRow(input.caseId);
      if (!record)
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found." });
      await updateCase(input.caseId, { acknowledgedAt: new Date() });
      await addCaseEvent({
        caseId: input.caseId,
        kind: "acknowledged",
        title: "Case acknowledged",
        body: "The case was marked as seen by the crew-side user. An acknowledgment means 'seen' only — it does not mean treated, cleared or recovered.",
        actor: "crew_mode",
        dedupeKey: `ack:${input.caseId}:${Date.now()}`,
      });
      return { ok: true };
    }),

  addNote: publicProcedure
    .input(
      z.object({
        caseId: z.string().min(1),
        kind: z.enum(["note", "action", "review_requested"]),
        body: z.string().trim().min(2, "Write a short note.").max(2000),
      }),
    )
    .mutation(async ({ input }) => {
      const record = await getCaseRow(input.caseId);
      if (!record)
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found." });
      const titles = {
        note: "Case note",
        action: "Action recorded",
        review_requested: "Medical review requested",
      } as const;
      await addCaseEvent({
        caseId: input.caseId,
        kind: input.kind,
        title: titles[input.kind],
        body: input.body,
        actor: "crew_mode",
      });
      return { ok: true };
    }),

  archive: publicProcedure
    .input(
      z.object({
        caseId: z.string().min(1),
        reason: z
          .string()
          .trim()
          .min(4, "Give a short reason for archiving.")
          .max(400),
      }),
    )
    .mutation(async ({ input }) => {
      const record = await getCaseRow(input.caseId);
      if (!record)
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found." });
      await updateCase(input.caseId, {
        status: "archived",
        archivedAt: new Date(),
        archiveReason: input.reason,
      });
      await addCaseEvent({
        caseId: input.caseId,
        kind: "archived",
        title: "Case archived by user action",
        body: `${input.reason} This records a user action only; it does not assert qualified clinical closure.`,
        actor: "crew_mode",
        dedupeKey: `archive:${input.caseId}:${Date.now()}`,
      });
      return { ok: true };
    }),
});

export const checksRouter = router({
  resolve: publicProcedure
    .input(
      z.object({
        crewId: z.string().min(1),
        domain: z.string().min(1),
        metric: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) =>
      resolveCheck({
        crewId: input.crewId,
        domain: input.domain as DomainKey,
        metric: input.metric,
      }),
    ),

  next: publicProcedure
    .input(z.object({ crewId: z.string().min(1) }))
    .query(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      const step = bundle.nextStep;
      if (!step) return { bundle, check: null, domain: null };
      const domain =
        bundle.domains.find((item) => item.domain === step.domain) ?? null;
      const open = await listChecks({ crewId: input.crewId, status: "open" });
      const existing = open.find((item) => item.domain === step.domain) ?? null;
      return { bundle, check: existing, domain };
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const check = await getCheck(input.id);
      if (!check)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Guided check not found.",
        });
      const bundle = await buildBundle(check.crewId);
      const domain =
        bundle.domains.find((item) => item.domain === check.domain) ?? null;
      return { check, bundle, domain };
    }),

  create: publicProcedure
    .input(
      z.object({
        crewId: z.string().min(1),
        domain: z.string().min(1),
        metric: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      const domain = bundle.domains.find(
        (item) => item.domain === input.domain,
      );
      if (!domain)
        throw new TRPCError({ code: "NOT_FOUND", message: "Unknown domain." });
      const open = await listChecks({ crewId: input.crewId, status: "open" });
      const existing = open.find(
        (item) => item.metric === input.metric && item.domain === input.domain,
      );
      if (existing) return existing;
      return createCheck({
        crewId: input.crewId,
        caseId: bundle.nextStep?.openCaseId ?? null,
        domain: input.domain,
        metric: input.metric,
        prompt: `Record ${METRICS[input.metric as keyof typeof METRICS].label.toLowerCase()}`,
        reason: `Selected from the ${domain.label.toLowerCase()} screen because this measurement is part of its evidence set.`,
        ruleIds: domain.ruleIds,
        streamId: bundle.stream?.id ?? null,
        urgency: domain.category === "priority" ? "priority" : "routine",
      });
    }),

  submit: publicProcedure
    .input(guidedCheckSubmitSchema)
    .mutation(async ({ input }) => {
      const parsed = guidedCheckSubmitSchema.safeParse(input);
      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: firstZodMessage(parsed.error),
        });
      }
      const check = await getCheck(parsed.data.checkId);
      if (!check)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Guided check not found.",
        });
      if (check.status !== "open") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This check has already been resolved.",
        });
      }
      const definition = METRICS[check.metric];
      const bundleBefore = await buildBundle(check.crewId, {
        withCaseLinks: false,
      });
      const observation = await insertObservation({
        crewId: check.crewId,
        metric: check.metric,
        numericValue:
          definition.kind === "choice" ? null : parsed.data.numericValue,
        textValue: definition.kind === "choice" ? parsed.data.textValue : null,
        unit: definition.unit,
        context: parsed.data.context,
        observedAt: parsed.data.observedAt,
        sourceKind: "manual",
        sourceLabel: "Guided check entry (recorded, not measured)",
        streamId: bundleBefore.stream?.id ?? null,
        importBatchId: null,
        note: parsed.data.note,
        clientRequestId: parsed.data.clientRequestId,
      });
      await updateCheck(check.id, {
        status: "completed",
        completedAt: new Date(),
        observationId: observation.id,
      });
      const caseId =
        check.caseId ??
        (
          await findOpenCase(
            check.crewId,
            check.domain,
            bundleBefore.stream?.id ?? null,
          )
        )?.id ??
        null;
      if (caseId) {
        await addCaseEvent({
          caseId,
          kind: "check_completed",
          title: `Guided check completed: ${definition.label}`,
          body: `${definition.label} recorded as ${
            observation.numericValue !== null
              ? `${observation.numericValue} ${definition.unit}`
              : observation.textValue
          } at ${observation.observedAt}.`,
          actor: "crew_mode",
          dedupeKey: `check:${check.id}`,
          data: { checkId: check.id, observationId: observation.id },
        });
      }
      const bundleAfter = await buildBundle(check.crewId, {
        withCaseLinks: false,
      });
      await syncCrewCases(check.crewId, bundleAfter);
      return {
        observation,
        check,
        previousCategory: bundleBefore.overallCategory,
        category: bundleAfter.overallCategory,
        nextStep: bundleAfter.nextStep,
      };
    }),

  unable: publicProcedure.input(unableSchema).mutation(async ({ input }) => {
    const check = await getCheck(input.checkId);
    if (!check)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Guided check not found.",
      });
    if (check.status !== "open") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This check has already been resolved.",
      });
    }
    const reason = input.reason?.trim() || "No reason given.";
    await updateCheck(check.id, {
      status: "unable",
      completedAt: new Date(),
      unableReason: reason,
    });
    if (check.caseId) {
      await addCaseEvent({
        caseId: check.caseId,
        kind: "check_declined",
        title: `Check not recorded: ${METRICS[check.metric].label}`,
        body: `The crew-side user reported that this measurement could not be recorded now. Reason: ${reason}. The value stays unknown and is not estimated.`,
        actor: "crew_mode",
        dedupeKey: `unable:${check.id}`,
        data: { checkId: check.id, reason },
      });
    }
    return { ok: true, reason };
  }),

  list: publicProcedure
    .input(
      z
        .object({
          crewId: z.string().optional(),
          status: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) =>
      listChecks({ crewId: input?.crewId, status: input?.status }),
    ),
});

export const DOMAIN_METRIC_HINT = METRICS;
export const CREW_LOOKUP = getCrew;
