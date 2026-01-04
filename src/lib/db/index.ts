import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl =
	process.env.DATABASE_URL || (import.meta as any).env?.DATABASE_URL;

if (!databaseUrl) {
	console.error("CRITICAL: DATABASE_URL is not set in the environment.");
}

export const db = databaseUrl
	? drizzle(postgres(databaseUrl), { schema })
	: (null as any);
