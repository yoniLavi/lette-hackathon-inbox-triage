import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db.js";
import { apiRoutes } from "./routes.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const log = (msg: string, ...args: unknown[]) =>
  console.log(`[crm] ${msg}`, ...args);

const app = new Hono();

app.use("*", cors({ origin: "*" }));
app.route("/", apiRoutes);

async function start() {
  // Run Drizzle migrations on startup
  log("Running database migrations...");
  const migrationsFolder = path.resolve(__dirname, "../../crm-schema/drizzle");
  await migrate(db, { migrationsFolder });
  log("Database ready");

  const port = Number(process.env.PORT) || 8002;
  log("Starting CRM API on port %d", port);
  serve({ fetch: app.fetch, port }, (info) => {
    log("CRM API listening on http://localhost:%d", info.port);
  });
}

start().catch((err) => {
  console.error("Failed to start CRM API:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  log("Shutting down...");
  await pool.end();
  process.exit(0);
});
