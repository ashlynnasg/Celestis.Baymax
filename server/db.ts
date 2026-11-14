import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getSqliteOrm } from "./sqlite";
import {
  appState,
  caseEvents,
  cases,
  crewProfiles,
  groundReplies,
  guidedChecks,
  handoverEvents,
  handovers,
  importBatches,
  missionLogs,
  missionPlans,
  observations,
  simulationRuns,
  users,
} from "../drizzle/schema";
import type {
  AppState,
  CaseEvent,
  CaseEventKind,
  CaseRecord,
  CaseStatus,
  CrewHistory,
  CrewProfile,
  DomainAssessment,
  GuidedCheck,
  Handover,
  HandoverEvent,
  HandoverReply,
  HandoverSnapshot,
  HandoverStatus,
  ImportBatch,
  ImportColumnMapping,
  ImportPreviewRow,
  ImportRowError,
  InsertUser,
  LinkState,
  MetricKey,
  MissionSettings,
  Observation,
  ObservationInput,
  ObservationSourceKind,
  ScenarioKey,
  ScenarioPreviewRow,
  SimulationRun,
} from "./types";
import { ENV } from "./_core/env";
import { LINK_DEFAULTS, METRICS } from "../shared/constants";

export type { InsertUser };

/** Built-in local SQLite; no database server or DATABASE_URL is required. */
export async function getDb() {
  return getSqliteOrm();
}

export async function requireDb() {
  return getDb();
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Partial<InsertUser> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    textFields.forEach((field) => {
      const value = user[field];
      if (value === undefined) return;
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    });
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0)
      updateSet.lastSignedIn = new Date();
    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

/* ------------------------------------------------------------------ utils */

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function iso(value: Date | string | number | null | undefined): string | null {
  if (!value) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function isoRequired(value: Date | string | number): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/** SQLite stores domain timestamps as epoch milliseconds; patches may still carry Date values. */
function toMs<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = item instanceof Date ? item.getTime() : item;
  }
  return out;
}

export function emptyHistory(): CrewHistory {
  return {
    previousConditions: [],
    injuriesSurgeries: [],
    medications: [],
    allergies: [],
    familyHistory: [],
    cardiovascular: { conditions: [], knownHypertension: "unknown", notes: "" },
    boneMuscle: {
      boneDensityConcern: "unknown",
      priorFracture: "unknown",
      muscleLossConcern: "unknown",
      notes: "",
    },
    sleepWellbeing: {
      baselineSleepHours: null,
      insomniaHistory: "unknown",
      anxietyHistory: "unknown",
      notes: "",
    },
    vision: {
      correctiveLenses: "unknown",
      priorVisionChanges: "unknown",
      notes: "",
    },
    respiratory: { asthma: "unknown", notes: "" },
    missionHistory: { previousConcerns: [], evaHours: null, notes: "" },
  };
}

/* ------------------------------------------------------------------- crew */

type CrewRowLike = typeof crewProfiles.$inferSelect;

export function mapCrew(row: CrewRowLike): CrewProfile {
  return {
    id: row.id,
    displayName: row.displayName,
    callSign: row.callSign,
    role: row.role,
    age: row.age,
    sexAtBirth: row.sexAtBirth,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    bloodType: row.bloodType,
    missions: parseJson<string[]>(row.missionsJson, []),
    archived: row.archived,
    history: {
      ...emptyHistory(),
      ...parseJson<CrewHistory>(row.historyJson, emptyHistory()),
    },
    createdAt: isoRequired(row.createdAt),
    updatedAt: isoRequired(row.updatedAt),
  };
}

export async function listCrew(includeArchived = true): Promise<CrewProfile[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(crewProfiles)
    .where(includeArchived ? sql`true` : eq(crewProfiles.archived, false))
    .orderBy(asc(crewProfiles.displayName));
  return rows.map(mapCrew);
}

export async function getCrew(id: string): Promise<CrewProfile | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(crewProfiles)
    .where(eq(crewProfiles.id, id))
    .limit(1);
  return rows[0] ? mapCrew(rows[0]) : null;
}

export type CrewWriteInput = {
  displayName: string;
  callSign: string;
  role: string;
  age: number;
  sexAtBirth: string;
  heightCm: number;
  weightKg: number;
  bloodType: string;
  missions: string[];
  history: CrewHistory;
};

