import { and, eq } from "drizzle-orm";
import { ASSET_MAP } from "../lib/constants";
import { assertDb, db } from "../lib/db";
import { priceAlerts } from "../lib/db/schema";

assertDb();

const CHECK_INTERVAL_MS = 30_000;
const HL_API = "https://api.hyperliquid.xyz/info";

async function fetchAllMids(): Promise<Record<string, string> | null> {
	try {
		const response = await fetch(HL_API, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: "allMids" }),
		});
		if (!response.ok) return null;
		const data = await response.json();
		if (data && typeof data === "object") {
			return data as Record<string, string>;
		}
		return null;
	} catch {
		return null;
	}
}

async function fetchLatestPrice(symbol: string): Promise<number | null> {
	const now = Date.now();
	const candidates = [symbol];
	if (symbol.startsWith("xyz:")) {
		candidates.push(symbol.slice(4));
	} else {
		candidates.push(`xyz:${symbol}`);
	}
	for (const coin of candidates) {
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				const response = await fetch(HL_API, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "candleSnapshot",
						req: {
							coin,
							interval: "1m",
							startTime: now - 5 * 60 * 1000,
							endTime: now,
						},
					}),
				});
				if (!response.ok) continue;
				const data = await response.json();
				if (Array.isArray(data) && data.length > 0) {
					return parseFloat(data[data.length - 1].c);
				}
			} catch {
				// ignore
			}
			await new Promise((r) => setTimeout(r, 1000 * attempt));
		}
	}
	return null;
}

const previousPrices: Record<string, number> = {};

async function checkPriceAlerts() {
	const alerts = await db
		.select()
		.from(priceAlerts)
		.where(
			and(eq(priceAlerts.enabled, "true"), eq(priceAlerts.triggered, "false")),
		);

	const allMids = await fetchAllMids();

	for (const alert of alerts) {
		const symbol = alert.symbol || "BTC";
		const hlKey = ASSET_MAP[symbol]?.hlSymbol || symbol;
		let currentPrice: number | null = null;

		const mid = allMids?.[hlKey] || allMids?.[symbol];
		if (mid) {
			currentPrice = parseFloat(mid);
		} else {
			currentPrice = await fetchLatestPrice(hlKey);
		}

		if (!currentPrice) continue;

		const target = Number(alert.targetPrice);
		const previousPrice = previousPrices[symbol] || 0;
		previousPrices[symbol] = currentPrice;

		const exactMatch = Math.abs(currentPrice - target) <= 0.01;
		const crossedUp =
			previousPrice > 0 && previousPrice < target && currentPrice >= target;
		const crossedDown =
			previousPrice > 0 && previousPrice > target && currentPrice <= target;

		if (exactMatch || crossedUp || crossedDown) {
			await db
				.update(priceAlerts)
				.set({ triggered: "true", enabled: "false", updatedAt: new Date() })
				.where(eq(priceAlerts.id, alert.id));
		}
	}
}

export async function startPriceAlertMonitor() {
	await checkPriceAlerts();
	setInterval(checkPriceAlerts, CHECK_INTERVAL_MS);
}
