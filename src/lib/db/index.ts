import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

config();

const metaEnv = import.meta as { env?: { DATABASE_URL?: string } };
const databaseUrl = process.env.DATABASE_URL || metaEnv.env?.DATABASE_URL;

let dbInstance;
if (databaseUrl) {
	dbInstance = drizzle(postgres(databaseUrl), { schema });
}

export const db = dbInstance;

export async function savePyramidPositions(data: {
	entries: Array<{ price: number; size: number }>;
	currentPrice: number;
	stopLoss: number;
	isShort: boolean;
	totalSize: number;
	avgPrice: number;
	totalPnl: number;
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
		};
	} catch (error) {
		console.error("Failed to load pyramid positions:", error);
		return null;
	}
}

export async function savePositionCalculator(data: {
	balance: string;
	leverage: string;
	positionSize: string;
	entryPrice: string;
	feeRate: string;
	orderType: string;
	direction: string;
	takeProfitOrders: Array<{
		id: string;
		price: string;
		orderType: string;
		positionPercent: number;
	}>;
	stopLossOrders: Array<{
		id: string;
		price: string;
		orderType: string;
		positionPercent: number;
	}>;
}) {
	if (!db) return null;
	try {
		const existing = await db
			.select()
			.from(schema.positionCalculator)
			.where(eq(schema.positionCalculator.id, "default"))
			.limit(1);
		if (existing.length > 0) {
			await db
				.update(schema.positionCalculator)
				.set({
					balance: data.balance,
					leverage: data.leverage,
					positionSize: data.positionSize,
					entryPrice: data.entryPrice || null,
					feeRate: data.feeRate,
					orderType: data.orderType,
					direction: data.direction,
					takeProfitOrders: JSON.stringify(data.takeProfitOrders),
					stopLossOrders: JSON.stringify(data.stopLossOrders),
					updatedAt: new Date(),
				})
				.where(eq(schema.positionCalculator.id, "default"));
		} else {
			await db.insert(schema.positionCalculator).values({
				id: "default",
				balance: data.balance,
				leverage: data.leverage,
				positionSize: data.positionSize,
				entryPrice: data.entryPrice || null,
				feeRate: data.feeRate,
				orderType: data.orderType,
				direction: data.direction,
				takeProfitOrders: JSON.stringify(data.takeProfitOrders),
				stopLossOrders: JSON.stringify(data.stopLossOrders),
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
		};
	} catch (error) {
		console.error("Failed to load position calculator:", error);
		return null;
	}
}