export async function createCrew(
  input: CrewWriteInput,
  explicitId?: string,
): Promise<CrewProfile> {
  const db = await requireDb();
  const id = explicitId ?? newId("crew");
  await db.insert(crewProfiles).values({
    id,
    displayName: input.displayName,
    callSign: input.callSign,
    role: input.role,
    age: input.age,
    sexAtBirth: input.sexAtBirth,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    bloodType: input.bloodType,
    missionsJson: JSON.stringify(input.missions),
    historyJson: JSON.stringify(input.history),
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const created = await getCrew(id);
  if (!created)
    throw new Error("Crew profile could not be read back after creation.");
  return created;
}

export async function updateCrew(
  id: string,
  input: CrewWriteInput,
): Promise<CrewProfile> {
  const db = await requireDb();
  await db
    .update(crewProfiles)
    .set({
      displayName: input.displayName,
      callSign: input.callSign,
      role: input.role,
      age: input.age,
      sexAtBirth: input.sexAtBirth,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      bloodType: input.bloodType,
      missionsJson: JSON.stringify(input.missions),
      historyJson: JSON.stringify(input.history),
    })
    .where(eq(crewProfiles.id, id));
  const updated = await getCrew(id);
  if (!updated) throw new Error("Crew profile not found.");
  return updated;
}

export async function setCrewArchived(
  id: string,
  archived: boolean,
): Promise<void> {
  const db = await requireDb();
  await db
    .update(crewProfiles)
    .set({ archived })
    .where(eq(crewProfiles.id, id));
}

/* ------------------------------------------------------------ observations */

type ObservationRowLike = typeof observations.$inferSelect;

export function mapObservation(row: ObservationRowLike): Observation {
  return {
    id: row.id,
    crewId: row.crewId,
    metric: row.metric as MetricKey,
    numericValue: row.numericValue ?? null,
    textValue: row.textValue ?? null,
    unit: row.unit,
    context: (row.context as Observation["context"]) ?? null,
    observedAt: isoRequired(row.observedAt),
    sourceKind: row.sourceKind as ObservationSourceKind,
    sourceLabel: row.sourceLabel,
    streamId: row.streamId ?? null,
    importBatchId: row.importBatchId ?? null,
    note: row.note ?? null,
    createdAt: isoRequired(row.createdAt),
  };
}

export async function listObservations(
  crewId: string,
  streamId: string | null,
): Promise<Observation[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(observations)
    .where(
      streamId
        ? and(
            eq(observations.crewId, crewId),
            eq(observations.streamId, streamId),
          )
        : and(eq(observations.crewId, crewId), isNull(observations.streamId)),
    )
    .orderBy(asc(observations.observedAt));
  return rows.map(mapObservation);
}

export async function listObservationsByStream(
  streamId: string,
): Promise<Observation[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(observations)
    .where(eq(observations.streamId, streamId))
    .orderBy(asc(observations.observedAt));
  return rows.map(mapObservation);
}

export async function listStreamObservations(
  crewId: string,
  streamIds: string[],
): Promise<Observation[]> {
  if (streamIds.length === 0) return [];
  const db = await requireDb();
  const rows = await db
    .select()
    .from(observations)
    .where(
      and(
        eq(observations.crewId, crewId),
        inArray(observations.streamId, streamIds),
      ),
    )
    .orderBy(asc(observations.observedAt));
  return rows.map(mapObservation);
}

export async function observationKeysFor(crewId: string): Promise<string[]> {
  const db = await requireDb();
  const rows = await db
    .select({
      crewId: observations.crewId,
      metric: observations.metric,
      observedAt: observations.observedAt,
      numericValue: observations.numericValue,
      textValue: observations.textValue,
    })
    .from(observations)
    .where(eq(observations.crewId, crewId));
  return rows.map(
    (row) =>
      `${row.crewId}|${row.metric}|${isoRequired(row.observedAt)}|${
        row.numericValue !== null && row.numericValue !== undefined
          ? String(row.numericValue)
          : String(row.textValue ?? "")
      }`,
  );
}

export type ObservationWrite = {
  crewId: string;
  metric: MetricKey;
  numericValue: number | null;
  textValue: string | null;
  unit: string;
  context: Observation["context"];
  observedAt: string;
  sourceKind: ObservationSourceKind;
  sourceLabel: string;
  streamId: string | null;
  importBatchId: string | null;
  note: string | null;
  clientRequestId?: string | null;
};

export async function insertObservation(
  input: ObservationWrite,
): Promise<Observation> {
  const db = await requireDb();
  if (input.clientRequestId) {
    const existing = await db
      .select()
      .from(observations)
      .where(eq(observations.clientRequestId, input.clientRequestId))
      .limit(1);
    if (existing[0]) return mapObservation(existing[0]);
  }
  const id = newId("obs");
  await db.insert(observations).values({
    id,
    crewId: input.crewId,
    metric: input.metric,
    numericValue: input.numericValue,
    textValue: input.textValue,
    unit: input.unit || METRICS[input.metric].unit,
    context: input.context ?? null,
    observedAt: new Date(input.observedAt).getTime(),
    sourceKind: input.sourceKind,
    sourceLabel: input.sourceLabel,
    streamId: input.streamId ?? null,
    importBatchId: input.importBatchId ?? null,
    note: input.note ?? null,
    clientRequestId: input.clientRequestId ?? null,
    createdAt: Date.now(),
  });
  const rows = await db
    .select()
    .from(observations)
    .where(eq(observations.id, id))
    .limit(1);
  if (!rows[0])
    throw new Error("Observation could not be read back after insert.");
  return mapObservation(rows[0]);
}

export async function getObservation(id: string): Promise<Observation | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(observations)
    .where(eq(observations.id, id))
    .limit(1);
  return rows[0] ? mapObservation(rows[0]) : null;
}

/* ------------------------------------------------------------------ state */

const DEFAULT_LINK: LinkState = {
  oneWayDelayMinutes: LINK_DEFAULTS.oneWayDelayMinutes,
  groundReviewMinutes: LINK_DEFAULTS.groundReviewMinutes,
  linkAvailable: LINK_DEFAULTS.linkAvailable,
  virtualClock: new Date().toISOString(),
  realClock: new Date().toISOString(),
  note: "Virtual link clock is independent of observation time.",
};

export async function getState(): Promise<AppState> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(appState)
    .where(eq(appState.id, 1))
    .limit(1);
  if (!rows[0]) {
    await db.insert(appState).values({
      id: 1,
      linkJson: JSON.stringify(DEFAULT_LINK),
      seedVersion: "",
      updatedAt: Date.now(),
    });
    return {
      appliedMissionId: null,
      draftMissionId: null,
      activeStreamId: null,
      activeStreamCrewId: null,
      link: {
        ...DEFAULT_LINK,
        realClock: new Date().toISOString(),
        virtualClock: new Date().toISOString(),
      },
      seedVersion: "",
      updatedAt: new Date().toISOString(),
    };
  }
  const row = rows[0];
  return {
    appliedMissionId: row.appliedMissionId ?? null,
    draftMissionId: row.draftMissionId ?? null,
    activeStreamId: row.activeStreamId ?? null,
    activeStreamCrewId: row.activeStreamCrewId ?? null,
    link: {
      ...DEFAULT_LINK,
      ...parseJson<Partial<LinkState>>(row.linkJson, {}),
      realClock: new Date().toISOString(),
    },
    seedVersion: row.seedVersion,
    updatedAt: isoRequired(row.updatedAt),
  };
}

