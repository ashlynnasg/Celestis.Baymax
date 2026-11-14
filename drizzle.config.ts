import { defineConfig } from "drizzle-kit";

// Runtime setup creates tables automatically. Optional developer introspection uses this file.
export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/sqlite-migrations",
  dialect: "sqlite",
  dbCredentials: { url: process.env.BAYMAX_DB_PATH || "./data/celestial-baymax.sqlite" },
});
