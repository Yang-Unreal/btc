import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";

// Type for Kraken OHLC data item: [time, open, high, low, close, vwap, volume, count]
type KrakenOHLCItem = [number, string, string, string, string, string, string, number];

// Map intervals to Kraken format
const mapIntervalToKraken = (interval: string): number => {
	switch (interval) {
		case "1m": return 1;
		case "3m": return 5; // Closest: 5m
		case "5m": return 5;
		case "15m": return 15;
		case "30m": return 30;
		case "1h": return 60;
		case "2h": return 240; // Closest: 4h
		case "4h": return 240;
		case "12h": return 1440; // Closest: 1d
		case "1d": return 1440;
		case "3d": return 10080; // Closest: 1w
		case "1w": return 10080;
		case "1M": return 21600;
		default: return 1440; // Default to 1d
	}
};

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	// Default to 1 day if not specified
	const interval = url.searchParams.get("interval") || "1d";
	const krakenInterval = mapIntervalToKraken(interval);
	// Kraken Pro API for OHLC
	const krakenUrl = `https://api.kraken.com/0/public/OHLC?pair=XXBTZUSD&interval=${krakenInterval}&since=0`;

	try {
		const response = await fetch(krakenUrl);
		if (!response.ok) {
			throw new Error(`Kraken API error: ${response.status}`);
		}
		const data = await response.json();
		if (data.error && data.error.length > 0) {
			throw new Error(`Kraken API error: ${data.error.join(", ")}`);
		}
		// Kraken returns { XXBTZUSD: [[time, open, high, low, close, vwap, volume, count], ...] }
		const ohlcData = data.result?.XXBTZUSD;
		if (!Array.isArray(ohlcData)) {
			throw new Error("Invalid Kraken data format");
		}
		// Map to Binance-like format: [timestamp, open, high, low, close]
		const mappedData = ohlcData.map((item: KrakenOHLCItem) => [
			item[0] * 1000, // Convert to milliseconds
			parseFloat(item[1]), // open
			parseFloat(item[2]), // high
			parseFloat(item[3]), // low
			parseFloat(item[4]), // close
		]);
		return json(mappedData);
	} catch (error) {
		console.error("Data Proxy Error:", error);
		return json({ error: "Failed to fetch historical data" }, { status: 500 });
	}
}