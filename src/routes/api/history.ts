import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { apiCache, CACHE_DURATIONS } from "../../lib/cache";
import { HL_INTERVAL_MAP } from "../../lib/constants";
import type { Interval } from "../../lib/types";

const HL_API = "https://api.hyperliquid.xyz/info";

// Hyperliquid candle object
interface HLCandle {
	t: number; // open time (ms)
	T: number; // close time (ms)
	s: string; // symbol
	i: string; // interval
	o: string; // open
	c: string; // close
	h: string; // high
	l: string; // low
	v: string; // volume (base)
	n: number; // number of trades
}

function mapHLCandle(c: HLCandle): number[] {
	return [
		Math.floor(c.t / 1000), // convert ms → seconds (UTC timestamp)
		parseFloat(c.o),
		parseFloat(c.h),
		parseFloat(c.l),
		parseFloat(c.c),
		parseFloat(c.v),
	];
}

function aggregateToWeekly(dailyCandles: number[][]): number[][] {
	if (dailyCandles.length === 0) return [];
	const weekly: number[][] = [];
	let currentWeek: number[] | null = null;
	let currentWeekMondayTs = 0;

	for (const day of dailyCandles) {
		const dayTs = day[0] * 1000;
		const date = new Date(dayTs);
		const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon
		const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
		const mondayTs = dayTs - diff * 86400000;

		if (!currentWeek || mondayTs !== currentWeekMondayTs) {
			if (currentWeek) weekly.push(currentWeek);
			currentWeekMondayTs = mondayTs;
			currentWeek = [...day];
			currentWeek[0] = mondayTs / 1000;
		} else {
			currentWeek[2] = Math.max(currentWeek[2], day[2]); // High
			currentWeek[3] = Math.min(currentWeek[3], day[3]); // Low
			currentWeek[4] = day[4]; // Close
			currentWeek[5] += day[5]; // Volume
		}
	}
	if (currentWeek) weekly.push(currentWeek);
	return weekly;
}

function aggregateToMonthly(dailyCandles: number[][]): number[][] {
	if (dailyCandles.length === 0) return [];
	const monthly: number[][] = [];
	let currentMonth: number[] | null = null;
	let currentMonthStr = "";

	for (const day of dailyCandles) {
		const date = new Date(day[0] * 1000);
		const monthStr = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

		if (!currentMonth || monthStr !== currentMonthStr) {
			if (currentMonth) monthly.push(currentMonth);
			currentMonthStr = monthStr;
			currentMonth = [...day];
			const firstOfMonth = new Date(
				Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
			);
			currentMonth[0] = firstOfMonth.getTime() / 1000;
		} else {
			currentMonth[2] = Math.max(currentMonth[2], day[2]);
			currentMonth[3] = Math.min(currentMonth[3], day[3]);
			currentMonth[4] = day[4];
			currentMonth[5] += day[5];
		}
	}
	if (currentMonth) monthly.push(currentMonth);
	return monthly;
}

/**
 * Fetch candles from Hyperliquid.
 * startTime and endTime are in milliseconds.
 * Returns data sorted ascending by time (seconds).
 */
