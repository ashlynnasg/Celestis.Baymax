import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = sqliteTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).default(sql`(CAST(unixepoch('subsecond') * 1000 AS INTEGER))`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).default(sql`(CAST(unixepoch('subsecond') * 1000 AS INTEGER))`).$onUpdate(() => new Date()).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp_ms" }).default(sql`(CAST(unixepoch('subsecond') * 1000 AS INTEGER))`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Celestial Baymax — local SQLite storage for the supplied Manus application: table names,
 * column names and meanings are unchanged so docs/DATA_DICTIONARY.md still describes the model.
 * Domain timestamps remain epoch-milliseconds numbers; owner/account timestamps use SQLite
 * timestamp_ms mode so their session logic continues to receive JavaScript Date values.
 */

/* ------------------------------------------------------------------ crew */
export const crewProfiles = sqliteTable(
  "crewProfiles",
  {
    id: text("id").primaryKey(),
    displayName: text("displayName").notNull(),
    callSign: text("callSign").notNull(),
    role: text("role").notNull().default("Mission specialist"),
    age: integer("age").notNull().default(40),
    sexAtBirth: text("sexAtBirth").notNull().default("Unknown"),
    heightCm: integer("heightCm").notNull().default(175),
    weightKg: integer("weightKg").notNull().default(72),
    bloodType: text("bloodType").notNull().default("Unknown"),
    missionsJson: text("missionsJson").notNull(),
    historyJson: text("historyJson").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("createdAt").notNull(),
    updatedAt: integer("updatedAt").notNull(),
  },
  (table) => [index("crew_archived_idx").on(table.archived)],
);
export type CrewRow = typeof crewProfiles.$inferSelect;
export type InsertCrewRow = typeof crewProfiles.$inferInsert;

/* ---------------------------------------------------------- observations */
export const observations = sqliteTable(
  "observations",
  {
    id: text("id").primaryKey(),
    crewId: text("crewId").notNull(),
    metric: text("metric").notNull(),
    numericValue: real("numericValue"),
    textValue: text("textValue"),
    unit: text("unit").notNull().default(""),
    context: text("context"),
    observedAt: integer("observedAt").notNull(),
    sourceKind: text("sourceKind").notNull(),
    sourceLabel: text("sourceLabel").notNull(),
    streamId: text("streamId"),
    importBatchId: text("importBatchId"),
    note: text("note"),
    clientRequestId: text("clientRequestId"),
    createdAt: integer("createdAt").notNull(),
  },
  (table) => [
    index("obs_crew_metric_time_idx").on(table.crewId, table.metric, table.observedAt),
    index("obs_stream_idx").on(table.streamId),
    uniqueIndex("obs_client_request_unique").on(table.clientRequestId),
  ],
);
export type ObservationRow = typeof observations.$inferSelect;
export type InsertObservationRow = typeof observations.$inferInsert;

/* -------------------------------------------------------------- missions */
export const missionPlans = sqliteTable("missionPlans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  destination: text("destination").notNull(),
  durationDays: integer("durationDays").notNull(),
  activityLevel: text("activityLevel").notNull(),
  workload: text("workload").notNull(),
  evaRequired: integer("evaRequired", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull(),
  crewScope: text("crewScope").notNull().default("all_crew"),
  createdAt: integer("createdAt").notNull(),
  appliedAt: integer("appliedAt"),
});
export type MissionRow = typeof missionPlans.$inferSelect;

/* ------------------------------------------------------------- app state */
export const appState = sqliteTable("appState", {
  id: integer("id").primaryKey(),
  appliedMissionId: text("appliedMissionId"),
  draftMissionId: text("draftMissionId"),
  activeStreamId: text("activeStreamId"),
  activeStreamCrewId: text("activeStreamCrewId"),
  linkJson: text("linkJson").notNull(),
  seedVersion: text("seedVersion").notNull().default(""),
  updatedAt: integer("updatedAt").notNull(),
});
export type AppStateRow = typeof appState.$inferSelect;