export async function updateState(patch: {
  appliedMissionId?: string | null;
  draftMissionId?: string | null;
  activeStreamId?: string | null;
  activeStreamCrewId?: string | null;
  link?: Partial<LinkState>;
  seedVersion?: string;
}): Promise<AppState> {
  const db = await requireDb();
  const current = await getState();
  const link = { ...current.link, ...(patch.link ?? {}) };
  const values = {
    appliedMissionId:
      patch.appliedMissionId !== undefined
        ? patch.appliedMissionId
        : current.appliedMissionId,
    draftMissionId:
      patch.draftMissionId !== undefined
        ? patch.draftMissionId
        : current.draftMissionId,
    activeStreamId:
      patch.activeStreamId !== undefined
        ? patch.activeStreamId
        : current.activeStreamId,
    activeStreamCrewId:
      patch.activeStreamCrewId !== undefined
        ? patch.activeStreamCrewId
        : current.activeStreamCrewId,
    linkJson: JSON.stringify(link),
    seedVersion: patch.seedVersion ?? current.seedVersion,
  };
  const existing = await db
    .select()
    .from(appState)
    .where(eq(appState.id, 1))
    .limit(1);
  if (existing[0]) {
    await db.update(appState).set(toMs(values)).where(eq(appState.id, 1));
  } else {
    await db.insert(appState).values({ id: 1, ...toMs(values) } as typeof appState.$inferInsert);
  }
  return getState();
}

/* --------------------------------------------------------------- missions */

type MissionRowLike = typeof missionPlans.$inferSelect;

export function mapMission(row: MissionRowLike): MissionSettings {
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    durationDays: row.durationDays,
    activityLevel: row.activityLevel as MissionSettings["activityLevel"],
    workload: row.workload as MissionSettings["workload"],
    evaRequired: row.evaRequired,
    status: row.status as MissionSettings["status"],
    crewScope: row.crewScope as MissionSettings["crewScope"],
    createdAt: isoRequired(row.createdAt),
    appliedAt: iso(row.appliedAt),
  };
}

export async function getMission(
  id: string | null,
): Promise<MissionSettings | null> {
  if (!id) return null;
  const db = await requireDb();
  const rows = await db
    .select()
    .from(missionPlans)
    .where(eq(missionPlans.id, id))
    .limit(1);
  return rows[0] ? mapMission(rows[0]) : null;
}

export async function getAppliedMission(
  state?: AppState,
): Promise<MissionSettings | null> {
  const current = state ?? (await getState());
  return getMission(current.appliedMissionId);
}

export async function getDraftMission(
  state?: AppState,
): Promise<MissionSettings | null> {
  const current = state ?? (await getState());
  return getMission(current.draftMissionId);
}

export async function saveDraftMission(
  input: {
    destination: string;
    durationDays: number;
    activityLevel: MissionSettings["activityLevel"];
    workload: MissionSettings["workload"];
    evaRequired: boolean;
    crewScope: MissionSettings["crewScope"];
  },
  existingId: string | null,
): Promise<MissionSettings> {
  const db = await requireDb();
  const name = `${input.destination} · ${input.durationDays} d`;
  if (existingId) {
    await db
      .update(missionPlans)
      .set({
        name,
        destination: input.destination,
        durationDays: input.durationDays,
        activityLevel: input.activityLevel,
        workload: input.workload,
        evaRequired: input.evaRequired,
        crewScope: input.crewScope,
        status: "draft",
      })
      .where(eq(missionPlans.id, existingId));
    const updated = await getMission(existingId);
    if (updated) return updated;
  }
  const id = newId("msn");
  await db.insert(missionPlans).values({
    id,
    name,
    destination: input.destination,
    durationDays: input.durationDays,
    activityLevel: input.activityLevel,
    workload: input.workload,
    evaRequired: input.evaRequired,
    status: "draft",
    crewScope: input.crewScope,
    createdAt: Date.now(),
  });
  const created = await getMission(id);
  if (!created) throw new Error("Mission draft could not be read back.");
  return created;
}

