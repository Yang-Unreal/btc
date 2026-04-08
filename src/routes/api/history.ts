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
			req: { coin, interval: hlInterval, startTime: startTimeMs, endTime: endTimeMs },
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

	const hlInterval = HL_INTERVAL_MAP[interval as Interval] || "1h";

	const cacheKey = `history_hl_${symbol}_${currency}_${interval}_${toParam || "latest"}`;
	const cachedData = apiCache.get(cacheKey);

	if (cachedData) {
		return json(cachedData);
	}

	try {
		if (toParam) {
			// Pagination mode: fetch one page (~200 candles) ending at toParam
			const endTimeMs = parseInt(toParam);
			// Determine page size by going back interval * 200 from endTime
			const intervalMs = intervalToMs(hlInterval);
			const startTimeMs = endTimeMs - intervalMs * 200;

			const pageData = await fetchHLCandles(symbol, hlInterval, startTimeMs, endTimeMs);
			// Exclude the candle at exactly endTime (it's the boundary from the previous fetch)
			const filtered = pageData.filter((d) => d[0] < Math.floor(endTimeMs / 1000));

			apiCache.set(cacheKey, filtered, CACHE_DURATIONS.HISTORICAL_DATA);
			return json(filtered);
		}

		// Initial load: fetch ~1000 candles ending now
		const now = Date.now();
		const intervalMs = intervalToMs(hlInterval);
		const startTimeMs = now - intervalMs * 1000;

		const mappedData = await fetchHLCandles(symbol, hlInterval, startTimeMs, now);

		// If fewer than 1000, try to supplement with older data
		if (mappedData.length > 0 && mappedData.length < 1000) {
			const earliestMs = mappedData[0][0] * 1000;
			const needed = 1000 - mappedData.length;
			const pagesNeeded = Math.ceil(needed / 200);

			let olderData: number[][] = [];
			let cursor = earliestMs;

			for (let page = 0; page < pagesNeeded; page++) {
				const pageStartMs = cursor - intervalMs * 200;
				const pageData = await fetchHLCandles(symbol, hlInterval, pageStartMs, cursor);
				if (pageData.length === 0) break;
				olderData = [...pageData, ...olderData];
				cursor = pageData[0][0] * 1000;
				if (pageData.length < 50) break; // stop if not returning enough data
			}

			if (olderData.length > 0) {
				const combined = [...olderData, ...mappedData];
				// Deduplicate by timestamp
				const seen = new Set<number>();
				const deduped = combined.filter((d) => {
					if (seen.has(d[0])) return false;
					seen.add(d[0]);
					return true;
				});
				deduped.sort((a, b) => a[0] - b[0]);
				apiCache.set(cacheKey, deduped, CACHE_DURATIONS.HISTORICAL_DATA);
				return json(deduped);
			}
		}

		apiCache.set(cacheKey, mappedData, CACHE_DURATIONS.HISTORICAL_DATA);
		return json(mappedData);
	} catch (error) {
		console.error("Hyperliquid History API Error:", error);
		const stale = apiCache.getStale(cacheKey);
		if (stale) {
			console.log(`[History] Using stale cache for ${cacheKey}`);
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
