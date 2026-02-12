import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { apiCache, CACHE_DURATIONS } from "../../lib/cache";

import { ASSET_MAP, KRAKEN_INTERVAL_MAP } from "../../lib/constants";
import type { Interval } from "../../lib/types";

// Kraken OHLC item: [time, open, high, low, close, vwap, volume, count]
type KrakenOHLCItem = [
	number,
	string,
	string,
	string,
	string,
	string,
	string,
	number,
];

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const interval = url.searchParams.get("interval") || "1h";
	const currency = url.searchParams.get("currency") || "USD";
	const symbol = url.searchParams.get("symbol") || "BTC"; // Default to BTC
	const toParam = url.searchParams.get("to");

	// Resolve Kraken Pair
	// e.g. BTC + USD -> XBTUSD (Kraken will normalize to XXBTZUSD in response)
	const krakenAsset = ASSET_MAP[symbol]?.krakenId || symbol;
	// Handle special currency cases if needed, but USD/EUR/GBP are standard
	const pairParam = `${krakenAsset}${currency}`;

	const krakenInterval = KRAKEN_INTERVAL_MAP[interval as Interval] || 60;

	// Kraken API URL
	let krakenUrl = `https://api.kraken.com/0/public/OHLC?pair=${pairParam}&interval=${krakenInterval}`;

	// Pagination Logic
	if (toParam) {
		const toTimeMs = parseInt(toParam);
		const toTimeSec = Math.floor(toTimeMs / 1000);
		const lookbackWindow = 720 * (krakenInterval * 60);
		const sinceTimestamp = toTimeSec - lookbackWindow;
		krakenUrl += `&since=${sinceTimestamp}`;
	}

	const cacheKey = `history_${symbol}_${currency}_${interval}_${toParam || "latest"}`;
	const cachedData = apiCache.get(cacheKey);

	if (cachedData) {
		return json(cachedData);
	}

	try {
		const response = await fetch(krakenUrl);

		if (!response.ok) {
			return json([]);
		}

		const data = await response.json();

		if (data.error && data.error.length > 0) {
			console.warn("Kraken API Warning:", data.error);
			return json([]);
		}

		// Kraken returns data keyed by the Pair Name.
		// Since the Pair Name changes based on request (XXBTZUSD, XXBTZEUR), access dynamically.
		const resultKeys = Object.keys(data.result || {});
		const result = resultKeys.length > 0 ? data.result[resultKeys[0]] : [];

		if (!Array.isArray(result)) {
			return json([]);
		}

		// Map to chart format: [time(ms), open, high, low, close]
		let mappedData = result.map((item: KrakenOHLCItem) => [
			item[0] * 1000,
			parseFloat(item[1]),
			parseFloat(item[2]),
			parseFloat(item[3]),
			parseFloat(item[4]),
			parseFloat(item[6]), // Volume
		]);

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