export async function applyMission(id: string): Promise<MissionSettings> {
  const db = await requireDb();
  await db
    .update(missionPlans)
    .set({ status: "archived" })
    .where(eq(missionPlans.status, "applied"));
  await db
    .update(missionPlans)
    .set({ status: "applied", appliedAt: Date.now() })
    .where(eq(missionPlans.id, id));
  const applied = await getMission(id);
  if (!applied) throw new Error("Mission not found.");
  return applied;
}

/* ------------------------------------------------------------ simulations */

type RunRowLike = typeof simulationRuns.$inferSelect;

export function mapRun(row: RunRowLike): SimulationRun {
  return {
    id: row.id,
    crewId: row.crewId,
    scenario: row.scenario as ScenarioKey,
    label: row.label,
    seed: row.seed,
    createdAt: isoRequired(row.createdAt),
    status: row.status as SimulationRun["status"],
    startDate: isoRequired(row.startDate),
    dayCount: row.dayCount,
    assumptions: parseJson<string[]>(row.assumptionsJson, []),
    preview: parseJson<ScenarioPreviewRow[]>(row.previewJson, []),
    ruleSetVersion: row.ruleSetVersion,
  };
}

export async function createRun(input: {
  crewId: string;
  scenario: ScenarioKey;
  label: string;
  seed: number;
  startDate: string;
  dayCount: number;
  assumptions: string[];
  preview: ScenarioPreviewRow[];
  ruleSetVersion: string;
}): Promise<SimulationRun> {
  const db = await requireDb();
  const id = newId("run");
  await db.insert(simulationRuns).values({
    id,
    crewId: input.crewId,
    scenario: input.scenario,
    label: input.label,
    seed: input.seed,
    status: "generated",
    startDate: new Date(input.startDate).getTime(),
    dayCount: input.dayCount,
    assumptionsJson: JSON.stringify(input.assumptions),
    previewJson: JSON.stringify(input.preview),
    ruleSetVersion: input.ruleSetVersion,
    createdAt: Date.now(),
  });
  const run = await getRun(id);
  if (!run) throw new Error("Simulation run could not be read back.");
  return run;
}

export async function getRun(id: string): Promise<SimulationRun | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.id, id))
    .limit(1);
  return rows[0] ? mapRun(rows[0]) : null;
}

export async function listRuns(crewId?: string): Promise<SimulationRun[]> {
  const db = await requireDb();
  const rows = crewId
    ? await db
        .select()
        .from(simulationRuns)
        .where(eq(simulationRuns.crewId, crewId))
        .orderBy(desc(simulationRuns.createdAt))
    : await db
        .select()
        .from(simulationRuns)
        .orderBy(desc(simulationRuns.createdAt));
  return rows.map(mapRun);
}

export async function setRunStatus(
  id: string,
  status: SimulationRun["status"],
): Promise<void> {
  const db = await requireDb();
  await db
    .update(simulationRuns)
    .set({ status })
    .where(eq(simulationRuns.id, id));
}

export async function updateRun(
  id: string,
  patch: {
    label?: string;
    assumptionsJson?: string;
    previewJson?: string;
    startDate?: Date;
    dayCount?: number;
  },
): Promise<void> {
  const db = await requireDb();
  await db.update(simulationRuns).set(toMs(patch)).where(eq(simulationRuns.id, id));
}

export async function deleteRunObservations(runId: string): Promise<void> {
  const db = await requireDb();
  await db.delete(observations).where(eq(observations.streamId, runId));
}

/* ------------------------------------------------------------------- cases */

type CaseRowLike = typeof cases.$inferSelect;

export function mapCase(
  row: CaseRowLike,
  extras?: { crewName?: string; eventCount?: number; handoverIds?: string[] },
): CaseRecord {
  return {
    id: row.id,
    crewId: row.crewId,
    crewName: extras?.crewName ?? "",
    domain: row.domain as CaseRecord["domain"],
    domainLabel: row.domain,
    title: row.title,
    status: row.status as CaseStatus,
    currentCategory: row.currentCategory as CaseRecord["currentCategory"],
    openedAt: isoRequired(row.openedAt),
    updatedAt: isoRequired(row.updatedAt),
    archivedAt: iso(row.archivedAt),
    archiveReason: row.archiveReason ?? null,
    streamId: row.streamId ?? null,
    snapshot: parseJson<DomainAssessment | null>(row.snapshotJson, null),
    ruleSetVersion: row.ruleSetVersion,
    eventCount: extras?.eventCount ?? 0,
    acknowledgedAt: iso(row.acknowledgedAt),
    handoverIds: extras?.handoverIds ?? [],
  };
}

