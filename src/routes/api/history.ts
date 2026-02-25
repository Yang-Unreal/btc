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

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const interval = url.searchParams.get("interval") || "1h";
	const currency = url.searchParams.get("currency") || "USD";
	const symbol = url.searchParams.get("symbol") || "BTC"; // Default to BTC
	const toParam = url.searchParams.get("to");

	// Bitget Symbol Logic
	// Always append USDT for Bitget Spot API as USD pairs are rare/USDT is standard
	const bitgetSymbol = `${symbol}USDT`;
	const bitgetInterval = BITGET_INTERVAL_MAP[interval as Interval] || "1h";

	// Bitget API URL
	let bitgetUrl = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${bitgetSymbol}&granularity=${bitgetInterval}&limit=1000`;

	// Pagination Logic
	if (toParam) {
		const toTimeMs = parseInt(toParam);
		bitgetUrl += `&endTime=${toTimeMs}`;
	}

	const cacheKey = `history_bitget_${symbol}_${currency}_${interval}_${toParam || "latest"}`;
	const cachedData = apiCache.get(cacheKey);

	if (cachedData) {
		return json(cachedData);
	}

	try {
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

		// Map to chart format: [time(ms), open, high, low, close, volume]
		let mappedData = result.map((item: BitgetOHLCItem) => [
			parseInt(item[0]), // Time is already ms string
			parseFloat(item[1]),
			parseFloat(item[2]),
			parseFloat(item[3]),
			parseFloat(item[4]),
			parseFloat(item[5]), // Volume
		]);

		// Bitget returns descending (newest first). Sort to ascending.
		mappedData.sort((a, b) => a[0] - b[0]);

		if (toParam) {
			const limitTime = parseInt(toParam);
			mappedData = mappedData.filter((d: number[]) => d[0] < limitTime);
		}

		apiCache.set(cacheKey, mappedData, CACHE_DURATIONS.HISTORICAL_DATA);
		return json(mappedData);
	} catch (error) {
		console.error("Data Proxy Error:", error);
		// If Kraken fails, check for stale cache
		const stale = apiCache.getStale(cacheKey);
		if (stale) {
			console.log(`[History] Using stale cache for ${cacheKey}`);
			return json(stale);
		}
		return json({ error: "Internal Server Error" }, { status: 500 });
	}
}
