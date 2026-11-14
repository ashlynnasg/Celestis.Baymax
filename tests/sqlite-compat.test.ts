import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { crewProfiles } from "../drizzle/schema";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { ensureSeeded } from "../server/seed";
import { closeSqlite, sqliteTransaction } from "../server/sqlite";
import { getCrew, getDb, getUserByOpenId, listCrew, listObservations, readBackupTables, upsertUser } from "../server/db";
import { loginOwner, logoutOwner, readOwnerStatus, setupOwner } from "../server/owner-auth";
import { listMissionLogs, saveMissionLogs } from "../server/mission-log-store";
import { buildSqliteBackup } from "../server/sqlite-export";
import type { MissionLogInput } from "../shared/mission-context";

const temporary = mkdtempSync(join(tmpdir(), "baymax windows sqlite "));
const originalPath = process.env.BAYMAX_DB_PATH;
const file = join(temporary, "data folder", "celestial-baymax.sqlite");
const caller = appRouter.createCaller({ user: null, req: { headers: {} }, res: {} } as TrpcContext);

describe("local SQLite compatibility", () => {
  beforeAll(async () => {
    process.env.BAYMAX_DB_PATH = file;
    await ensureSeeded();
  });
  afterAll(async () => {
    await closeSqlite();
    if (originalPath === undefined) delete process.env.BAYMAX_DB_PATH;
    else process.env.BAYMAX_DB_PATH = originalPath;
    rmSync(temporary, { recursive: true, force: true });
  });

  it("creates real SQLite in a path with spaces and seeds only once", async () => {
    expect(readFileSync(file).subarray(0, 16).toString()).toBe("SQLite format 3\0");
    expect(await listCrew()).toHaveLength(6);
    const initial = await listObservations("crew-01", null);
    await ensureSeeded();
    expect(await listCrew()).toHaveLength(6);
    expect(await listObservations("crew-01", null)).toHaveLength(initial.length);
  });

  it("preserves profiles, booleans and history when the connection reopens", async () => {
    const crew = (await getCrew("crew-01"))!;
    const updated = await caller.crew.update({ ...crew, displayName: "Maya Local SQLite" });
    expect(updated.displayName).toBe("Maya Local SQLite");
    await caller.crew.archive({ id: crew.id, archived: true });
    await closeSqlite();
    expect((await getCrew(crew.id))?.archived).toBe(true);
    expect((await getCrew(crew.id))?.history).toEqual(crew.history);
    await caller.crew.archive({ id: crew.id, archived: false });
  });

  it("round-trips Date account fields, hashes and session revocation", async () => {
    expect((await readOwnerStatus(null)).hasOwner).toBe(false);
    const session = await setupOwner("A fictional crew passphrase", "Team B");
    expect((await readOwnerStatus(session.token)).authenticated).toBe(true);
    await closeSqlite();
    expect((await readOwnerStatus(session.token)).sessionExpiresAt).toBe(session.expiresAt);
    await expect(loginOwner("wrong passphrase")).rejects.toThrow("does not match");
    await logoutOwner(session.token);
    expect((await readOwnerStatus(session.token)).authenticated).toBe(false);
    const login = await loginOwner("A fictional crew passphrase");
    expect((await readOwnerStatus(login.token)).authenticated).toBe(true);
    await expect(setupOwner("another fictional passphrase", "Other")).rejects.toThrow("already exists");
  });

  it("uses SQLite conflict updates for optional account records", async () => {
    await upsertUser({ openId: "local-test", name: "Before" });
    await upsertUser({ openId: "local-test", name: "After", role: "admin" });
    const user = await getUserByOpenId("local-test");
    expect(user?.name).toBe("After");
    expect(user?.role).toBe("admin");
    expect(user?.createdAt).toBeInstanceOf(Date);
  });

  it("commits and deduplicates concurrent mission evidence atomically", async () => {
    const at = new Date(Date.now() - 60_000).toISOString();
    const input: MissionLogInput = {
      crewId: "crew-01", observedAt: at, sourceKind: "simulated", sourceLabel: "SQLite compatibility test",
      sourceRef: "Fictional data", note: "No clinical interpretation",
      data: { kind: "radiation", startAt: at, quantity: "absorbed_dose", value: 0.2,
        unit: "mGy", component: "unknown", scope: "area", location: "Demo cabin", instrument: "Simulation" },
    };
    const results = await Promise.all([saveMissionLogs([input], null, null), saveMissionLogs([input], null, null)]);
    expect(results.reduce((count, result) => count + result.inserted.length, 0)).toBe(1);
    expect(results.reduce((count, result) => count + result.duplicateCount, 0)).toBe(1);
    await closeSqlite();
    expect((await listMissionLogs("crew-01", null))[0].data).toEqual(input.data);
  });

  it("rolls back failed transactions without swallowing unrelated concurrent writes", async () => {
    const db = await getDb();
    const before = (await getCrew("crew-01"))!.displayName;
    const failed = sqliteTransaction(async () => {
      await db.update(crewProfiles).set({ displayName: "Must roll back" }).where(eq(crewProfiles.id, "crew-01"));
      await new Promise((accept) => setTimeout(accept, 20));
      throw new Error("intentional rollback");
    });
    const unrelated = db.update(crewProfiles).set({ callSign: "Persistent" }).where(eq(crewProfiles.id, "crew-02")).execute();
    await expect(failed).rejects.toThrow("intentional rollback");
    await unrelated;
    expect((await getCrew("crew-01"))?.displayName).toBe(before);
    expect((await getCrew("crew-02"))?.callSign).toBe("Persistent");
  });

  it("imports CSV and JSON using the existing validation and commit workflow", async () => {
    for (const format of ["csv", "json"] as const) {
      const at = new Date(Date.now() - (format === "csv" ? 120_000 : 180_000)).toISOString();
      const row = { crew_id: "crew-01", observed_at: at, heart_rate: 76, context: "rest" };
      const text = format === "csv" ? `crew_id,observed_at,heart_rate,context\ncrew-01,${at},76,rest` : JSON.stringify([row]);
      const preview = await caller.imports.preview({ format, text, sourceTitle: `${format} local test` });
      expect(preview.batch.errorCount).toBe(0);
      expect(preview.batch.validCount).toBeGreaterThan(0);
      const commit = await caller.imports.commit({ batchId: preview.batch.id });
      expect(commit.inserted).toBeGreaterThan(0);
      await expect(caller.imports.commit({ batchId: preview.batch.id })).rejects.toThrow("already committed");
    }
  });

  it("runs simulation without changing baseline and returns screening results", async () => {
    const before = await listObservations("crew-01", null);
    const run = await caller.simulator.run({ crewId: "crew-01", scenario: "sleep_deprivation", seed: 42 });
    const saved = await caller.simulator.get({ runId: run.id });
    expect(saved.observations.length).toBeGreaterThan(0);
    expect(saved.observations.every((item) => item.sourceKind === "simulated")).toBe(true);
    expect(await listObservations("crew-01", null)).toEqual(before);
    const bundle = await caller.assessment.forCrew({ crewId: "crew-01" });
    expect(bundle.domains).toHaveLength(8);
  });

  it("exports a valid credential-free SQLite backup and cleans temporary handles", async () => {
    const backup = buildSqliteBackup(await readBackupTables(), new Date().toISOString());
    const backupFile = join(temporary, "backup.sqlite");
    writeFileSync(backupFile, backup.bytes);
    const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
    const db = new DatabaseSync(backupFile);
    try {
      expect(db.prepare("PRAGMA integrity_check").get()?.integrity_check).toBe("ok");
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
      expect(tables).toContain("missionLogs");
      expect(tables).not.toContain("owners");
      expect(tables).not.toContain("ownerSessions");
      expect(backup.totalRows).toBeGreaterThan(150);
    } finally { db.close(); }
  });
});