export async function listCases(params?: {
  crewId?: string;
  includeArchived?: boolean;
}): Promise<CaseRecord[]> {
  const db = await requireDb();
  const filters = [];
  if (params?.crewId) filters.push(eq(cases.crewId, params.crewId));
  if (!params?.includeArchived)
    filters.push(sql`${cases.status} <> 'archived'`);
  const rows = filters.length
    ? await db
        .select()
        .from(cases)
        .where(and(...filters))
        .orderBy(desc(cases.openedAt))
    : await db.select().from(cases).orderBy(desc(cases.openedAt));
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const eventRows = await db
    .select({ caseId: caseEvents.caseId, id: caseEvents.id })
    .from(caseEvents)
    .where(inArray(caseEvents.caseId, ids));
  const counts = new Map<string, number>();
  eventRows.forEach((row) =>
    counts.set(row.caseId, (counts.get(row.caseId) ?? 0) + 1),
  );
  const handoverRows = await db
    .select({ id: handovers.id, caseId: handovers.caseId })
    .from(handovers)
    .where(inArray(handovers.caseId, ids));
  const handoversByCase = new Map<string, string[]>();
  handoverRows.forEach((row) => {
    if (!row.caseId) return;
    handoversByCase.set(row.caseId, [
      ...(handoversByCase.get(row.caseId) ?? []),
      row.id,
    ]);
  });
  const crew = await listCrew(true);
  const nameById = new Map(
    crew.map((member) => [member.id, member.displayName]),
  );
  return rows.map((row) =>
    mapCase(row, {
      crewName: nameById.get(row.crewId) ?? row.crewId,
      eventCount: counts.get(row.id) ?? 0,
      handoverIds: handoversByCase.get(row.id) ?? [],
    }),
  );
}

export async function getCaseRow(id: string): Promise<CaseRecord | null> {
  const db = await requireDb();
  const rows = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!rows[0]) return null;
  const events = await db
    .select()
    .from(caseEvents)
    .where(eq(caseEvents.caseId, id));
  const member = await getCrew(rows[0].crewId);
  const handoverRows = await db
    .select({ id: handovers.id })
    .from(handovers)
    .where(eq(handovers.caseId, id));
  return mapCase(rows[0], {
    crewName: member?.displayName ?? rows[0].crewId,
    eventCount: events.length,
    handoverIds: handoverRows.map((row) => row.id),
  });
}

export async function findOpenCase(
  crewId: string,
  domain: string,
  streamId: string | null,
): Promise<CaseRecord | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(cases)
    .where(
      and(
        eq(cases.crewId, crewId),
        eq(cases.domain, domain),
        streamId ? eq(cases.streamId, streamId) : isNull(cases.streamId),
        sql`${cases.status} <> 'archived'`,
      ),
    )
    .limit(1);
  return rows[0] ? mapCase(rows[0]) : null;
}

export async function insertCase(input: {
  crewId: string;
  domain: string;
  title: string;
  currentCategory: string;
  streamId: string | null;
  snapshotJson: string;
  ruleSetVersion: string;
}): Promise<string> {
  const db = await requireDb();
  const id = newId("case");
  await db.insert(cases).values({
    id,
    crewId: input.crewId,
    domain: input.domain,
    title: input.title,
    status: "open",
    currentCategory: input.currentCategory,
    openedAt: Date.now(),
    updatedAt: Date.now(),
    streamId: input.streamId,
    snapshotJson: input.snapshotJson,
    ruleSetVersion: input.ruleSetVersion,
  });
  return id;
}

export async function updateCase(
  id: string,
  patch: {
    currentCategory?: string;
    status?: CaseStatus;
    snapshotJson?: string;
    archivedAt?: Date | null;
    archiveReason?: string | null;
    acknowledgedAt?: Date | null;
    title?: string;
  },
): Promise<void> {
  const db = await requireDb();
  await db.update(cases).set(toMs(patch)).where(eq(cases.id, id));
}

export async function addCaseEvent(input: {
  caseId: string;
  kind: CaseEventKind;
  title: string;
  body: string;
  actor?: CaseEvent["actor"];
  occurredAt?: string;
  data?: Record<string, unknown> | null;
  dedupeKey?: string | null;
}): Promise<{ inserted: boolean; id: string }> {
  const db = await requireDb();
  if (input.dedupeKey) {
    const existing = await db
      .select({ id: caseEvents.id })
      .from(caseEvents)
      .where(eq(caseEvents.dedupeKey, input.dedupeKey))
      .limit(1);
    if (existing[0]) return { inserted: false, id: existing[0].id };
  }
  const id = newId("evt");
  try {
    await db.insert(caseEvents).values({
      id,
      caseId: input.caseId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      occurredAt: new Date(input.occurredAt ?? Date.now()).getTime(),
      actor: input.actor ?? "system",
      dataJson: input.data ? JSON.stringify(input.data) : null,
      dedupeKey: input.dedupeKey ?? null,
    });
    return { inserted: true, id };
  } catch (error) {
    if (input.dedupeKey) {
      const existing = await db
        .select({ id: caseEvents.id })
        .from(caseEvents)
        .where(eq(caseEvents.dedupeKey, input.dedupeKey))
        .limit(1);
      if (existing[0]) return { inserted: false, id: existing[0].id };
    }
    throw error;
  }
}

export async function listCaseEvents(caseId: string): Promise<CaseEvent[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(caseEvents)
    .where(eq(caseEvents.caseId, caseId))
    .orderBy(asc(caseEvents.occurredAt));
  return rows.map((row) => ({
    id: row.id,
    caseId: row.caseId,
    kind: row.kind as CaseEventKind,
    title: row.title,
    body: row.body,
    occurredAt: isoRequired(row.occurredAt),
    actor: row.actor as CaseEvent["actor"],
    data: parseJson<Record<string, unknown> | null>(row.dataJson, null),
  }));
}

