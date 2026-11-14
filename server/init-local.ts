import { ensureSeeded } from "./seed";
import { syncAllCrewCases } from "./assessment";
import { closeSqlite, databasePath } from "./sqlite";

try {
  const result = await ensureSeeded();
  await syncAllCrewCases();
  console.log(result.seeded ? "Fictional demonstration data created." : "Existing data preserved.");
  if (result.caution) console.log(result.caution);
  console.log(`SQLite database: ${databasePath()}`);
} catch (error) {
  console.error("Database setup failed:", error);
  process.exitCode = 1;
} finally {
  await closeSqlite();
}
