import { SEED_VERSION } from "../../shared/constants";
import "dotenv/config";
import { config as loadEnvFile } from "dotenv";

// The Expo dev toolchain keeps its preview/packager origins in .env.local; the API needs the same
// values to trust those browser origins. Missing file is fine in production containers.
// Server-only values (database DSN). Never loaded by the Expo client bundle.
loadEnvFile({ path: ".env.server" });
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createCorsMiddleware } from "./cors";
import { clearLegacySessionCookie } from "./cookies";
import { ensureSeeded } from "../seed";
import { createOwnerGate } from "../owner-auth";
import { syncAllCrewCases } from "../assessment";

async function prepareData() {
  try {
    const result = await ensureSeeded();
    if (result.caution) console.log(`[seed] ${result.caution}`);
    if (result.seeded)
      console.log("[seed] fictional demonstration data initialized");
    await syncAllCrewCases();
  } catch (error) {
    console.error(
      "[seed] data preparation failed",
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(createCorsMiddleware());
  app.use(clearLegacySessionCookie());

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.get("/api/ready", async (_req, res) => {
    try {
      const { getState } = await import("../db");
      const state = await getState();
      if (state.seedVersion !== SEED_VERSION) {
        res
          .status(503)
          .json({
            ok: false,
            error: "Fictional data initialization is still in progress.",
          });
        return;
      }
      res.json({ ok: true, seedVersion: state.seedVersion });
    } catch (error) {
      res
        .status(503)
        .json({
          ok: false,
          error: error instanceof Error ? error.message : "not ready",
        });
    }
  });

  app.use("/api/trpc", createOwnerGate());
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  await prepareData();
  const port = parseInt(process.env.PORT || "3000");
  server.on("error", (error) => {
    console.error("[api]", error.message);
    process.exitCode = 1;
  });
  server.listen(port, process.env.HOST || "127.0.0.1", () => {
    console.log(`[api] ready at http://127.0.0.1:${port}`);
  });
}

startServer().catch((error) => {
  console.error("[api] server failed to start", error);
  process.exitCode = 1;
});
