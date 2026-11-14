import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CATEGORY_META, type DomainKey } from "../../shared/constants";
import {
  allowedTransitions,
  buildHandoverSnapshot,
  canTransition,
  nextLeg,
  scheduledTransitions,
  transitionError,
  type Timing,
} from "../../shared/handover";
import { publicProcedure, router } from "../_core/trpc";
import { buildBundle } from "../assessment";
import {
  addCaseEvent,
  addHandoverEvent,
  getCaseRow,
  getHandover,
  getState,
  insertHandover,
  listCaseEvents,
  listHandovers,
  markReplyReceived,
  updateHandover,
  updateState,
  upsertGroundReply,
} from "../db";
import type { Handover, HandoverStatus } from "../types";
import {
  clockAdvanceSchema,
  handoverCreateSchema,
  linkConfigSchema,
  replySchema,
} from "../validation";

function withLeg(handover: Handover, link: { virtualClock: string }): Handover {
  return {
    ...handover,
    nextLeg: nextLeg(
      handover.status,
      {
        queuedAt: handover.queuedAt,
        sentAt: handover.sentAt,
        deliveredAt: handover.deliveredAt,
        replyArrivesAt: handover.reply?.arrivesAt ?? null,
        oneWayDelayMinutes: handover.oneWayDelayMinutes,
        groundReviewMinutes: handover.groundReviewMinutes,
        linkAvailable: true,
      },
      link.virtualClock,
    ),
  };
}

async function evaluateScheduledTransitions(): Promise<{
  changes: { handoverId: string; status: HandoverStatus; note: string }[];
  clock: string;
}> {
  const state = await getState();
  const link = state.link;
  const all = await listHandovers();
  const changes: {
    handoverId: string;
    status: HandoverStatus;
    note: string;
  }[] = [];

  for (const summary of all) {
    if (!["queued", "sent", "reply_in_transit"].includes(summary.status))
      continue;
    const handover = await getHandover(summary.id);
    if (!handover) continue;
    const timing: Timing = {
      queuedAt: handover.queuedAt,
      sentAt: handover.sentAt,
      deliveredAt: handover.deliveredAt,
      replyArrivesAt: handover.reply?.arrivesAt ?? null,
      oneWayDelayMinutes: handover.oneWayDelayMinutes,
      groundReviewMinutes: handover.groundReviewMinutes,
      linkAvailable: link.linkAvailable,
    };
    const transitions = scheduledTransitions(
      handover.status,
      timing,
      link.virtualClock,
    );
    for (const transition of transitions) {
      if (!canTransition(handover.status, transition.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: transitionError(handover.status, transition.status),
        });
      }
      const patch: Parameters<typeof updateHandover>[1] = {
        status: transition.status,
      };
      if (transition.status === "sent")
        patch.sentAt = new Date(transition.occurredAt);
      if (transition.status === "delivered")
        patch.deliveredAt = new Date(transition.occurredAt);
      if (transition.status === "reply_received")
        patch.replyReceivedAt = new Date(transition.occurredAt);
      await updateHandover(handover.id, patch);
      await addHandoverEvent({
        handoverId: handover.id,
        status: transition.status,
        note: transition.note,
        actor: transition.status === "reply_received" ? "crew_mode" : "system",
        occurredAt: transition.occurredAt,
      });
      if (transition.status === "reply_received") {
        await markReplyReceived(handover.id);
        if (handover.caseId) {
          await addCaseEvent({
            caseId: handover.caseId,
            kind: "handover_reply",
            title: "Simulated ground reply received",
            body: `Handover ${handover.id} completed its return leg. The reply is a fictional simulation and carries no clinical authority.`,
            actor: "ground_simulation",
            dedupeKey: `handover:${handover.id}:reply`,
            occurredAt: transition.occurredAt,
          });
        }
      }
      changes.push({
        handoverId: handover.id,
        status: transition.status,
        note: transition.note,
      });
    }
  }

  return { changes, clock: link.virtualClock };
}

