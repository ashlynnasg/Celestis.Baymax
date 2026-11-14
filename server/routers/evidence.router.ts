import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { SCIENCE_REFERENCES } from "../../shared/references";
import {
  logSummary,
  missionLogInputSchema,
} from "../../shared/mission-context";
import { previewContextImport } from "../../shared/context-import";
import { publicProcedure, router } from "../_core/trpc";
import { buildBundle } from "../assessment";
import { listCases, addCaseEvent } from "../db";
import { listMissionLogs, saveMissionLogs } from "../mission-log-store";

const importSchema = z.object({
  crewId: z.string().min(1),
  text: z.string().min(1).max(1_000_000),
  format: z.enum(["csv", "json"]),
  sourceTitle: z.string().trim().min(2).max(160),
  sourceRef: z.string().trim().max(400).default(""),
});
async function recordEvents(
  crewId: string,
  records: Awaited<ReturnType<typeof saveMissionLogs>>["inserted"],
) {
  if (!records.length) return;
  const cases = await listCases({ crewId });
  for (const log of records) {
    for (const item of cases.filter(
      (c) => c.status !== "archived" && c.streamId === log.streamId,
    )) {
      await addCaseEvent({
        caseId: item.id,
        kind: "note",
        title: `Mission evidence: ${log.data.kind}`,
        body: `${logSummary(log)} Source: ${log.sourceLabel} (${log.sourceKind}), observed ${log.observedAt}. Context recorded; no clinical category inferred.`,
        occurredAt: log.createdAt,
        actor: "crew_mode",
        dedupeKey: `mission-log:${item.id}:${log.id}`,
        data: { missionLogId: log.id, snapshot: log },
      });
    }
  }
}
export const evidenceRouter = router({
  sources: publicProcedure.query(() => SCIENCE_REFERENCES),
  history: publicProcedure
    .input(z.object({ crewId: z.string().min(1) }))
    .query(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      return {
        records: await listMissionLogs(input.crewId, bundle.stream?.id ?? null),
        streamId: bundle.stream?.id ?? null,
      };
    }),
  record: publicProcedure
    .input(missionLogInputSchema)
    .mutation(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      const result = await saveMissionLogs(
        [input],
        bundle.stream?.id ?? null,
        bundle.mission?.id ?? null,
      );
      await recordEvents(input.crewId, result.inserted);
      return {
        insertedCount: result.inserted.length,
        duplicateCount: result.duplicateCount,
      };
    }),
  preview: publicProcedure.input(importSchema).mutation(async ({ input }) => {
    const bundle = await buildBundle(input.crewId);
    const result = previewContextImport(input);
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          ...input,
          stream: bundle.stream?.id ?? null,
          mission: bundle.mission?.id ?? null,
        }),
      )
      .digest("hex");
    return {
      ...result,
      fingerprint,
      streamLabel: bundle.stream?.label ?? "Baseline",
      missionName: bundle.mission?.name ?? "None",
    };
  }),
  commit: publicProcedure
    .input(importSchema.extend({ fingerprint: z.string().length(64) }))
    .mutation(async ({ input }) => {
      const { fingerprint, ...payload } = input;
      const bundle = await buildBundle(input.crewId);
      const expected = createHash("sha256")
        .update(
          JSON.stringify({
            ...payload,
            stream: bundle.stream?.id ?? null,
            mission: bundle.mission?.id ?? null,
          }),
        )
        .digest("hex");
      if (expected !== fingerprint)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Content, mission or stream changed. Preview again before committing.",
        });
      const result = previewContextImport(payload);
      if (result.errors.length || !result.records.length)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Resolve all validation errors before commit. No rows were stored.",
        });
      const saved = await saveMissionLogs(
        result.records,
        bundle.stream?.id ?? null,
        bundle.mission?.id ?? null,
      );
      await recordEvents(input.crewId, saved.inserted);
      return {
        insertedCount: saved.inserted.length,
        duplicateCount: saved.duplicateCount,
      };
    }),
  export: publicProcedure
    .input(z.object({ crewId: z.string().min(1) }))
    .query(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      return {
        filename: `mission-evidence-${input.crewId}.json`,
        json: JSON.stringify(
          {
            assessedAt: bundle.assessedAt,
            mission: bundle.mission,
            stream: bundle.stream,
            spaceContext: bundle.spaceContext,
            references: SCIENCE_REFERENCES,
          },
          null,
          2,
        ),
      };
    }),
});
