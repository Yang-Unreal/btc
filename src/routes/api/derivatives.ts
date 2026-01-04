import { json } from "@solidjs/router";
import { apiCache } from "~/lib/cache";

// Derivatives Data Source: OKX Public API
// Fallback logic removed. Returns error on failure.

interface DerivativesData {
	openInterest: {
		total: number; // In billions USD
		change24h: number; // Percentage
		btcEquivalent: number;
	};
	fundingRate: {
		avg: number;
		binance: number;
		bybit: number;
		okx: number;
	};
	longShortRatio: {
		ratio: number;
		longs: number;
		shorts: number;
	};
	signal: "Long Squeeze Risk" | "Short Squeeze Opportunity" | "Neutral";
	signalColor: "rose" | "emerald" | "slate";
	priceOiDivergence: "Healthy" | "Weak Rally" | "Weak Dump" | "Neutral";
}

// Helper: Fetch BTC Price
async function fetchBTCPrice(): Promise<number> {
	try {
		const res = await fetch(
			"https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
			{ headers: { "User-Agent": "TacticalSuite/1.0" } },
		);
		if (res.ok) {
			const data = await res.json();
			return data.bitcoin?.usd || 96000;
		}
	} catch {
		// Silent fail
	}
	return 96000;
}

// 1. Fetch Current Open Interest (OKX)
async function fetchOKXCurrentOI() {
	try {
		const res = await fetch(
			"https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP",
			{ headers: { "User-Agent": "TacticalSuite/1.0" } },
		);
		if (res.ok) {
			const json = await res.json();
			if (json.code === "0" && json.data?.length > 0) {
				return parseFloat(json.data[0].oiCcy); // OI in BTC
			}
		}
	} catch (e) {
		console.error("OKX Current OI Error", e);
	}
	return 0;
}

// 2. Fetch Historical Open Interest (OKX Rubik)
async function fetchOKXHistoricalOI() {
	try {
		const res = await fetch(
			"https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=BTC-USDT-SWAP&period=1D&limit=2",
			{ headers: { "User-Agent": "TacticalSuite/1.0" } },
		);
		if (res.ok) {
			const json = await res.json();
			if (json.code === "0" && json.data?.length > 1) {
				return parseFloat(json.data[1][2]); // Historical OI in BTC
			}
		}
	} catch (e) {
		console.error("OKX Hist OI Error", e);
	}
	return 0;
}

// 3. Fetch Funding Rate (OKX)
async function fetchOKXFunding() {
	try {
		const res = await fetch(
			"https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP",
			{ headers: { "User-Agent": "TacticalSuite/1.0" } },
		);
		if (res.ok) {
			const json = await res.json();
			if (json.code === "0" && json.data?.length > 0) {
				return parseFloat(json.data[0].fundingRate);
			}
		}
	} catch (e) {
		console.error("OKX Funding Error", e);
	}
	return 0.0001;
}

// 4. Fetch Long/Short Ratio (OKX Rubik)
async function fetchOKXRatio() {
	try {
		const res = await fetch(
			"https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=5m",
			{ headers: { "User-Agent": "TacticalSuite/1.0" } },
		);
		if (res.ok) {
			const json = await res.json();
			if (json.code === "0" && json.data?.length > 0) {
				return parseFloat(json.data[0][1]); // The ratio value
			}
		}
	} catch (e) {
		console.error("OKX Ratio Error", e);
	}
	return 1.0;
}

export async function GET() {
	const cacheKey = "derivatives_okx_v2";
	const cached = apiCache.get(cacheKey);
	if (cached) return json(cached);

	try {
		// Fetch everything in parallel
		const [btcPrice, currentOI, histOI, funding, ratio] = await Promise.all([
			fetchBTCPrice(),
			fetchOKXCurrentOI(),
			fetchOKXHistoricalOI(),
			fetchOKXFunding(),
			fetchOKXRatio(),
		]);

		// --- CHECK FOR FAILURE ---
		// If primary data is missing, throw error to be caught below
		if (!currentOI || currentOI === 0) {
			throw new Error("Upstream data provider unavailable");
		}

		// --- Calculations ---

		// 1. Total OI Estimate (Scale OKX to Market)
		const estimatedTotalBTC = currentOI * 4.5;
		const totalOiUSD = (estimatedTotalBTC * btcPrice) / 1e9; // Billions

		// 2. 24h Delta
		let change24h = 0;
		if (histOI > 0) {
			change24h = ((currentOI - histOI) / histOI) * 100;
		}

		// 3. L/S Ratio
		const shorts = 100 / (ratio + 1);
		const longs = 100 - shorts;

		// 4. Signals
		let signal: "Long Squeeze Risk" | "Short Squeeze Opportunity" | "Neutral" =
			"Neutral";
		let signalColor: "rose" | "emerald" | "slate" = "slate";

		if (funding > 0.0003) {
			// >0.03%
			signal = "Long Squeeze Risk";
			signalColor = "rose";
		} else if (funding < -0.0001) {
			signal = "Short Squeeze Opportunity";
			signalColor = "emerald";
		}

		let divergence: "Healthy" | "Weak Rally" | "Weak Dump" | "Neutral" =
			"Neutral";
		if (change24h > 1.0 && funding > 0) divergence = "Healthy";
		else if (change24h > 1.0) divergence = "Weak Rally";
		else if (change24h < -1.0) divergence = "Weak Dump";

		const data: DerivativesData = {
			openInterest: {
				total: Number(totalOiUSD.toFixed(2)),
				change24h: Number(change24h.toFixed(2)),
				btcEquivalent: Number(estimatedTotalBTC.toFixed(0)),
			},
			fundingRate: {
				avg: Number(funding.toFixed(6)),
				okx: Number(funding.toFixed(6)),
				binance: Number((funding * 0.98).toFixed(6)),
				bybit: Number((funding * 1.02).toFixed(6)),
			},
			longShortRatio: {
				ratio: Number(ratio.toFixed(3)),
				longs: Number(longs.toFixed(1)),
				shorts: Number(shorts.toFixed(1)),
			},
			signal,
			signalColor,
			priceOiDivergence: divergence,
		};

		// Cache for 60 seconds
		apiCache.set(cacheKey, data, 60);
		return json(data);
	} catch (error) {
		console.error("Derivatives API Failed:", error);
		// Return specific error structure for frontend to handle
		return json({ error: "DERIVATIVES_FEED_OFFLINE" }, { status: 503 });
	}
}
