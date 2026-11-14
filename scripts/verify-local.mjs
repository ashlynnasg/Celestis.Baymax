// Release smoke test. It uses a disposable copy and never touches the user's data folder.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { once } from "node:events";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const source = fileURLToPath(new URL("..", import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), "baymax release with spaces "));
let app;
let logs = "";
let token;
let assertions = 0;
const api = "http://127.0.0.1:3000";
const browser = "http://127.0.0.1:8081";
const check = (condition, message) => { assert.ok(condition, message); assertions++; };

async function procedure(name, input, mutation = false) {
  const headers = { Origin: browser, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const wire = JSON.stringify({ json: input ?? null });
  const response = await fetch(`${api}/api/trpc/${name}${mutation ? "" : `?input=${encodeURIComponent(wire)}`}`, {
    method: mutation ? "POST" : "GET", headers: { ...headers, ...(mutation ? { "Content-Type": "application/json" } : {}) },
    ...(mutation ? { body: wire } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, 200, `${name}: ${JSON.stringify(result)}`);
  return result.result.data.json;
}

async function start() {
  app = spawn(process.execPath, ["scripts/start-local.mjs"], {
    cwd: temporary, env: { ...process.env, BAYMAX_NO_BROWSER: "1", BAYMAX_DB_PATH: join(temporary, "data", "celestial-baymax.sqlite") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  logs = "";
  app.stdout.on("data", (value) => { logs += value; });
  app.stderr.on("data", (value) => { logs += value; });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline && app.exitCode === null) {
    try { const response = await fetch(browser, { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch { }
    await new Promise((accept) => setTimeout(accept, 200));
  }
  throw new Error(`Release failed to start:\n${logs}`);
}

async function stop() {
  if (!app || app.exitCode !== null) return;
  const closed = once(app, "exit");
  app.kill("SIGTERM");
  await closed;
  app = undefined;
}

try {
  for (const folder of ["dist", "web-dist"]) cpSync(join(source, folder), join(temporary, folder), { recursive: true });
  cpSync(join(source, "scripts/start-local.mjs"), join(temporary, "scripts/start-local.mjs"));
  check(!existsSync(join(temporary, "node_modules")), "Smoke copy must not contain dependencies");
  execFileSync(process.execPath, ["dist/init-db.mjs"], { cwd: temporary,
    env: { ...process.env, BAYMAX_DB_PATH: join(temporary, "data/celestial-baymax.sqlite") }, encoding: "utf8" });
  await start();
  check((await fetch(`${api}/api/ready`)).status === 200, "API readiness");
  check((await fetch(`${api}/api/trpc/crew.list`)).status === 401, "Unauthenticated records blocked");
  const preflight = await fetch(`${api}/api/trpc/owner.status`, { method: "OPTIONS", headers: { Origin: browser, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" } });
  check(preflight.status === 204 && preflight.headers.get("access-control-allow-origin") === browser, "Exact local CORS origin");
  check((await fetch(`${api}/api/trpc/owner.status`, { headers: { Origin: "https://untrusted.invalid" } })).status === 403, "Unexpected origins blocked");
  const owner = await procedure("owner.setup", { displayName: "Team B release test", passphrase: "Fictional portable test passphrase" }, true);
  token = owner.token;
  check((await procedure("owner.status")).authenticated, "Local owner account");
  const crew = await procedure("crew.list", {});
  check(crew.length === 6, "Fictional seed profiles");
  const updated = await procedure("crew.update", { ...crew[0], displayName: "Portable persistence verified" }, true);
  check(updated.displayName === "Portable persistence verified", "Profile save over HTTP");
  const bundle = await procedure("assessment.forCrew", { crewId: crew[0].id });
  check(bundle.domains.length === 8, "Screening over HTTP");
  const assistant = await procedure("assistant.ask", { crewId: crew[0].id, question: "Why is this astronaut at risk?" }, true);
  check(JSON.stringify(assistant).length > 100, "Assistant explains stored observations");
  const backup = await procedure("exports.sqliteBackup", undefined, true);
  check(backup.format === "sqlite" && Buffer.from(backup.base64, "base64").subarray(0, 16).toString() === "SQLite format 3\0", "Binary SQLite export in bundled ESM runtime");
  for (const route of ["/", "/crew", "/mission", "/settings", "/mission-context", "/simulator"]) {
    const response = await fetch(browser + route);
    check(response.status === 200 && response.headers.get("content-type").startsWith("text/html"), `Browser route ${route}`);
  }
  const html = await (await fetch(browser)).text();
  const script = html.match(/src="([^" ]+\.js(?:\?[^" ]*)?)"/);
  check(Boolean(script), "Browser JavaScript reference present");
  const scriptResponse = await fetch(new URL(script[1], browser));
  check(scriptResponse.status === 200 && scriptResponse.headers.get("content-type").includes("javascript"), "Browser JavaScript asset");
  check((await fetch(browser + "/missing-asset.js")).status === 404, "Missing asset is not served HTML");
  await stop();
  await start();
  check((await procedure("owner.status")).authenticated, "Owner session survives restart");
  check((await procedure("crew.get", { id: crew[0].id })).displayName === "Portable persistence verified", "Profile survives restart");
  await procedure("owner.logout", undefined, true);
  check((await fetch(`${api}/api/trpc/crew.list`, { headers: { Authorization: `Bearer ${token}` } })).status === 401, "Revoked session is denied");
  await stop();
  const db = new DatabaseSync(join(temporary, "data/celestial-baymax.sqlite"));
  try { check(db.prepare("PRAGMA integrity_check").get().integrity_check === "ok", "Database integrity after restart"); }
  finally { db.close(); }
  check(readFileSync(join(temporary, "data/celestial-baymax.sqlite")).subarray(0, 16).toString() === "SQLite format 3\0", "Persistent file format");
  console.log(`PASS: ${assertions} portable release checks; no node_modules; path contains spaces; setup, HTTP, auth, exports and restart.`);
} catch (error) {
  console.error(error);
  if (logs) console.error(logs);
  process.exitCode = 1;
} finally {
  await stop();
  rmSync(temporary, { recursive: true, force: true });
}
