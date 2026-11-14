/**
 * SQLite DDL for the portable backup file.
 *
 * Generated from the original Celestial Baymax SQLite bootstrap so an exported `.sqlite` file can be
 * opened by any SQLite-compatible tool and keeps the same table and column names as the source
 * application. Account/authentication tables (`users`, `owners`, `ownerSessions`) are intentionally
 * excluded: a backup carries demonstration health records, never credentials.
 */
export const SQLITE_BACKUP_SCHEMA = `
-- Celestial Baymax SQLite Portable Edition
-- Generated from the supplied Manus Drizzle schema. Timestamps are UTC epoch milliseconds.
-- Safe for first-time setup and repeated launches; never drops tables or user data.

CREATE TABLE IF NOT EXISTS "crewProfiles" (
  "id" TEXT PRIMARY KEY,
  "displayName" TEXT NOT NULL,
  "callSign" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'Mission specialist',
  "age" INTEGER NOT NULL DEFAULT 40,
  "sexAtBirth" TEXT NOT NULL DEFAULT 'Unknown',
  "heightCm" INTEGER NOT NULL DEFAULT 175,
  "weightKg" INTEGER NOT NULL DEFAULT 72,
  "bloodType" TEXT NOT NULL DEFAULT 'Unknown',
  "missionsJson" TEXT NOT NULL,
  "historyJson" TEXT NOT NULL,
  "archived" INTEGER NOT NULL DEFAULT 0,
  "createdAt" INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000),
  "updatedAt" INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000)
);

CREATE INDEX IF NOT EXISTS "crew_archived_idx" ON "crewProfiles" ("archived");

CREATE TRIGGER IF NOT EXISTS "crewProfiles_touch_updatedAt"
AFTER UPDATE ON "crewProfiles"
FOR EACH ROW WHEN NEW."updatedAt" = OLD."updatedAt"
BEGIN
  UPDATE "crewProfiles" SET "updatedAt" = (unixepoch('subsecond') * 1000) WHERE "id" = NEW."id";
END;

CREATE TABLE IF NOT EXISTS "observations" (
  "id" TEXT PRIMARY KEY,
  "crewId" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "numericValue" REAL,
  "textValue" TEXT,
  "unit" TEXT NOT NULL DEFAULT '',
  "context" TEXT,
  "observedAt" INTEGER NOT NULL,
  "sourceKind" TEXT NOT NULL,
  "sourceLabel" TEXT NOT NULL,
  "streamId" TEXT,
  "importBatchId" TEXT,
  "note" TEXT,
  "clientRequestId" TEXT,
  "createdAt" INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000)
);

CREATE INDEX IF NOT EXISTS "obs_crew_metric_time_idx" ON "observations" ("crewId", "metric", "observedAt");

CREATE INDEX IF NOT EXISTS "obs_stream_idx" ON "observations" ("streamId");

CREATE UNIQUE INDEX IF NOT EXISTS "obs_client_request_unique" ON "observations" ("clientRequestId");

CREATE TABLE IF NOT EXISTS "missionPlans" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "activityLevel" TEXT NOT NULL,
  "workload" TEXT NOT NULL,
  "evaRequired" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "crewScope" TEXT NOT NULL DEFAULT 'all_crew',
  "createdAt" INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000),
  "appliedAt" INTEGER
);

CREATE TABLE IF NOT EXISTS "appState" (
  "id" INTEGER PRIMARY KEY,
  "appliedMissionId" TEXT,
  "draftMissionId" TEXT,
  "activeStreamId" TEXT,
  "activeStreamCrewId" TEXT,
  "linkJson" TEXT NOT NULL,
  "seedVersion" TEXT NOT NULL DEFAULT '',
  "updatedAt" INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000)
);

CREATE TRIGGER IF NOT EXISTS "appState_touch_updatedAt"
AFTER UPDATE ON "appState"
FOR EACH ROW WHEN NEW."updatedAt" = OLD."updatedAt"
BEGIN
  UPDATE "appState" SET "updatedAt" = (unixepoch('subsecond') * 1000) WHERE "id" = NEW."id";
END;

CREATE TABLE IF NOT EXISTS "simulationRuns" (
  "id" TEXT PRIMARY KEY,
  "crewId" TEXT NOT NULL,
  "scenario" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "seed" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'generated',
  "startDate" INTEGER NOT NULL,
  "dayCount" INTEGER NOT NULL DEFAULT 7,
  "assumptionsJson" TEXT NOT NULL,
  "previewJson" TEXT NOT NULL,
  "ruleSetVersion" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000)
);

CREATE INDEX IF NOT EXISTS "runs_crew_idx" ON "simulationRuns" ("crewId");

CREATE TABLE IF NOT EXISTS "cases" (
  "id" TEXT PRIMARY KEY,
  "crewId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "currentCategory" TEXT NOT NULL,
  "openedAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000),
  "archivedAt" INTEGER,
  "archiveReason" TEXT,
  "streamId" TEXT,
  "snapshotJson" TEXT,
  "ruleSetVersion" TEXT NOT NULL,
  "acknowledgedAt" INTEGER
);

CREATE INDEX IF NOT EXISTS "cases_crew_idx" ON "cases" ("crewId", "status");

CREATE TRIGGER IF NOT EXISTS "cases_touch_updatedAt"
AFTER UPDATE ON "cases"
FOR EACH ROW WHEN NEW."updatedAt" = OLD."updatedAt"
BEGIN
  UPDATE "cases" SET "updatedAt" = (unixepoch('subsecond') * 1000) WHERE "id" = NEW."id";
END;

CREATE TABLE IF NOT EXISTS "caseEvents" (
  "id" TEXT PRIMARY KEY,
  "caseId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "occurredAt" INTEGER NOT NULL,
  "actor" TEXT NOT NULL DEFAULT 'system',
  "dataJson" TEXT,
  "dedupeKey" TEXT
);

CREATE INDEX IF NOT EXISTS "events_case_idx" ON "caseEvents" ("caseId", "occurredAt");

CREATE UNIQUE INDEX IF NOT EXISTS "events_dedupe_unique" ON "caseEvents" ("dedupeKey");

CREATE TABLE IF NOT EXISTS "guidedChecks" (
  "id" TEXT PRIMARY KEY,
  "crewId" TEXT NOT NULL,
  "caseId" TEXT,
  "domain" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "ruleIdsJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" INTEGER NOT NULL,
  "completedAt" INTEGER,
  "unableReason" TEXT,
  "observationId" TEXT,
  "streamId" TEXT,
  "urgency" TEXT NOT NULL DEFAULT 'routine'
);

CREATE INDEX IF NOT EXISTS "checks_crew_status_idx" ON "guidedChecks" ("crewId", "status");

CREATE TABLE IF NOT EXISTS "handovers" (
  "id" TEXT PRIMARY KEY,
  "caseId" TEXT,
  "crewId" TEXT NOT NULL,
  "domain" TEXT,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "version" INTEGER NOT NULL DEFAULT 1,
  "parentId" TEXT,
  "createdAt" INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000),
  "updatedAt" INTEGER NOT NULL DEFAULT (unixepoch('subsecond') * 1000),
  "queuedAt" INTEGER,
  "sentAt" INTEGER,
  "deliveredAt" INTEGER,
  "replyReceivedAt" INTEGER,
  "oneWayDelayMinutes" INTEGER NOT NULL DEFAULT 42,
  "groundReviewMinutes" INTEGER NOT NULL DEFAULT 90,
  "snapshotJson" TEXT
);

CREATE INDEX IF NOT EXISTS "handovers_crew_idx" ON "handovers" ("crewId", "status");

CREATE TRIGGER IF NOT EXISTS "handovers_touch_updatedAt"
AFTER UPDATE ON "handovers"
FOR EACH ROW WHEN NEW."updatedAt" = OLD."updatedAt"
BEGIN
  UPDATE "handovers" SET "updatedAt" = (unixepoch('subsecond') * 1000) WHERE "id" = NEW."id";
END;

CREATE TABLE IF NOT EXISTS "handoverEvents" (
  "id" TEXT PRIMARY KEY,
  "handoverId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "occurredAt" INTEGER NOT NULL,
  "note" TEXT NOT NULL,
  "actor" TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS "handover_events_idx" ON "handoverEvents" ("handoverId", "occurredAt");

CREATE TABLE IF NOT EXISTS "groundReplies" (
  "id" TEXT PRIMARY KEY,
  "handoverId" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL,
  "arrivesAt" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'in_transit'
);

CREATE INDEX IF NOT EXISTS "replies_handover_idx" ON "groundReplies" ("handoverId");

CREATE TABLE IF NOT EXISTS "importBatches" (
  "id" TEXT PRIMARY KEY,
  "sourceTitle" TEXT NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "validCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "mappingJson" TEXT NOT NULL,
  "originalColumnsJson" TEXT NOT NULL,
  "recordPath" TEXT,
  "errorsJson" TEXT NOT NULL,
  "previewJson" TEXT NOT NULL,
  "committedCount" INTEGER NOT NULL DEFAULT 0,
  "allowPartial" INTEGER NOT NULL DEFAULT 0,
  "notesJson" TEXT NOT NULL,
  "normalizedJson" TEXT NOT NULL,
  "checksum" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS missionLogs (
 id TEXT PRIMARY KEY, crewId TEXT NOT NULL, streamKey TEXT NOT NULL, missionId TEXT,
 observedAt TEXT NOT NULL, fingerprint TEXT NOT NULL UNIQUE, recordJson TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS missionLogs_crew_stream ON missionLogs(crewId, streamKey, observedAt);
`;