/* ----------------------------------------------------------- simulations */
export const simulationRuns = sqliteTable(
  "simulationRuns",
  {
    id: text("id").primaryKey(),
    crewId: text("crewId").notNull(),
    scenario: text("scenario").notNull(),
    label: text("label").notNull(),
    seed: integer("seed").notNull(),
    status: text("status").notNull().default("generated"),
    startDate: integer("startDate").notNull(),
    dayCount: integer("dayCount").notNull().default(7),
    assumptionsJson: text("assumptionsJson").notNull(),
    previewJson: text("previewJson").notNull(),
    ruleSetVersion: text("ruleSetVersion").notNull(),
    createdAt: integer("createdAt").notNull(),
  },
  (table) => [index("runs_crew_idx").on(table.crewId)],
);
export type SimulationRunRow = typeof simulationRuns.$inferSelect;

/* ----------------------------------------------------------------- cases */
export const cases = sqliteTable(
  "cases",
  {
    id: text("id").primaryKey(),
    crewId: text("crewId").notNull(),
    domain: text("domain").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("open"),
    currentCategory: text("currentCategory").notNull(),
    openedAt: integer("openedAt").notNull(),
    updatedAt: integer("updatedAt").notNull(),
    archivedAt: integer("archivedAt"),
    archiveReason: text("archiveReason"),
    streamId: text("streamId"),
    snapshotJson: text("snapshotJson"),
    ruleSetVersion: text("ruleSetVersion").notNull(),
    acknowledgedAt: integer("acknowledgedAt"),
  },
  (table) => [index("cases_crew_idx").on(table.crewId, table.status)],
);
export type CaseRow = typeof cases.$inferSelect;

export const caseEvents = sqliteTable(
  "caseEvents",
  {
    id: text("id").primaryKey(),
    caseId: text("caseId").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    occurredAt: integer("occurredAt").notNull(),
    actor: text("actor").notNull().default("system"),
    dataJson: text("dataJson"),
    dedupeKey: text("dedupeKey"),
  },
  (table) => [
    index("events_case_idx").on(table.caseId, table.occurredAt),
    uniqueIndex("events_dedupe_unique").on(table.dedupeKey),
  ],
);
export type CaseEventRow = typeof caseEvents.$inferSelect;

/* --------------------------------------------------------- guided checks */
export const guidedChecks = sqliteTable(
  "guidedChecks",
  {
    id: text("id").primaryKey(),
    crewId: text("crewId").notNull(),
    caseId: text("caseId"),
    domain: text("domain").notNull(),
    metric: text("metric").notNull(),
    prompt: text("prompt").notNull(),
    reason: text("reason").notNull(),
    ruleIdsJson: text("ruleIdsJson").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: integer("createdAt").notNull(),
    completedAt: integer("completedAt"),
    unableReason: text("unableReason"),
    observationId: text("observationId"),
    streamId: text("streamId"),
    urgency: text("urgency").notNull().default("routine"),
  },
  (table) => [index("checks_crew_status_idx").on(table.crewId, table.status)],
);
export type GuidedCheckRow = typeof guidedChecks.$inferSelect;

/* ------------------------------------------------------------- handovers */
export const handovers = sqliteTable(
  "handovers",
  {
    id: text("id").primaryKey(),
    caseId: text("caseId"),
    crewId: text("crewId").notNull(),
    domain: text("domain"),
    category: text("category").notNull(),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    parentId: text("parentId"),
    createdAt: integer("createdAt").notNull(),
    updatedAt: integer("updatedAt").notNull(),
    queuedAt: integer("queuedAt"),
    sentAt: integer("sentAt"),
    deliveredAt: integer("deliveredAt"),
    replyReceivedAt: integer("replyReceivedAt"),
    oneWayDelayMinutes: integer("oneWayDelayMinutes").notNull().default(42),
    groundReviewMinutes: integer("groundReviewMinutes").notNull().default(90),
    snapshotJson: text("snapshotJson"),
  },
  (table) => [index("handovers_crew_idx").on(table.crewId, table.status)],
);
export type HandoverRow = typeof handovers.$inferSelect;

