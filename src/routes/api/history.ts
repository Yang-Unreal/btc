import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { apiCache, CACHE_DURATIONS } from "../../lib/cache";

import { BITGET_INTERVAL_MAP } from "../../lib/constants";
import type { Interval } from "../../lib/types";

// Bitget OHLC item: [time, open, high, low, close, volume, quoteVol, ...]
type BitgetOHLCItem = [
	string, // time
	string, // open
	string, // high
	string, // low
	string, // close
	string, // volume
	string, // quoteVol
];

function mapBitgetItem(item: BitgetOHLCItem): number[] {
	return [
		parseInt(item[0]),
		parseFloat(item[1]),
		parseFloat(item[2]),
		parseFloat(item[3]),
		parseFloat(item[4]),
		parseFloat(item[5]),
	];
}

/**
 * Fetch a single page from Bitget history-candles endpoint (max 200 per page).
 * Returns data sorted ascending by time.
 */
async function fetchHistoryPage(
	bitgetSymbol: string,
	bitgetInterval: string,
	endTimeMs: number,
): Promise<number[][]> {
	const url = `https://api.bitget.com/api/v2/spot/market/history-candles?symbol=${bitgetSymbol}&granularity=${bitgetInterval}&limit=200&endTime=${endTimeMs}`;
	const response = await fetch(url);
	if (!response.ok) return [];

	const data = await response.json();
	if (data.code !== "00000" || !Array.isArray(data.data)) return [];

	const mapped = data.data.map(mapBitgetItem);
	// Filter out any candles at or after endTime
	const filtered = mapped.filter((d: number[]) => d[0] < endTimeMs);
	filtered.sort((a: number[], b: number[]) => a[0] - b[0]);
	return filtered;
}

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const interval = url.searchParams.get("interval") || "1h";
	const currency = url.searchParams.get("currency") || "USD";
	const symbol = url.searchParams.get("symbol") || "BTC";
	const toParam = url.searchParams.get("to");

	const bitgetSymbol = `${symbol}USDT`;
	const bitgetInterval = BITGET_INTERVAL_MAP[interval as Interval] || "1h";

	const cacheKey = `history_bitget_${symbol}_${currency}_${interval}_${toParam || "latest"}`;
	const cachedData = apiCache.get(cacheKey);

	if (cachedData) {
		return json(cachedData);
	}

	try {
		if (toParam) {
			// --- Pagination mode: fetch 1 page (200 candles) for instant response ---
			// The client infinite scroll will trigger more loads as needed
			const endTimeMs = parseInt(toParam);
			const pageData = await fetchHistoryPage(
				bitgetSymbol,
				bitgetInterval,
				endTimeMs,
			);

			apiCache.set(cacheKey, pageData, CACHE_DURATIONS.HISTORICAL_DATA);
			return json(pageData);
		}

		// --- Initial load: use /candles for latest data (up to 1000) ---
		const bitgetUrl = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${bitgetSymbol}&granularity=${bitgetInterval}&limit=1000`;
		const response = await fetch(bitgetUrl);

		if (!response.ok) {
			return json([]);
		}

		const data = await response.json();

		if (data.code !== "00000") {
			console.warn("Bitget API Warning:", data.msg);
			return json([]);
		}

		const result = data.data;

		if (!Array.isArray(result)) {
			return json([]);
		}

		let mappedData = result.map(mapBitgetItem);
		mappedData.sort((a: number[], b: number[]) => a[0] - b[0]);

		// If /candles returned fewer than 1000, supplement with history-candles
		if (mappedData.length > 0 && mappedData.length < 1000) {
			const earliestTime = mappedData[0][0];
			const needed = 1000 - mappedData.length;
			const pagesNeeded = Math.ceil(needed / 200);

			let olderData: number[][] = [];
			let cursor = earliestTime;

			for (let page = 0; page < pagesNeeded; page++) {
				const pageData = await fetchHistoryPage(
					bitgetSymbol,
					bitgetInterval,
					cursor,
				);
				if (pageData.length === 0) break;
				olderData = [...pageData, ...olderData];
				cursor = pageData[0][0];
				if (pageData.length < 200) break;
			}

			if (olderData.length > 0) {
				mappedData = [...olderData, ...mappedData];
				// Deduplicate
				const seen = new Set<number>();
				mappedData = mappedData.filter((d: number[]) => {
					if (seen.has(d[0])) return false;
					seen.add(d[0]);
					return true;
				});
				mappedData.sort((a: number[], b: number[]) => a[0] - b[0]);
			}
		}

		apiCache.set(cacheKey, mappedData, CACHE_DURATIONS.HISTORICAL_DATA);
		return json(mappedData);
	} catch (error) {
		console.error("Data Proxy Error:", error);
		const stale = apiCache.getStale(cacheKey);
		if (stale) {
			console.log(`[History] Using stale cache for ${cacheKey}`);
			return json(stale);
		}
		return json({ error: "Internal Server Error" }, { status: 500 });
	}
}