export const linkRouter = router({
  state: publicProcedure.query(async () => {
    const state = await getState();
    const handovers = await listHandovers();
    return {
      link: state.link,
      handovers: handovers.map((item) => withLeg(item, state.link)),
    };
  }),

  config: publicProcedure
    .input(linkConfigSchema)
    .mutation(async ({ input }) => {
      const state = await getState();
      const next = await updateState({
        link: {
          oneWayDelayMinutes: input.oneWayDelayMinutes,
          groundReviewMinutes: input.groundReviewMinutes,
          linkAvailable: input.linkAvailable,
        },
      });
      return { link: next.link, previous: state.link };
    }),

  advanceClock: publicProcedure
    .input(clockAdvanceSchema)
    .mutation(async ({ input }) => {
      const state = await getState();
      const clock = new Date(
        new Date(state.link.virtualClock).getTime() + input.minutes * 60_000,
      ).toISOString();
      await updateState({
        link: {
          virtualClock: clock,
          note: "Advancing the virtual link clock does not refresh, age or fabricate clinical observations.",
        },
      });
      const result = await evaluateScheduledTransitions();
      const refreshed = await getState();
      return {
        clock: refreshed.link.virtualClock,
        changes: result.changes,
        link: refreshed.link,
      };
    }),

  list: publicProcedure
    .input(z.object({ crewId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const state = await getState();
      const handovers = await listHandovers(input?.crewId);
      return handovers.map((item) => withLeg(item, state.link));
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const handover = await getHandover(input.id);
      if (!handover)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Handover not found.",
        });
      const state = await getState();
      return {
        handover: withLeg(handover, state.link),
        link: state.link,
        allowed: allowedTransitions(handover.status),
      };
    }),

  create: publicProcedure
    .input(handoverCreateSchema)
    .mutation(async ({ input }) => {
      const caseRecord = input.caseId ? await getCaseRow(input.caseId) : null;
      if (input.caseId && !caseRecord)
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found." });
      if (caseRecord && caseRecord.crewId !== input.crewId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The selected case belongs to a different astronaut.",
        });
      const bundle = await buildBundle(
        input.crewId,
        caseRecord ? { streamId: caseRecord.streamId } : {},
      );
      const domain =
        caseRecord?.domain ??
        (input.domain as DomainKey | null) ??
        bundle.nextStep?.domain ??
        null;
      const domainAssessment = domain
        ? (bundle.domains.find((item) => item.domain === domain) ?? null)
        : null;
      if (domain && !domainAssessment)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown domain.",
        });

      const caseEvents = caseRecord ? await listCaseEvents(caseRecord.id) : [];
      const recordedActions = input.recordedActions
        ? input.recordedActions
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        : caseEvents
            .filter((event) =>
              ["check_completed", "action", "note", "check_declined"].includes(
                event.kind,
              ),
            )
            .map((event) => `${event.title}: ${event.body}`);

      const state = await getState();
      const snapshot = buildHandoverSnapshot({
        bundle,
        domain,
        category: domainAssessment?.category ?? bundle.overallCategory,
        caseRecord,
        mission: bundle.mission,
        recordedActions,
        followUpQuestions: input.followUpQuestions
          ? input.followUpQuestions
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : [
              "Confirm whether these demonstration findings warrant clinical review before the next demanding activity.",
              "Advise which additional observations would reduce the remaining uncertainty.",
            ],
      });

      const id = await insertHandover({
        crewId: input.crewId,
        caseId: input.caseId ?? null,
        domain,
        category: snapshot.category,
        status: "draft",
        version: 1,
        parentId: null,
        oneWayDelayMinutes: state.link.oneWayDelayMinutes,
        groundReviewMinutes: state.link.groundReviewMinutes,
        snapshotJson: JSON.stringify(snapshot),
      });

      return { handoverId: id, snapshot };
    }),

  queue: publicProcedure
    .input(z.object({ handoverId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const handover = await getHandover(input.handoverId);
      if (!handover)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Handover not found.",
        });
      if (!canTransition(handover.status, "queued")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: transitionError(handover.status, "queued"),
        });
      }
      const state = await getState();
      const caseRecord = handover.caseId
        ? await getCaseRow(handover.caseId)
        : null;
      const bundle = await buildBundle(handover.crewId, {
        streamId: handover.snapshot?.streamId ?? caseRecord?.streamId ?? null,
      });
      const currentDomain = bundle.domains.find(
        (d) => d.domain === handover.domain,
      );
      const snapshot = buildHandoverSnapshot({
        bundle,
        domain: handover.domain,
        category: currentDomain?.category ?? bundle.overallCategory,
        caseRecord,
        mission: bundle.mission,
        recordedActions: handover.snapshot?.recordedActions ?? [],
        followUpQuestions: handover.snapshot?.followUpQuestions ?? [],
      });
      await updateHandover(handover.id, {
        status: "queued",
        queuedAt: new Date(state.link.virtualClock),
        snapshotJson: JSON.stringify(snapshot),
        category: snapshot.category,
      });
      await addHandoverEvent({
        handoverId: handover.id,
        status: "queued",
        note: `Queued at virtual clock ${state.link.virtualClock}. The evidence snapshot is frozen at this moment (rule set ${
          snapshot.ruleSetVersion
        }).`,
        actor: "crew_mode",
        occurredAt: state.link.virtualClock,
      });
      if (handover.caseId) {
        await addCaseEvent({
          caseId: handover.caseId,
          kind: "handover_queued",
          title: "Handover queued for simulated deep-space link",
          body: `Handover ${handover.id} frozen and queued. ${
            state.link.linkAvailable
              ? "The simulated link is available."
              : "The simulated link is unavailable; dispatch waits."
          }`,
          actor: "crew_mode",
          dedupeKey: `handover:${handover.id}:queued`,
          occurredAt: state.link.virtualClock,
        });
      }
      const refreshed = await getHandover(handover.id);
      return { handover: refreshed ? withLeg(refreshed, state.link) : null };
    }),

  reply: publicProcedure.input(replySchema).mutation(async ({ input }) => {
    const handover = await getHandover(input.handoverId);
    if (!handover)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Handover not found.",
      });
    if (!canTransition(handover.status, "reply_in_transit")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${transitionError(handover.status, "reply_in_transit")} A ground reply can only be composed after simulated delivery.`,
      });
    }
    const state = await getState();
    const arrivesAt = new Date(
      new Date(state.link.virtualClock).getTime() +
        (handover.groundReviewMinutes + handover.oneWayDelayMinutes) * 60_000,
    ).toISOString();
    await upsertGroundReply({
      handoverId: handover.id,
      author:
        input.author?.trim() || "Simulated ground medical team (fictional)",
      body: input.body,
      arrivesAt,
    });
    await updateHandover(handover.id, { status: "reply_in_transit" });
    await addHandoverEvent({
      handoverId: handover.id,
      status: "reply_in_transit",
      note: `Fictional ground review completed after ${handover.groundReviewMinutes} min. The return leg now needs ${handover.oneWayDelayMinutes} min of one-way delay; arrival ${arrivesAt}.`,
      actor: "ground_simulation",
      occurredAt: state.link.virtualClock,
    });
    const refreshed = await getHandover(handover.id);
    return {
      handover: refreshed ? withLeg(refreshed, state.link) : null,
      arrivesAt,
    };
  }),

  revise: publicProcedure
    .input(z.object({ handoverId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const handover = await getHandover(input.handoverId);
      if (!handover)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Handover not found.",
        });
      const bundle = await buildBundle(handover.crewId, {
        streamId: handover.snapshot?.streamId ?? null,
      });
      const caseRecord = handover.caseId
        ? await getCaseRow(handover.caseId)
        : null;
      const domainAssessment = handover.domain
        ? (bundle.domains.find((item) => item.domain === handover.domain) ??
          null)
        : null;
      const state = await getState();
      const snapshot = buildHandoverSnapshot({
        bundle,
        domain: handover.domain,
        category: domainAssessment?.category ?? handover.category,
        caseRecord,
        mission: bundle.mission,
        recordedActions: handover.snapshot?.recordedActions ?? [],
        followUpQuestions: handover.snapshot?.followUpQuestions ?? [],
      });
      const id = await insertHandover({
        crewId: handover.crewId,
        caseId: handover.caseId,
        domain: handover.domain,
        category: snapshot.category,
        status: "draft",
        version: handover.version + 1,
        parentId: handover.id,
        oneWayDelayMinutes: state.link.oneWayDelayMinutes,
        groundReviewMinutes: state.link.groundReviewMinutes,
        snapshotJson: JSON.stringify(snapshot),
      });
      if (handover.caseId) {
        await addCaseEvent({
          caseId: handover.caseId,
          kind: "handover_queued",
          title: `Handover revision ${handover.version + 1} created`,
          body: `A new draft was created from handover ${handover.id}. The earlier frozen snapshot is unchanged.`,
          actor: "crew_mode",
          dedupeKey: `handover:${id}:revision`,
        });
      }
      return { handoverId: id, version: handover.version + 1 };
    }),

  categoryLabel: publicProcedure
    .input(z.object({ category: z.string() }))
    .query(({ input }) => ({
      label:
        CATEGORY_META[input.category as keyof typeof CATEGORY_META]?.label ??
        input.category,
    })),
});
