import { spawn } from "node:child_process";
import { existsSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createPortProbe } from "node:net";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
process.chdir(root);
const webRoot = resolve(root, "web-dist");
const host = "127.0.0.1";
const apiPort = 3000;
const webPort = 8081;
const address = `http://${host}:${webPort}`;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2",
  ".map": "application/json", ".wasm": "application/wasm" };

function checkPort(port) {
  return new Promise((accept, reject) => {
    const probe = createPortProbe();
    probe.once("error", () => reject(new Error(`Port ${port} is already in use. Close the other app or previous Baymax terminal, then try again.`)));
    probe.listen(port, host, () => probe.close(accept));
  });
}

async function main() {
  if (!existsSync(resolve(root, "dist/api.mjs")) || !existsSync(resolve(webRoot, "index.html"))) {
    throw new Error("The local build is missing. Extract the complete ZIP or run rebuild_windows.cmd.");
  }
  await checkPort(apiPort);
  await checkPort(webPort);
  const api = spawn(process.execPath, ["dist/api.mjs"], {
    cwd: root, stdio: "inherit", windowsHide: true,
    env: { ...process.env, NODE_ENV: "production", HOST: host, PORT: String(apiPort),
      EXPO_PACKAGER_PROXY_URL: address, EXPO_WEB_PREVIEW_URL: "http://localhost:8081" },
  });
  let apiStopped = false;
  let stopping = false;
  let web;
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    web?.closeAllConnections();
    web?.close();
    if (!apiStopped) api.kill();
  };
  api.once("error", (error) => { console.error(error.message); stop(1); });
  api.once("exit", (code) => {
    apiStopped = true;
    if (!stopping) { console.error(`The API stopped (exit ${code ?? "signal"}).`); stop(1); }
  });
  process.once("SIGINT", () => stop());
  process.once("SIGTERM", () => stop());
  process.once("exit", () => { if (!apiStopped) api.kill(); });

  try {
    let ready = false;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline && !apiStopped && !stopping) {
      try {
        const response = await fetch(`http://${host}:${apiPort}/api/ready`, { signal: AbortSignal.timeout(1200) });
        if (response.ok && (await response.json()).ok === true) { ready = true; break; }
      } catch { /* Startup is still initializing SQLite and fictional records. */ }
      await new Promise((accept) => setTimeout(accept, 250));
    }
    if (!ready) throw new Error("The API did not become ready. Read the error above; your data has not been reset.");

    web = createServer((request, response) => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" }).end(); return;
      }
      try {
        const pathname = decodeURIComponent(new URL(request.url, address).pathname);
        let file = resolve(webRoot, `.${pathname}`);
        if (file !== webRoot && !file.startsWith(webRoot + sep)) { response.writeHead(403).end(); return; }
        if (existsSync(file) && statSync(file).isDirectory()) {
          const index = resolve(file, "index.html");
          // A route can also have child routes: Expo emits crew.html beside crew/new.html.
          file = existsSync(index) ? index : (existsSync(file + ".html") ? file + ".html" : resolve(webRoot, "index.html"));
        }
        // Expo static exports include one HTML file per route.
        if (!existsSync(file) && !extname(file) && existsSync(file + ".html")) file += ".html";
        if (!existsSync(file) && !extname(file)) file = resolve(webRoot, "index.html");
        if (!existsSync(file) || !statSync(file).isFile()) { response.writeHead(404).end(); return; }
        response.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream",
          "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        if (request.method === "HEAD") { response.end(); return; }
        createReadStream(file).on("error", () => response.destroy()).pipe(response);
      } catch { response.writeHead(400).end(); }
    });
    web.once("error", (error) => { console.error(error.message); stop(1); });
    await new Promise((accept, reject) => {
      web.once("error", reject);
      web.listen(webPort, host, accept);
    });
    console.log(`\nCelestial Baymax is ready: ${address}\nKeep this terminal open. Press Ctrl+C to stop.\n`);
    if (process.platform === "win32" && process.env.BAYMAX_NO_BROWSER !== "1") {
      const opener = spawn("powershell.exe", ["-NoProfile", "-Command", `Start-Process '${address}'`], { stdio: "ignore", windowsHide: true });
      opener.once("error", () => console.log(`Open ${address} in your browser.`));
      opener.unref();
    }
  } catch (error) {
    stop(1);
    throw error;
  }
}

main().catch((error) => { console.error(`\nStartup failed: ${error.message}`); process.exitCode = 1; });
