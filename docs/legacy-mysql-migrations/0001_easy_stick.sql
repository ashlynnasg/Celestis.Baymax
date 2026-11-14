CREATE TABLE `appState` (
	`id` int NOT NULL,
	`appliedMissionId` varchar(64),
	`draftMissionId` varchar(64),
	`activeStreamId` varchar(64),
	`activeStreamCrewId` varchar(64),
	`linkJson` text NOT NULL,
	`seedVersion` varchar(64) NOT NULL DEFAULT '',
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `appState_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `caseEvents` (
	`id` varchar(64) NOT NULL,
	`caseId` varchar(64) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` mediumtext NOT NULL,
	`occurredAt` bigint NOT NULL,
	`actor` varchar(64) NOT NULL DEFAULT 'system',
	`dataJson` mediumtext,
	`dedupeKey` varchar(191),
	CONSTRAINT `caseEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_dedupe_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE TABLE `cases` (
	`id` varchar(64) NOT NULL,
	`crewId` varchar(64) NOT NULL,
	`domain` varchar(48) NOT NULL,
	`title` varchar(200) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`currentCategory` varchar(24) NOT NULL,
	`openedAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	`archivedAt` bigint,
	`archiveReason` text,
	`streamId` varchar(64),
	`snapshotJson` mediumtext,
	`ruleSetVersion` varchar(64) NOT NULL,
	`acknowledgedAt` bigint,
	CONSTRAINT `cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crewProfiles` (
	`id` varchar(64) NOT NULL,
	`displayName` varchar(120) NOT NULL,
	`callSign` varchar(80) NOT NULL,
	`role` varchar(120) NOT NULL DEFAULT 'Mission specialist',
	`age` int NOT NULL DEFAULT 40,
	`sexAtBirth` varchar(40) NOT NULL DEFAULT 'Unknown',
	`heightCm` int NOT NULL DEFAULT 175,
	`weightKg` int NOT NULL DEFAULT 72,
	`bloodType` varchar(16) NOT NULL DEFAULT 'Unknown',
	`missionsJson` text NOT NULL,
	`historyJson` mediumtext NOT NULL,
	`archived` boolean NOT NULL DEFAULT false,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `crewProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `groundReplies` (
	`id` varchar(64) NOT NULL,
	`handoverId` varchar(64) NOT NULL,
	`author` varchar(120) NOT NULL,
	`body` mediumtext NOT NULL,
	`createdAt` bigint NOT NULL,
	`arrivesAt` bigint NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'in_transit',
	CONSTRAINT `groundReplies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guidedChecks` (
	`id` varchar(64) NOT NULL,
	`crewId` varchar(64) NOT NULL,
	`caseId` varchar(64),
	`domain` varchar(48) NOT NULL,
	`metric` varchar(48) NOT NULL,
	`prompt` text NOT NULL,
	`reason` text NOT NULL,
	`ruleIdsJson` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`createdAt` bigint NOT NULL,
	`completedAt` bigint,
	`unableReason` text,
	`observationId` varchar(64),
	`streamId` varchar(64),
	`urgency` varchar(24) NOT NULL DEFAULT 'routine',
	CONSTRAINT `guidedChecks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `handoverEvents` (
	`id` varchar(64) NOT NULL,
	`handoverId` varchar(64) NOT NULL,
	`status` varchar(32) NOT NULL,
	`occurredAt` bigint NOT NULL,
	`note` text NOT NULL,
	`actor` varchar(64) NOT NULL DEFAULT 'system',
	CONSTRAINT `handoverEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `handovers` (
	`id` varchar(64) NOT NULL,
	`caseId` varchar(64),
	`crewId` varchar(64) NOT NULL,
	`domain` varchar(48),
	`category` varchar(24) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'draft',
	`version` int NOT NULL DEFAULT 1,
	`parentId` varchar(64),
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	`queuedAt` bigint,
	`sentAt` bigint,
	`deliveredAt` bigint,
	`replyReceivedAt` bigint,
	`oneWayDelayMinutes` int NOT NULL DEFAULT 42,
	`groundReviewMinutes` int NOT NULL DEFAULT 90,
	`snapshotJson` mediumtext,
	CONSTRAINT `handovers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `importBatches` (
	`id` varchar(64) NOT NULL,
	`sourceTitle` varchar(200) NOT NULL,
	`sourceRef` varchar(240) NOT NULL,
	`format` varchar(24) NOT NULL,
	`status` varchar(32) NOT NULL,
	`createdAt` bigint NOT NULL,
	`rowCount` int NOT NULL DEFAULT 0,
	`validCount` int NOT NULL DEFAULT 0,
	`errorCount` int NOT NULL DEFAULT 0,
	`duplicateCount` int NOT NULL DEFAULT 0,
	`mappingJson` text NOT NULL,
	`originalColumnsJson` text NOT NULL,
	`recordPath` varchar(240),
	`errorsJson` mediumtext NOT NULL,
	`previewJson` mediumtext NOT NULL,
	`committedCount` int NOT NULL DEFAULT 0,
	`allowPartial` boolean NOT NULL DEFAULT false,
	`notesJson` text NOT NULL,
	`normalizedJson` mediumtext NOT NULL,
	`checksum` varchar(128) NOT NULL,
	CONSTRAINT `importBatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `missionLogs` (
	`id` varchar(64) NOT NULL,
	`crewId` varchar(64) NOT NULL,
	`streamKey` varchar(64) NOT NULL,
	`missionId` varchar(64),
	`observedAt` varchar(40) NOT NULL,
	`fingerprint` varchar(128) NOT NULL,
	`recordJson` mediumtext NOT NULL,
	CONSTRAINT `missionLogs_id` PRIMARY KEY(`id`),
	CONSTRAINT `missionLogs_fingerprint_unique` UNIQUE(`fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `missionPlans` (
	`id` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`destination` varchar(64) NOT NULL,
	`durationDays` int NOT NULL,
	`activityLevel` varchar(64) NOT NULL,
	`workload` varchar(64) NOT NULL,
	`evaRequired` boolean NOT NULL DEFAULT false,
	`status` varchar(24) NOT NULL,
	`crewScope` varchar(32) NOT NULL DEFAULT 'all_crew',
	`createdAt` bigint NOT NULL,
	`appliedAt` bigint,
	CONSTRAINT `missionPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `observations` (
	`id` varchar(64) NOT NULL,
	`crewId` varchar(64) NOT NULL,
	`metric` varchar(48) NOT NULL,
	`numericValue` double,
	`textValue` text,
	`unit` varchar(24) NOT NULL DEFAULT '',
	`context` varchar(64),
	`observedAt` bigint NOT NULL,
	`sourceKind` varchar(24) NOT NULL,
	`sourceLabel` varchar(160) NOT NULL,
	`streamId` varchar(64),
	`importBatchId` varchar(64),
	`note` text,
	`clientRequestId` varchar(191),
	`createdAt` bigint NOT NULL,
	CONSTRAINT `observations_id` PRIMARY KEY(`id`),
	CONSTRAINT `obs_client_request_unique` UNIQUE(`clientRequestId`)
);
--> statement-breakpoint
CREATE TABLE `ownerSessions` (
	`id` varchar(64) NOT NULL,
	`ownerId` varchar(64) NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`createdAt` datetime(3) NOT NULL,
	`expiresAt` datetime(3) NOT NULL,
	`lastSeenAt` datetime(3),
	`revokedAt` datetime(3),
	CONSTRAINT `ownerSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ownerSessions_token_idx` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `owners` (
	`id` varchar(64) NOT NULL,
	`displayName` varchar(120) NOT NULL DEFAULT 'Owner',
	`salt` varchar(64) NOT NULL,
	`passphraseHash` varchar(191) NOT NULL,
	`createdAt` datetime(3) NOT NULL,
	`lastLoginAt` datetime(3),
	CONSTRAINT `owners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `simulationRuns` (
	`id` varchar(64) NOT NULL,
	`crewId` varchar(64) NOT NULL,
	`scenario` varchar(48) NOT NULL,
	`label` varchar(160) NOT NULL,
	`seed` int NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'generated',
	`startDate` bigint NOT NULL,
	`dayCount` int NOT NULL DEFAULT 7,
	`assumptionsJson` text NOT NULL,
	`previewJson` mediumtext NOT NULL,
	`ruleSetVersion` varchar(64) NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `simulationRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `events_case_idx` ON `caseEvents` (`caseId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `cases_crew_idx` ON `cases` (`crewId`,`status`);--> statement-breakpoint
CREATE INDEX `crew_archived_idx` ON `crewProfiles` (`archived`);--> statement-breakpoint
CREATE INDEX `replies_handover_idx` ON `groundReplies` (`handoverId`);--> statement-breakpoint
CREATE INDEX `checks_crew_status_idx` ON `guidedChecks` (`crewId`,`status`);--> statement-breakpoint
CREATE INDEX `handover_events_idx` ON `handoverEvents` (`handoverId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `handovers_crew_idx` ON `handovers` (`crewId`,`status`);--> statement-breakpoint
CREATE INDEX `missionLogs_crew_stream` ON `missionLogs` (`crewId`,`streamKey`,`observedAt`);--> statement-breakpoint
CREATE INDEX `obs_crew_metric_time_idx` ON `observations` (`crewId`,`metric`,`observedAt`);--> statement-breakpoint
CREATE INDEX `obs_stream_idx` ON `observations` (`streamId`);--> statement-breakpoint
CREATE INDEX `runs_crew_idx` ON `simulationRuns` (`crewId`);