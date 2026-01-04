import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const favorites = pgTable("favorites", {
	id: uuid("id").primaryKey().defaultRandom(),
	symbol: text("symbol").notNull().unique(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const openInterestHistory = pgTable("open_interest_history", {
	id: uuid("id").primaryKey().defaultRandom(),
	timestamp: timestamp("timestamp").defaultNow().notNull(),
	oiBTC: numeric("oi_btc").notNull(),
});

export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
export type OpenInterestHistory = typeof openInterestHistory.$inferSelect;
export type NewOpenInterestHistory = typeof openInterestHistory.$inferInsert;
