import { evidenceRouter } from "./routers/evidence.router";
import { z } from "zod";
import { buildObservationsCsv } from "../shared/importing";
import { getSessionCookieName, getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { buildBundle } from "./assessment";
import { listObservations, readBackupTables } from "./db";
import { assistantRouter } from "./routers/assistant.router";
import { assessmentRouter, missionRouter } from "./routers/assessment.router";
import { casesRouter, checksRouter } from "./routers/cases.router";
import { crewRouter } from "./routers/crew.router";
import { importsRouter } from "./routers/imports.router";
import { linkRouter } from "./routers/link.router";
import {
  loginOwner,
  logoutOwner,
  readOwnerStatus,
  bearerToken,
  setupOwner,
} from "./owner-auth";
import { observationRouter } from "./routers/observation.router";
import { simulatorRouter } from "./routers/simulator.router";
import { stateRouter } from "./routers/state.router";
import { buildSqlDump, buildSqliteBackup, isSqliteAvailable } from "./sqlite-export";

export const exportRouter = router({
  observationsCsv: publicProcedure
    .input(z.object({ crewId: z.string().min(1) }))
    .query(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      const streamId = bundle.stream?.id ?? null;
      const observations = await listObservations(input.crewId, streamId);
      const csv = buildObservationsCsv(
        observations.map((observation) => ({
          crewName: bundle.crew.displayName,
          observation,
        })),
      );
      return { filename: `observations-${input.crewId}.csv`, csv };
    }),

  /**
   * SQLite-compatible backup: a real `.sqlite` database built with `node:sqlite`, falling back to a
   * `.sql` dump that recreates the same file when the runtime has no SQLite module.
   */
  sqliteBackup: publicProcedure.mutation(async () => {
    const generatedAt = new Date().toISOString();
    const stamp = generatedAt.replace(/[:.]/g, "-").slice(0, 19);
    const tables = await readBackupTables();
    if (isSqliteAvailable()) {
      const backup = buildSqliteBackup(tables, generatedAt);
      return {
        format: "sqlite" as const,
        filename: `celestial-baymax-${stamp}.sqlite`,
        mimeType: "application/vnd.sqlite3",
        base64: Buffer.from(backup.bytes).toString("base64"),
        counts: backup.counts,
        totalRows: backup.totalRows,
        generatedAt,
      };
    }
    const dump = buildSqlDump(tables, generatedAt);
    const counts = Object.fromEntries(tables.map((table) => [table.name, table.rows.length]));
    return {
      format: "sql-dump" as const,
      filename: `celestial-baymax-${stamp}.sql`,
      mimeType: "application/sql",
      base64: Buffer.from(dump, "utf8").toString("base64"),
      counts,
      totalRows: tables.reduce((sum, table) => sum + table.rows.length, 0),
      generatedAt,
    };
  }),

  bundleJson: publicProcedure
    .input(z.object({ crewId: z.string().min(1) }))
    .query(async ({ input }) => {
      const bundle = await buildBundle(input.crewId);
      return {
        filename: `assessment-${input.crewId}.json`,
        json: JSON.stringify(bundle, null, 2),
      };
    }),
});

export const ownerRouter = router({
  status: publicProcedure.query((opts) =>
    readOwnerStatus(bearerToken(opts.ctx.req)),
  ),
  setup: publicProcedure
    .input(
      z.object({
        passphrase: z.string().min(10, "Use at least 10 characters."),
        displayName: z.string().max(80).optional(),
      }),
    )
    .mutation((opts) =>
      setupOwner(opts.input.passphrase, opts.input.displayName ?? "Owner"),
    ),
  login: publicProcedure
    .input(
      z.object({
        passphrase: z.string().min(1, "Enter the owner passphrase."),
      }),
    )
    .mutation((opts) => loginOwner(opts.input.passphrase)),
  logout: publicProcedure.mutation(async (opts) => {
    await logoutOwner(bearerToken(opts.ctx.req));
    return { ok: true } as const;
  }),
});

export const appRouter = router({
  system: systemRouter,
  owner: ownerRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(getSessionCookieName(ctx.req), {
        ...cookieOptions,
        maxAge: -1,
      });
      return { success: true } as const;
    }),
  }),
  crew: crewRouter,
  observation: observationRouter,
  assessment: assessmentRouter,
  mission: missionRouter,
  cases: casesRouter,
  checks: checksRouter,
  assistant: assistantRouter,
  simulator: simulatorRouter,
  imports: importsRouter,
  link: linkRouter,
  state: stateRouter,
  exports: exportRouter,
  evidence: evidenceRouter,
});

export type AppRouter = typeof appRouter;
