import { config } from "dotenv";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

config();

const metaEnv = import.meta as { env?: { DATABASE_URL?: string } };
const databaseUrl = process.env.DATABASE_URL || metaEnv.env?.DATABASE_URL;

let dbInstance: PostgresJsDatabase<typeof schema> | undefined;
if (databaseUrl) {
	dbInstance = drizzle(postgres(databaseUrl), { schema });
}

export const db = dbInstance as PostgresJsDatabase<typeof schema>;

export function assertDb(): void {
	if (!dbInstance) {
		throw new Error("Database not configured");
	}
}

export async function savePyramidPositions(data: {
	entries: Array<{ price: number; size: number }>;
	currentPrice: number;
	stopLoss: number;
	isShort: boolean;
	totalSize: number;
	avgPrice: number;
	totalPnl: number;
	showAveraging: boolean;
	quickAdd: { price: number; size: number };
	showBulk: boolean;
	bulkInput: string;
}) {
	if (!db) return null;
	try {
		// Delete existing and insert new (or use upsert)
		const existing = await db.select().from(schema.pyramidPositions).limit(1);
		if (existing.length > 0) {
			await db
				.update(schema.pyramidPositions)
				.set({
					entries: JSON.stringify(data.entries),
					currentPrice: data.currentPrice.toString(),
					stopLoss: data.stopLoss.toString(),
					isShort: data.isShort ? "true" : "false",
					totalSize: data.totalSize.toString(),
					avgPrice: data.avgPrice.toString(),
					totalPnl: data.totalPnl.toString(),
					showAveraging: data.showAveraging ? "true" : "false",
					quickAdd: JSON.stringify(data.quickAdd),
					showBulk: data.showBulk ? "true" : "false",
					bulkInput: data.bulkInput,
					updatedAt: new Date(),
				})
				.where(eq(schema.pyramidPositions.id, existing[0].id));
		} else {
			await db.insert(schema.pyramidPositions).values({
				entries: JSON.stringify(data.entries),
				currentPrice: data.currentPrice.toString(),
				stopLoss: data.stopLoss.toString(),
				isShort: data.isShort ? "true" : "false",
				totalSize: data.totalSize.toString(),
				avgPrice: data.avgPrice.toString(),
				totalPnl: data.totalPnl.toString(),
				showAveraging: data.showAveraging ? "true" : "false",
				quickAdd: JSON.stringify(data.quickAdd),
				showBulk: data.showBulk ? "true" : "false",
				bulkInput: data.bulkInput,
			});
		}
		return true;
	} catch (error) {
		console.error("Failed to save pyramid positions:", error);
		return false;
	}
}

export async function loadPyramidPositions() {
	if (!db) return null;
	try {
		const result = await db.select().from(schema.pyramidPositions).limit(1);
		if (result.length === 0) return null;
		const row = result[0];
		return {
			entries: JSON.parse(row.entries as string),
			currentPrice: parseFloat(row.currentPrice),
			stopLoss: parseFloat(row.stopLoss),
			isShort: row.isShort === "true",
			totalSize: parseFloat(row.totalSize),
			avgPrice: parseFloat(row.avgPrice),
			totalPnl: parseFloat(row.totalPnl),
			showAveraging: row.showAveraging === "true",
			quickAdd: row.quickAdd ? JSON.parse(row.quickAdd as string) : { price: 0, size: 0 },
			showBulk: row.showBulk === "true",
			bulkInput: row.bulkInput || "",
		};
	} catch (error) {
		console.error("Failed to load pyramid positions:", error);
		return null;
	}
}

export async function savePositionCalculator(data: {
	balance: string;
	leverage: string;
	feeRate: string;
	orderType: string;
	direction: string;
	takeProfitOrders: Array<{
		id: string;
		price: string;
		orderType: string;
		positionSize: string;
	}>;
	stopLossOrders: Array<{
		id: string;
		price: string;
		orderType: string;
		positionSize: string;
	}>;
	entries: Array<{
		id: string;
		price: string;
		size: string;
	}>;
	showAveraging: boolean;
}) {
	if (!db) return null;
	try {
		const existing = await db
			.select()
			.from(schema.positionCalculator)
			.where(eq(schema.positionCalculator.id, "default"))
			.limit(1);
		// Calculate summary values for legacy columns
		const totalSize = data.entries.reduce((sum, e) => sum + (parseFloat(e.size) || 0), 0);
		const totalValue = data.entries.reduce((sum, e) => {
			const p = parseFloat(e.price) || 0;
			const s = parseFloat(e.size) || 0;
			return sum + p * s;
		}, 0);
		const avgEntryPrice = totalSize > 0 ? (totalValue / totalSize).toString() : "0";

		if (existing.length > 0) {
			await db
				.update(schema.positionCalculator)
				.set({
					balance: data.balance,
					leverage: data.leverage,
					positionSize: totalSize.toString(),
					entryPrice: avgEntryPrice,
					feeRate: data.feeRate,
					orderType: data.orderType,
					direction: data.direction,
					takeProfitOrders: JSON.stringify(data.takeProfitOrders),
					stopLossOrders: JSON.stringify(data.stopLossOrders),
					entries: JSON.stringify(data.entries),
					showAveraging: data.showAveraging ? "true" : "false",
					updatedAt: new Date(),
				})
				.where(eq(schema.positionCalculator.id, "default"));
		} else {
			await db.insert(schema.positionCalculator).values({
				id: "default",
				balance: data.balance,
				leverage: data.leverage,
				positionSize: totalSize.toString(),
				entryPrice: avgEntryPrice,
				feeRate: data.feeRate,
				orderType: data.orderType,
				direction: data.direction,
				takeProfitOrders: JSON.stringify(data.takeProfitOrders),
				stopLossOrders: JSON.stringify(data.stopLossOrders),
				entries: JSON.stringify(data.entries),
				showAveraging: data.showAveraging ? "true" : "false",
			});
		}
		return true;
	} catch (error) {
		console.error("Failed to save position calculator:", error);
		return false;
	}
}

export async function loadPositionCalculator() {
	if (!db) return null;
	try {
		const result = await db
			.select()
			.from(schema.positionCalculator)
			.where(eq(schema.positionCalculator.id, "default"))
			.limit(1);
		if (result.length === 0) return null;
		const row = result[0];
		return {
			balance: row.balance,
			leverage: row.leverage,
			positionSize: row.positionSize,
			entryPrice: row.entryPrice || "",
			feeRate: row.feeRate,
			orderType: row.orderType,
			direction: row.direction,
			takeProfitOrders: row.takeProfitOrders
				? JSON.parse(row.takeProfitOrders as string)
				: [],
			stopLossOrders: row.stopLossOrders
				? JSON.parse(row.stopLossOrders as string)
				: [],
			entries: row.entries ? JSON.parse(row.entries as string) : [],
			showAveraging: row.showAveraging === "true",
		};
	} catch (error) {
		console.error("Failed to load position calculator:", error);
		return null;
	}
}
