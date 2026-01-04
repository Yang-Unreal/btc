import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

config();

const metaEnv = import.meta as { env?: { DATABASE_URL?: string } };
const databaseUrl = process.env.DATABASE_URL || metaEnv.env?.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("CRITICAL: DATABASE_URL is not set in the environment.");
}

export const db = drizzle(postgres(databaseUrl), { schema });
