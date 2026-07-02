import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "./schema.js";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;

export function createDatabase(url: string) {
  const pool = new pg.Pool({ connectionString: url });
  return {
    db: drizzle(pool, { schema }) as Database,
    close: () => pool.end(),
  };
}
