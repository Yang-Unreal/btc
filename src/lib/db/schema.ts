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
	interval: text("interval").notNull().default("1h"),
	favoriteIntervals: text("favorite_intervals"), // Store as JSON string: ["4h", "1h"]
	indicators: text("indicators"), // Store as JSON string since pg-core json might vary
	indicatorHeights: text("indicator_heights"), // Store as JSON string for oscillators/atr heights
	notificationsEnabled: text("notifications_enabled").notNull().default("true"), // "true" or "false"
	fourHAlertEnabled: text("four_h_alert_enabled").notNull().default("false"), // "true" or "false"
	accountBalance: numeric("account_balance").notNull().default("10000"),
	leverage: text("leverage").notNull().default("10"),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const priceAlerts = pgTable("price_alerts", {
	id: uuid("id").primaryKey().defaultRandom(),
	symbol: text("symbol").notNull().default("BTC"),
	targetPrice: numeric("target_price").notNull(),
	direction: text("direction").notNull().default("CROSSING"), // "ABOVE", "BELOW", "CROSSING"
	enabled: text("enabled").notNull().default("true"),
	triggered: text("triggered").notNull().default("false"), // To prevent repeated alerts
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
export type OpenInterestHistory = typeof openInterestHistory.$inferSelect;
export type NewOpenInterestHistory = typeof openInterestHistory.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export const pyramidPositions = pgTable("pyramid_positions", {
	id: uuid("id").primaryKey().defaultRandom(),
	entries: text("entries").notNull(), // JSON string array of {price, size}
	currentPrice: numeric("current_price").notNull(),
	stopLoss: numeric("stop_loss").notNull(),
	isShort: text("is_short").notNull().default("true"),
	totalSize: numeric("total_size").notNull(),
	avgPrice: numeric("avg_price").notNull(),
	totalPnl: numeric("total_pnl").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PriceAlert = typeof priceAlerts.$inferSelect;
export type NewPriceAlert = typeof priceAlerts.$inferInsert;
export type PyramidPosition = typeof pyramidPositions.$inferSelect;
export type NewPyramidPosition = typeof pyramidPositions.$inferInsert;

export const positionCalculator = pgTable("position_calculator", {
	id: text("id").primaryKey().default("default"),
	balance: numeric("balance").notNull().default("10000"),
	leverage: numeric("leverage").notNull().default("10"),
	positionSize: numeric("position_size").notNull().default("0.1"),
	entryPrice: text("entry_price"),
	feeRate: numeric("fee_rate").notNull().default("0.0432"),
	orderType: text("order_type").notNull().default("market"),
	direction: text("direction").notNull().default("long"),
	takeProfitOrders: text("take_profit_orders"), // JSON string
	stopLossOrders: text("stop_loss_orders"), // JSON string
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PositionCalculator = typeof positionCalculator.$inferSelect;
export type NewPositionCalculator = typeof positionCalculator.$inferInsert;
