import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@repo/crm-schema";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://crm:crm@localhost:5432/crm";

export const pool = new pg.Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool, { schema });
