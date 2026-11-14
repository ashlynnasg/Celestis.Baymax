import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
mkdirSync("dist", { recursive: true });
await build({
  entryPoints: { api: "server/_core/index.ts", "init-db": "server/init-local.ts" },
  outdir: "dist", outExtension: { ".js": ".mjs" },
  bundle: true, platform: "node", format: "esm", target: "node22.16",
  banner: { js: 'import { createRequire as __baymaxCreateRequire } from "node:module"; const require = __baymaxCreateRequire(import.meta.url);' },
  sourcemap: false, logLevel: "info",
});
if (!process.argv.includes("--server-only")) execFileSync(process.execPath, ["node_modules/expo/bin/cli", "export", "--platform", "web", "--output-dir", "web-dist"], {
  stdio: "inherit",
  env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1", NODE_ENV: "production",
    EXPO_PUBLIC_API_BASE_URL: "http://127.0.0.1:3000",
    EXPO_PUBLIC_APP_ID: "", EXPO_PUBLIC_OAUTH_PORTAL_URL: "", EXPO_PUBLIC_OAUTH_SERVER_URL: "",
    MANUS_PROJECT_ID: "", VITE_APP_ID: "", MANUS_OAUTH_PORTAL_URL: "", VITE_OAUTH_PORTAL_URL: "",
    MANUS_OAUTH_API_URL: "", OAUTH_SERVER_URL: "",
  },
});
console.log("Local build complete. Windows startup needs Node.js only; no npm install is required.");
