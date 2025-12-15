import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";

// Kraken OHLC item: [time, open, high, low, close, vwap, volume, count]
type KrakenOHLCItem = [number, string, string, string, string, string, string, number];

// Mapping from Standard Symbol to Kraken API Asset Code
const ASSET_MAP: Record<string, string> = {
	BTC: "XBT",
	ETH: "ETH",
	SOL: "SOL",
	DOGE: "XDG",
	XRP: "XRP",
	ADA: "ADA",
	DOT: "DOT",
	LINK: "LINK",
	LTC: "LTC",
	BCH: "BCH",
	UNI: "UNI",
	MATIC: "MATIC",
	XLM: "XLM",
	ATOM: "ATOM",
	AVAX: "AVAX"
};

const mapIntervalToKraken = (interval: string): number => {
	// Kraken API interval values are in minutes
	const map: Record<string, number> = {
		"1m": 1, 
		"3m": 5,
		"5m": 5, 
		"15m": 15, 
		"30m": 30,
		"1h": 60,
		"2h": 120, // Kraken supports 240, not 120 directly usually, but let's map best effort
		"4h": 240,
		"12h": 720,
		"1d": 1440,
		"3d": 4320, // 1440 * 3
		"1w": 10080,
		"1M": 21600,
	};
	return map[interval] || 60;
};

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const interval = url.searchParams.get("interval") || "1h";
	const currency = url.searchParams.get("currency") || "USD"; 
	const symbol = url.searchParams.get("symbol") || "BTC"; // Default to BTC
	const toParam = url.searchParams.get("to");

	// Resolve Kraken Pair
	// e.g. BTC + USD -> XBTUSD (Kraken will normalize to XXBTZUSD in response)
	const krakenAsset = ASSET_MAP[symbol] || symbol; 
	// Handle special currency cases if needed, but USD/EUR/GBP are standard
	const pairParam = `${krakenAsset}${currency}`;

	const krakenInterval = mapIntervalToKraken(interval);

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
		]);

		if (toParam) {
			const limitTime = parseInt(toParam);
			mappedData = mappedData.filter((d: number[]) => d[0] < limitTime);
		}

		return json(mappedData);
	} catch (error) {
		console.error("Data Proxy Error:", error);
		return json([]);
	}
}