export async function listOpenCaseIdsByDomain(
  crewId: string,
): Promise<Map<string, string>> {
  const rows = await listCases({ crewId });
  const map = new Map<string, string>();
  rows.forEach((row) => {
    if (row.status !== "archived" && !map.has(row.domain))
      map.set(row.domain, row.id);
  });
  return map;
}

/* ----------------------------------------------------------- guided checks */

type CheckRowLike = typeof guidedChecks.$inferSelect;

export function mapCheck(row: CheckRowLike): GuidedCheck {
  return {
    id: row.id,
    crewId: row.crewId,
    caseId: row.caseId ?? null,
    domain: row.domain as GuidedCheck["domain"],
    metric: row.metric as MetricKey,
    prompt: row.prompt,
    reason: row.reason,
    ruleIds: parseJson<string[]>(row.ruleIdsJson, []),
    status: row.status as GuidedCheck["status"],
    createdAt: isoRequired(row.createdAt),
    completedAt: iso(row.completedAt),
    unableReason: row.unableReason ?? null,
    observationId: row.observationId ?? null,
    streamId: row.streamId ?? null,
    urgency: row.urgency as GuidedCheck["urgency"],
  };
}

export async function createCheck(input: {
  crewId: string;
  caseId: string | null;
  domain: string;
  metric: string;
  prompt: string;
  reason: string;
  ruleIds: string[];
  streamId: string | null;
  urgency?: "routine" | "priority";
}): Promise<GuidedCheck> {
  const db = await requireDb();
  const id = newId("chk");
  await db.insert(guidedChecks).values({
    id,
    crewId: input.crewId,
    caseId: input.caseId,
    domain: input.domain,
    metric: input.metric,
    prompt: input.prompt,
    reason: input.reason,
    ruleIdsJson: JSON.stringify(input.ruleIds),
    status: "open",
    createdAt: Date.now(),
    streamId: input.streamId,
    urgency: input.urgency ?? "routine",
  });
  const check = await getCheck(id);
  if (!check) throw new Error("Guided check could not be read back.");
  return check;
}

export async function getCheck(id: string): Promise<GuidedCheck | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(guidedChecks)
    .where(eq(guidedChecks.id, id))
    .limit(1);
  return rows[0] ? mapCheck(rows[0]) : null;
}

export async function listChecks(params: {
  crewId?: string;
  status?: string;
}): Promise<GuidedCheck[]> {
  const db = await requireDb();
  const filters = [];
  if (params.crewId) filters.push(eq(guidedChecks.crewId, params.crewId));
  if (params.status) filters.push(eq(guidedChecks.status, params.status));
  const rows = filters.length
    ? await db
        .select()
        .from(guidedChecks)
        .where(and(...filters))
        .orderBy(desc(guidedChecks.createdAt))
    : await db
        .select()
        .from(guidedChecks)
        .orderBy(desc(guidedChecks.createdAt));
  return rows.map(mapCheck);
}

export async function updateCheck(
  id: string,
  patch: {
    status?: GuidedCheck["status"];
    completedAt?: Date | null;
    unableReason?: string | null;
    observationId?: string | null;
  },
): Promise<void> {
  const db = await requireDb();
  await db.update(guidedChecks).set(toMs(patch)).where(eq(guidedChecks.id, id));
}

/* ---------------------------------------------------------------- handover */

type HandoverRowLike = typeof handovers.$inferSelect;

function mapHandoverBase(
  row: HandoverRowLike,
  crewName: string,
): Omit<Handover, "events" | "reply" | "replyReleased" | "nextLeg"> {
  return {
    id: row.id,
    caseId: row.caseId ?? null,
    crewId: row.crewId,
    crewName,
    domain: (row.domain as Handover["domain"]) ?? null,
    category: row.category as Handover["category"],
    status: row.status as HandoverStatus,
    version: row.version,
    parentId: row.parentId ?? null,
    createdAt: isoRequired(row.createdAt),
    updatedAt: isoRequired(row.updatedAt),
    queuedAt: iso(row.queuedAt),
    sentAt: iso(row.sentAt),
    deliveredAt: iso(row.deliveredAt),
    replyReceivedAt: iso(row.replyReceivedAt),
    oneWayDelayMinutes: row.oneWayDelayMinutes,
    groundReviewMinutes: row.groundReviewMinutes,
    snapshot: parseJson<HandoverSnapshot | null>(row.snapshotJson, null),
  };
}

export async function listHandovers(crewId?: string): Promise<Handover[]>;
export async function listHandovers(): Promise<Handover[]>;
export async function listHandovers(crewId?: string): Promise<Handover[]> {
  const db = await requireDb();
  const rows = crewId
    ? await db
        .select()
        .from(handovers)
        .where(eq(handovers.crewId, crewId))
        .orderBy(desc(handovers.createdAt))
    : await db.select().from(handovers).orderBy(desc(handovers.createdAt));
  const crew = await listCrew(true);
  const nameById = new Map(
    crew.map((member) => [member.id, member.displayName]),
  );
  return rows.map((row) => ({
    ...mapHandoverBase(row, nameById.get(row.crewId) ?? row.crewId),
    events: [],
    reply: null,
    replyReleased: row.status === "reply_received",
    nextLeg: null,
  }));
}