export const handoverEvents = sqliteTable(
  "handoverEvents",
  {
    id: text("id").primaryKey(),
    handoverId: text("handoverId").notNull(),
    status: text("status").notNull(),
    occurredAt: integer("occurredAt").notNull(),
    note: text("note").notNull(),
    actor: text("actor").notNull().default("system"),
  },
  (table) => [index("handover_events_idx").on(table.handoverId, table.occurredAt)],
);
export type HandoverEventRow = typeof handoverEvents.$inferSelect;

export const groundReplies = sqliteTable(
  "groundReplies",
  {
    id: text("id").primaryKey(),
    handoverId: text("handoverId").notNull(),
    author: text("author").notNull(),
    body: text("body").notNull(),
    createdAt: integer("createdAt").notNull(),
    arrivesAt: integer("arrivesAt").notNull(),
    status: text("status").notNull().default("in_transit"),
  },
  (table) => [index("replies_handover_idx").on(table.handoverId)],
);
export type GroundReplyRow = typeof groundReplies.$inferSelect;

/* ---------------------------------------------------------------- import */
export const importBatches = sqliteTable("importBatches", {
  id: text("id").primaryKey(),
  sourceTitle: text("sourceTitle").notNull(),
  sourceRef: text("sourceRef").notNull(),
  format: text("format").notNull(),
  status: text("status").notNull(),
  createdAt: integer("createdAt").notNull(),
  rowCount: integer("rowCount").notNull().default(0),
  validCount: integer("validCount").notNull().default(0),
  errorCount: integer("errorCount").notNull().default(0),
  duplicateCount: integer("duplicateCount").notNull().default(0),
  mappingJson: text("mappingJson").notNull(),
  originalColumnsJson: text("originalColumnsJson").notNull(),
  recordPath: text("recordPath"),
  errorsJson: text("errorsJson").notNull(),
  previewJson: text("previewJson").notNull(),
  committedCount: integer("committedCount").notNull().default(0),
  allowPartial: integer("allowPartial", { mode: "boolean" }).notNull().default(false),
  notesJson: text("notesJson").notNull(),
  normalizedJson: text("normalizedJson").notNull(),
  checksum: text("checksum").notNull(),
});
export type ImportBatchRow = typeof importBatches.$inferSelect;

/* --------------------------------------------------------- owner access */
export const owners = sqliteTable("owners", {
  id: text("id").primaryKey(),
  displayName: text("displayName").notNull().default("Owner"),
  salt: text("salt").notNull(),
  passphraseHash: text("passphraseHash").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  lastLoginAt: integer("lastLoginAt", { mode: "timestamp_ms" }),
});
export type OwnerRow = typeof owners.$inferSelect;

export const ownerSessions = sqliteTable(
  "ownerSessions",
  {
    id: text("id").primaryKey(),
    ownerId: text("ownerId").notNull(),
    tokenHash: text("tokenHash").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("lastSeenAt", { mode: "timestamp_ms" }),
    revokedAt: integer("revokedAt", { mode: "timestamp_ms" }),
  },
  (table) => [uniqueIndex("ownerSessions_token_idx").on(table.tokenHash)],
);
export type OwnerSessionRow = typeof ownerSessions.$inferSelect;

/** Additive evidence records; payloads are validated by missionLogInputSchema before persistence. */
export const missionLogs = sqliteTable(
  "missionLogs",
  {
    id: text("id").primaryKey(),
    crewId: text("crewId").notNull(),
    streamKey: text("streamKey").notNull(),
    missionId: text("missionId"),
    observedAt: text("observedAt").notNull(),
    fingerprint: text("fingerprint").notNull().unique(),
    recordJson: text("recordJson").notNull(),
  },
  (t) => [index("missionLogs_crew_stream").on(t.crewId, t.streamKey, t.observedAt)],
);