async function fetchHLCandles(
	coin: string,
	hlInterval: string,
	startTimeMs: number,
	endTimeMs: number,
): Promise<number[][]> {
	const response = await fetch(HL_API, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			type: "candleSnapshot",
			req: {
				coin,
				interval: hlInterval,
				startTime: startTimeMs,
				endTime: endTimeMs,
			},
		}),
	});

	if (!response.ok) return [];

	const data: HLCandle[] = await response.json();
	if (!Array.isArray(data)) return [];

	const mapped = data.map(mapHLCandle);
	mapped.sort((a, b) => a[0] - b[0]);
	return mapped;
}

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const interval = url.searchParams.get("interval") || "1h";
	const currency = url.searchParams.get("currency") || "USD";
	const symbol = url.searchParams.get("symbol") || "BTC";
	const toParam = url.searchParams.get("to");

	const hlIntervalMapping = HL_INTERVAL_MAP[interval as Interval] || "1h";
	const useAggregation = interval === "1w" || interval === "1M";
	const hlInterval = useAggregation ? "1d" : hlIntervalMapping;

	const cacheKey = `history_hl_${symbol}_${currency}_${interval}_${toParam || "latest"}`;
	const cachedData = apiCache.get(cacheKey);

	if (cachedData) {
		return json(cachedData);
	}

	try {
		if (toParam) {
			// Pagination mode: fetch one page (~200 candles) ending at toParam
			const endTimeMs = parseInt(toParam, 10);
			const intervalMs = intervalToMs(hlInterval);
			const startTimeMs = Math.max(0, endTimeMs - intervalMs * 1000);

			const pageData = await fetchHLCandles(
				symbol,
				hlInterval,
				startTimeMs,
				endTimeMs,
			);
			// Exclude the candle at exactly endTime (it's the boundary from the previous fetch)
			let filtered = pageData.filter(
				(d) => d[0] < Math.floor(endTimeMs / 1000),
			);

			if (interval === "1w") {
				filtered = aggregateToWeekly(filtered);
			} else if (interval === "1M") {
				filtered = aggregateToMonthly(filtered);
			}

			apiCache.set(cacheKey, filtered, CACHE_DURATIONS.HISTORICAL_DATA);
			return json(filtered);
		}

		// Initial load: fetch ~3000 candles ending now
		const now = Date.now();
		const intervalMs = intervalToMs(hlInterval);
		const startTimeMs = Math.max(0, now - intervalMs * 3000);

		const mappedData = await fetchHLCandles(
			symbol,
			hlInterval,
			startTimeMs,
			now,
		);

		// If fewer than 2000, try to supplement with older data
		let finalData = mappedData;
		if (finalData.length > 0 && finalData.length < 2000) {
			const earliestMs = finalData[0][0] * 1000;
			const needed = 3000 - finalData.length;
			const pagesNeeded = Math.ceil(needed / 1000);

			let olderData: number[][] = [];
			let cursor = earliestMs;

			for (let page = 0; page < pagesNeeded; page++) {
				const pageStartMs = Math.max(0, cursor - intervalMs * 1000);
				const pageData = await fetchHLCandles(
					symbol,
					hlInterval,
					pageStartMs,
					cursor,
				);
				if (pageData.length === 0) break;
				olderData = [...pageData, ...olderData];
				cursor = pageData[0][0] * 1000;
				if (pageData.length < 100) break; // stop if not returning enough data
			}

			if (olderData.length > 0) {
				const combined = [...olderData, ...finalData];
				// Deduplicate by timestamp
				const seen = new Set<number>();
				const deduped = combined.filter((d) => {
					if (seen.has(d[0])) return false;
					seen.add(d[0]);
					return true;
				});
				deduped.sort((a, b) => a[0] - b[0]);
				finalData = deduped;
			}
		}

		if (interval === "1w") {
			finalData = aggregateToWeekly(finalData);
		} else if (interval === "1M") {
			finalData = aggregateToMonthly(finalData);
		}

		apiCache.set(cacheKey, finalData, CACHE_DURATIONS.HISTORICAL_DATA);
		return json(finalData);
	} catch (error) {
		console.error("Hyperliquid History API Error:", error);
		const stale = apiCache.getStale(cacheKey);
		if (stale) {
			// console.log(`[History] Using stale cache for ${cacheKey}`);
			return json(stale);
		}
		return json({ error: "Internal Server Error" }, { status: 500 });
	}
}

/** Convert a Hyperliquid interval string to approximate milliseconds for pagination. */
function intervalToMs(hlInterval: string): number {
	const map: Record<string, number> = {
		"1m": 60_000,
		"3m": 180_000,
		"5m": 300_000,
		"15m": 900_000,
		"30m": 1_800_000,
		"1h": 3_600_000,
		"2h": 7_200_000,
		"4h": 14_400_000,
		"8h": 28_800_000,
		"12h": 43_200_000,
		"1d": 86_400_000,
		"3d": 259_200_000,
		"1w": 604_800_000,
		"1M": 2_592_000_000,
	};
	return map[hlInterval] ?? 3_600_000;
}
