import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { SQLITE_BACKUP_SCHEMA } from "./sqlite-schema";

// createRequire also works in the bundled ESM server and older Vitest runners.
const sqliteRequire = createRequire(import.meta.url);
let connection: DatabaseSync | undefined;
let orm: ReturnType<typeof makeOrm> | undefined;
let queue: Promise<void> = Promise.resolve();
const transactionContext = new AsyncLocalStorage<boolean>();

export function databasePath(): string {
  return resolve(process.env.BAYMAX_DB_PATH || "data/celestial-baymax.sqlite");
}

const AUTH_SCHEMA = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "openId" TEXT NOT NULL UNIQUE,
  "name" TEXT, "email" TEXT, "loginMethod" TEXT,
  "role" TEXT NOT NULL DEFAULT 'user',
  "createdAt" INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsecond') * 1000 AS INTEGER)),
  "updatedAt" INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsecond') * 1000 AS INTEGER)),
  "lastSignedIn" INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsecond') * 1000 AS INTEGER))
);
CREATE TABLE IF NOT EXISTS "owners" (
  "id" TEXT PRIMARY KEY,
  "displayName" TEXT NOT NULL DEFAULT 'Owner',
  "salt" TEXT NOT NULL, "passphraseHash" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL, "lastLoginAt" INTEGER
);
CREATE TABLE IF NOT EXISTS "ownerSessions" (
  "id" TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL, "expiresAt" INTEGER NOT NULL,
  "lastSeenAt" INTEGER, "revokedAt" INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS "ownerSessions_token_idx" ON "ownerSessions" ("tokenHash");
`;

function database(): DatabaseSync {
  if (!connection) {
    const file = databasePath();
    mkdirSync(dirname(file), { recursive: true });
    const { DatabaseSync: SQLite } = sqliteRequire("node:sqlite") as typeof import("node:sqlite");
    const opened = new SQLite(file);
    try {
      opened.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
      opened.exec(SQLITE_BACKUP_SCHEMA);
      opened.exec(AUTH_SCHEMA);
      connection = opened;
    } catch (error) {
      opened.close();
      throw error;
    }
  }
  return connection;
}

// Keep concurrent HTTP requests outside an in-flight async SQLite transaction.
async function serialized<T>(operation: () => T | Promise<T>): Promise<T> {
  if (transactionContext.getStore()) return operation();
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>((resolveQueue) => { release = resolveQueue; });
  await previous;
  try {
    return await transactionContext.run(true, operation);
  } finally {
    release();
  }
}

function makeOrm() {
  return drizzle(async (sql, parameters, method) => serialized(() => {
    const statement = database().prepare(sql);
    const values = parameters as SQLInputValue[];
    if (method === "run") {
      statement.run(...values);
      return { rows: [] };
    }
    // Preserve SQL column order, including duplicate names in joined projections.
    statement.setReturnArrays(true);
    if (method === "get") {
      return { rows: statement.get(...values) as unknown as unknown[] };
    }
    return { rows: statement.all(...values) as unknown as unknown[][] };
  }));
}

export function getSqliteOrm() {
  database();
  return orm ??= makeOrm();
}

export async function sqliteTransaction<T>(operation: () => Promise<T>): Promise<T> {
  return serialized(async () => {
    const db = database();
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = await operation();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
}

export async function closeSqlite(): Promise<void> {
  await serialized(() => {
    connection?.close();
    connection = undefined;
    orm = undefined;
  });
}
