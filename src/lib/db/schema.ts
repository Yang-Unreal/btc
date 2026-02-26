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

export const userSettings = pgTable("user_settings", {
	id: text("id").primaryKey().default("default"),
	currency: text("currency").notNull().default("USD"),
	indicators: text("indicators"), // Store as JSON string since pg-core json might vary
	notificationsEnabled: text("notifications_enabled").notNull().default("true"), // "true" or "false"
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
export type OpenInterestHistory = typeof openInterestHistory.$inferSelect;
export type NewOpenInterestHistory = typeof openInterestHistory.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