export async function getHandover(id: string): Promise<Handover | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(handovers)
    .where(eq(handovers.id, id))
    .limit(1);
  if (!rows[0]) return null;
  const row = rows[0];
  const member = await getCrew(row.crewId);
  const eventRows = await db
    .select()
    .from(handoverEvents)
    .where(eq(handoverEvents.handoverId, id))
    .orderBy(asc(handoverEvents.occurredAt));
  const replyRows = await db
    .select()
    .from(groundReplies)
    .where(eq(groundReplies.handoverId, id))
    .limit(1);
  const replyRow = replyRows[0];
  const reply: HandoverReply | null = replyRow
    ? {
        id: replyRow.id,
        author: replyRow.author,
        body: replyRow.body,
        createdAt: isoRequired(replyRow.createdAt),
        arrivesAt: isoRequired(replyRow.arrivesAt),
        status: replyRow.status as HandoverReply["status"],
        disclaimer:
          "Fictional ground review composed inside the simulation. It is not a real medical opinion and carries no clinical authority.",
      }
    : null;
  const events: HandoverEvent[] = eventRows.map((event) => ({
    id: event.id,
    handoverId: event.handoverId,
    status: event.status as HandoverStatus,
    occurredAt: isoRequired(event.occurredAt),
    note: event.note,
    actor: event.actor as HandoverEvent["actor"],
  }));
  const released = row.status === "reply_received";
  return {
    ...mapHandoverBase(row, member?.displayName ?? row.crewId),
    events,
    reply:
      reply && !released
        ? {
            ...reply,
            body: "",
            author: "Simulated ground medical team (fictional)",
          }
        : reply,
    replyReleased: released,
    nextLeg: null,
  };
}

export async function insertHandover(input: {
  crewId: string;
  caseId: string | null;
  domain: string | null;
  category: string;
  status: HandoverStatus;
  version: number;
  parentId: string | null;
  oneWayDelayMinutes: number;
  groundReviewMinutes: number;
  snapshotJson: string | null;
  queuedAt?: Date | null;
}): Promise<string> {
  const db = await requireDb();
  const id = newId("hnd");
  await db.insert(handovers).values({
    id,
    crewId: input.crewId,
    caseId: input.caseId,
    domain: input.domain,
    category: input.category,
    status: input.status,
    version: input.version,
    parentId: input.parentId,
    oneWayDelayMinutes: input.oneWayDelayMinutes,
    groundReviewMinutes: input.groundReviewMinutes,
    snapshotJson: input.snapshotJson,
    queuedAt: input.queuedAt ? input.queuedAt.getTime() : null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return id;
}

export async function updateHandover(
  id: string,
  patch: {
    status?: HandoverStatus;
    category?: Handover["category"];
    sentAt?: Date | null;
    deliveredAt?: Date | null;
    replyReceivedAt?: Date | null;
    queuedAt?: Date | null;
    snapshotJson?: string | null;
    version?: number;
  },
): Promise<void> {
  const db = await requireDb();
  await db.update(handovers).set(toMs(patch)).where(eq(handovers.id, id));
}

export async function addHandoverEvent(input: {
  handoverId: string;
  status: HandoverStatus;
  note: string;
  actor?: HandoverEvent["actor"];
  occurredAt?: string;
}): Promise<void> {
  const db = await requireDb();
  await db.insert(handoverEvents).values({
    id: newId("hev"),
    handoverId: input.handoverId,
    status: input.status,
    note: input.note,
    actor: input.actor ?? "system",
    occurredAt: new Date(input.occurredAt ?? Date.now()).getTime(),
  });
}

export async function upsertGroundReply(input: {
  handoverId: string;
  author: string;
  body: string;
  arrivesAt: string;
}): Promise<void> {
  const db = await requireDb();
  const existing = await db
    .select()
    .from(groundReplies)
    .where(eq(groundReplies.handoverId, input.handoverId))
    .limit(1);
  if (existing[0]) {
    await db
      .update(groundReplies)
      .set({
        body: input.body,
        author: input.author,
        arrivesAt: new Date(input.arrivesAt).getTime(),
        status: "in_transit",
      })
      .where(eq(groundReplies.id, existing[0].id));
    return;
  }
  await db.insert(groundReplies).values({
    id: newId("rep"),
    handoverId: input.handoverId,
    author: input.author,
    body: input.body,
    createdAt: Date.now(),
    arrivesAt: new Date(input.arrivesAt).getTime(),
    status: "in_transit",
  });
}

export async function markReplyReceived(handoverId: string): Promise<void> {
  const db = await requireDb();
  await db
    .update(groundReplies)
    .set({ status: "received" })
    .where(eq(groundReplies.handoverId, handoverId));
}

/* ------------------------------------------------------------------ import */

type ImportRowLike = typeof importBatches.$inferSelect;

export function mapImportBatch(row: ImportRowLike): ImportBatch {
  return {
    id: row.id,
    sourceTitle: row.sourceTitle,
    sourceRef: row.sourceRef,
    format: row.format as ImportBatch["format"],
    status: row.status as ImportBatch["status"],
    createdAt: isoRequired(row.createdAt),
    rowCount: row.rowCount,
    validCount: row.validCount,
    errorCount: row.errorCount,
    duplicateCount: row.duplicateCount,
    mapping: parseJson<ImportColumnMapping[]>(row.mappingJson, []),
    originalColumns: parseJson<string[]>(row.originalColumnsJson, []),
    recordPath: row.recordPath ?? null,
    errors: parseJson<ImportRowError[]>(row.errorsJson, []),
    preview: parseJson<ImportPreviewRow[]>(row.previewJson, []),
    committedCount: row.committedCount,
    allowPartial: row.allowPartial,
    notes: parseJson<string[]>(row.notesJson, []),
    checksum: row.checksum,
  };
}

export async function createImportBatch(input: {
  sourceTitle: string;
  sourceRef: string;
  format: "csv" | "json";
  status: ImportBatch["status"];
  rowCount: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  mapping: ImportColumnMapping[];
  originalColumns: string[];
  recordPath: string | null;
  errors: ImportRowError[];
  preview: ImportPreviewRow[];
  notes: string[];
  checksum: string;
  allowPartial: boolean;
  normalizedRows: unknown[];
}): Promise<ImportBatch> {
  const db = await requireDb();
  const id = newId("imp");
  await db.insert(importBatches).values({
    id,
    sourceTitle: input.sourceTitle,
    sourceRef: input.sourceRef,
    format: input.format,
    status: input.status,
    createdAt: Date.now(),
    rowCount: input.rowCount,
    validCount: input.validCount,
    errorCount: input.errorCount,
    duplicateCount: input.duplicateCount,
    mappingJson: JSON.stringify(input.mapping),
    originalColumnsJson: JSON.stringify(input.originalColumns),
    recordPath: input.recordPath,
    errorsJson: JSON.stringify(input.errors),
    previewJson: JSON.stringify(input.preview),
    notesJson: JSON.stringify(input.notes),
    normalizedJson: JSON.stringify(input.normalizedRows),
    checksum: input.checksum,
    allowPartial: input.allowPartial,
  });
  const batch = await getImportBatch(id);
  if (!batch) throw new Error("Import batch could not be read back.");
  return batch;
}

export async function getImportBatch(id: string): Promise<ImportBatch | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, id))
    .limit(1);
  return rows[0] ? mapImportBatch(rows[0]) : null;
}

