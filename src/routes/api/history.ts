

import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";

// Kraken OHLC item: [time, open, high, low, close, vwap, volume, count]
type KrakenOHLCItem = [number, string, string, string, string, string, string, number];

const PAIR = "XXBTZUSD";

const mapIntervalToKraken = (interval: string): number => {
	// Kraken API interval values are in minutes
	const map: Record<string, number> = {
		"1m": 1, 
		"3m": 5, // Closest match
		"5m": 5, 
		"15m": 15, 
		"30m": 30,
		"1h": 60, 
		"2h": 240, 
		"4h": 240, 
		"12h": 1440, 
		"1d": 1440, 
		"3d": 10080, 
		"1w": 10080, 
		"1M": 21600
	};
	return map[interval] || 60;
};

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const interval = url.searchParams.get("interval") || "1h";
	const toParam = url.searchParams.get("to"); // Timestamp in Milliseconds

	const krakenInterval = mapIntervalToKraken(interval);

	// Kraken API URL
	let krakenUrl = `https://api.kraken.com/0/public/OHLC?pair=${PAIR}&interval=${krakenInterval}`;

	// Pagination Logic
	if (toParam) {
		const toTimeMs = parseInt(toParam);
		const toTimeSec = Math.floor(toTimeMs / 1000);

		// Kraken returns approximately 720 candles per request.
		// To get the "previous page" ending at 'toTime', we calculate a 'since' 
		// timestamp that is 720 intervals in the past.
		const lookbackWindow = 720 * (krakenInterval * 60); // 720 candles * seconds per candle
		const sinceTimestamp = toTimeSec - lookbackWindow;

		krakenUrl += `&since=${sinceTimestamp}`;
	}

	try {
		const response = await fetch(krakenUrl);
		
		if (!response.ok) {
			// If Kraken fails (e.g., Rate limit), return empty to stop UI spinner safely
			return json([]);
		}

		const data = await response.json();
		
		if (data.error && data.error.length > 0) {
			console.warn("Kraken API Warning:", data.error);
			// Often "EService:Unavailable" or similar. Return empty.
			return json([]);
		}

		const result = data.result?.[PAIR];
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
		]);

		// STRICT FILTERING:
		// When using 'since', Kraken returns data starting FROM that time.
		// We must filter out any data that overlaps with what we already have (data >= toParam).
		if (toParam) {
			const limitTime = parseInt(toParam);
			mappedData = mappedData.filter((d) => d[0] < limitTime);
		}

		return json(mappedData);
	} catch (error) {
		console.error("Data Proxy Error:", error);
		return json([]);
	}
}