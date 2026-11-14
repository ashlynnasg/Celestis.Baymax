import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SQLITE_BACKUP_SCHEMA } from "./sqlite-schema";

/**
 * The backup is written with Node's built-in `node:sqlite`, so the downloaded artefact is a real
 * SQLite database (not JSON or CSV) that opens in DB Browser for SQLite, the `sqlite3` CLI, Drizzle
 * Studio or any other SQLite-compatible tool. If the runtime has no `node:sqlite`, callers fall back
 * to the SQL text dump, which recreates the same database when executed.
 */
export type BackupTable = {
  name: string;
  rows: Record<string, unknown>[];
};

export type SqliteBackup = {
  bytes: Uint8Array;
  counts: Record<string, number>;
  totalRows: number;
};

const sqliteRequire = createRequire(import.meta.url);

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { run: (...values: unknown[]) => unknown };
  close(): void;
};

function normalize(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "bigint") return Number(value);
  return JSON.stringify(value);
}

export function isSqliteAvailable(): boolean {
  try {
    // Resolved lazily so a runtime without the module never crashes at import time.
    sqliteRequire("node:sqlite");
    return true;
  } catch {
    return false;
  }
}

export function buildSqliteBackup(tables: BackupTable[], generatedAt: string): SqliteBackup {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync } = sqliteRequire("node:sqlite") as {
    DatabaseSync: new (path: string) => SqliteDatabase;
  };
  const directory = mkdtempSync(join(tmpdir(), "celestial-baymax-backup-"));
  const file = join(directory, "celestial-baymax.sqlite");
  const db = new DatabaseSync(file);
  const counts: Record<string, number> = {};
  let closed = false;
  try {
    db.exec("PRAGMA journal_mode = DELETE;");
    db.exec("PRAGMA synchronous = FULL;");
    db.exec(SQLITE_BACKUP_SCHEMA);
    db.exec(
      'CREATE TABLE IF NOT EXISTS "_backup_meta" (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
    );
    const meta = db.prepare('INSERT INTO "_backup_meta" (key, value) VALUES (?, ?)');
    const metaRows: [string, string][] = [
      ["app", "Celestial Baymax"],
      ["format", "sqlite"],
      ["generatedAt", generatedAt],
      ["schema", "Celestial Baymax Portable Edition (tables and columns from the supplied Drizzle schema)"],
      ["timestamps", "UTC epoch milliseconds"],
      ["contains", "fictional demonstration records only; no accounts, passphrases or session tokens"],
      ["note", "Open read-only where possible. WAL/SHM files are not required for this export."],
    ];
    for (const [key, value] of metaRows) meta.run(key, value);

    for (const table of tables) {
      counts[table.name] = table.rows.length;
      if (table.rows.length === 0) continue;
      const columns = Object.keys(table.rows[0]);
      const placeholders = columns.map(() => "?").join(", ");
      const insert = db.prepare(
        `INSERT INTO "${table.name}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${placeholders})`,
      );
      db.exec("BEGIN");
      try {
        for (const row of table.rows) {
          insert.run(...columns.map((column) => normalize(row[column])));
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
    db.close();
    closed = true;
    const bytes = new Uint8Array(readFileSync(file));
    const totalRows = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return { bytes, counts, totalRows };
  } finally {
    if (!closed) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

/** SQL text dump fallback: executing it in `sqlite3` recreates the identical database. */
export function buildSqlDump(tables: BackupTable[], generatedAt: string): string {
  const lines: string[] = [
    "-- Celestial Baymax SQLite-compatible backup (SQL dump)",
    `-- Generated ${generatedAt}`,
    "-- Apply with: sqlite3 celestial-baymax.sqlite < celestial-baymax.sql",
    "-- Fictional demonstration records only. No accounts, passphrases or session tokens.",
    "PRAGMA foreign_keys = OFF;",
    SQLITE_BACKUP_SCHEMA,
  ];
  for (const table of tables) {
    for (const row of table.rows) {
      const columns = Object.keys(row);
      const values = columns.map((column) => {
        const value = normalize(row[column]);
        if (value === null) return "NULL";
        if (typeof value === "number") return String(value);
        return `'${value.replace(/'/g, "''")}'`;
      });
      lines.push(
        `INSERT INTO "${table.name}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${values.join(", ")});`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