export async function listImportBatches(): Promise<ImportBatch[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(importBatches)
    .orderBy(desc(importBatches.createdAt))
    .limit(30);
  return rows.map(mapImportBatch);
}

export async function getImportNormalizedRows(
  id: string,
): Promise<{ row: number; observation: ObservationInput; key: string }[]> {
  const db = await requireDb();
  const rows = await db
    .select({ normalizedJson: importBatches.normalizedJson })
    .from(importBatches)
    .where(eq(importBatches.id, id))
    .limit(1);
  if (!rows[0]) return [];
  return parseJson<
    { row: number; observation: ObservationInput; key: string }[]
  >(rows[0].normalizedJson, []);
}

export async function updateImportBatch(
  id: string,
  patch: {
    status?: ImportBatch["status"];
    committedCount?: number;
    allowPartial?: boolean;
    mappingJson?: string;
  },
): Promise<void> {
  const db = await requireDb();
  await db.update(importBatches).set(toMs(patch)).where(eq(importBatches.id, id));
}

/* -------------------------------------------------------------- demo reset */

export async function resetDemoData(): Promise<void> {
  const db = await requireDb();
  await db.delete(missionLogs);
  await db.delete(caseEvents);
  await db.delete(cases);
  await db.delete(guidedChecks);
  await db.delete(handoverEvents);
  await db.delete(groundReplies);
  await db.delete(handovers);
  await db.delete(observations);
  await db.delete(simulationRuns);
  await db.delete(importBatches);
  await db.delete(missionPlans);
  await db.delete(crewProfiles);
  await db.delete(appState);
}

export async function countObservations(): Promise<number> {
  const db = await requireDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(observations);
  return Number(rows[0]?.count ?? 0);
}

/* ------------------------------------------------------- portable backup */
/**
 * Reads every demonstration table for the SQLite-compatible backup. Account and session tables
 * (`users`, `owners`, `ownerSessions`) are deliberately excluded so a downloaded file never carries
 * credentials, passphrase hashes or live session tokens.
 */
export async function readBackupTables(): Promise<{ name: string; rows: Record<string, unknown>[] }[]> {
  const db = await requireDb();
  const selections = [
    { name: "crewProfiles", table: crewProfiles },
    { name: "observations", table: observations },
    { name: "missionPlans", table: missionPlans },
    { name: "appState", table: appState },
    { name: "simulationRuns", table: simulationRuns },
    { name: "cases", table: cases },
    { name: "caseEvents", table: caseEvents },
    { name: "guidedChecks", table: guidedChecks },
    { name: "handovers", table: handovers },
    { name: "handoverEvents", table: handoverEvents },
    { name: "groundReplies", table: groundReplies },
    { name: "importBatches", table: importBatches },
    { name: "missionLogs", table: missionLogs },
  ] as const;
  const output: { name: string; rows: Record<string, unknown>[] }[] = [];
  for (const entry of selections) {
    const rows = (await db.select().from(entry.table)) as Record<string, unknown>[];
    output.push({
      name: entry.name,
      rows: rows.map((row) => {
        const clean: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          clean[key] = value instanceof Date ? value.getTime() : value;
        }
        return clean;
      }),
    });
  }
  return output;
}
