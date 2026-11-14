// A file avoids PowerShell 5.1's legacy quoting of JavaScript passed with node -e.
try {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (!((major === 22 && minor >= 16) || major >= 24)) process.exit(1);
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  const statement = db.prepare("SELECT 1");
  if (typeof statement.setReturnArrays !== "function") process.exit(1);
  statement.setReturnArrays(true);
  if (statement.get()[0] !== 1) process.exit(1);
  db.close();
} catch { process.exit(1); }
