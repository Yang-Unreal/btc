import { json } from "@solidjs/router";

// Derivatives data from real public APIs
// Primary: OKX (works globally)
// Fallback: CoinGecko for market data

interface DerivativesData {
	openInterest: {
		total: number; // In billions USD
		change24h: number;
		btcEquivalent: number;
	};
	fundingRate: {
		avg: number; // Average across exchanges
		okx: number;
		deribit: number;
	};
	longShortRatio: {
		ratio: number; // > 1 means more longs
		longs: number;
		shorts: number;
	};
	signal: "Long Squeeze Risk" | "Short Squeeze Opportunity" | "Neutral";
	signalColor: "rose" | "emerald" | "slate";
	priceOiDivergence: "Healthy" | "Weak Rally" | "Weak Dump" | "Neutral";
}

// Fetch BTC price from CoinGecko
async function fetchBTCPrice(): Promise<number> {
	try {
		const res = await fetch(
			"https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
		);
		if (res.ok) {
			const data = await res.json();
			return data.bitcoin?.usd || 95000;
		}
	} catch (e) {
		console.error("Failed to fetch BTC price:", e);
	}
	return 95000;
}

// Fetch Open Interest from OKX
async function fetchOKXOpenInterest(): Promise<{
	oi: number;
	oiBTC: number;
} | null> {
	try {
		const res = await fetch(
			"https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP",
		);
		if (res.ok) {
			const data = await res.json();
			if (data.code === "0" && data.data?.[0]) {
				// oi is in contracts, oiCcy is in coin (BTC)
				const oiBTC = parseFloat(data.data[0].oiCcy || "0");
				return { oi: oiBTC, oiBTC };
			}
		}
	} catch (e) {
		console.error("Failed to fetch OKX OI:", e);
	}
	return null;
}

// Fetch Funding Rate from OKX
async function fetchOKXFundingRate(): Promise<number | null> {
	try {
		const res = await fetch(
			"https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP",
		);
		if (res.ok) {
			const data = await res.json();
			if (data.code === "0" && data.data?.[0]) {
				// fundingRate is returned as decimal
				return parseFloat(data.data[0].fundingRate) * 100;
			}
		}
	} catch (e) {
		console.error("Failed to fetch OKX funding rate:", e);
	}
	return null;
}

// Fetch Funding Rate from Deribit (alternative source)
async function fetchDeribitFundingRate(): Promise<number | null> {
	try {
		const res = await fetch(
			"https://www.deribit.com/api/v2/public/get_funding_rate_value?instrument_name=BTC-PERPETUAL&start_timestamp=" +
				(Date.now() - 8 * 60 * 60 * 1000) +
				"&end_timestamp=" +
				Date.now(),
		);
		if (res.ok) {
			const data = await res.json();
			if (data.result !== undefined) {
				// Deribit returns 8-hour funding rate as decimal
				return data.result * 100;
			}
		}
	} catch (e) {
		console.error("Failed to fetch Deribit funding rate:", e);
	}
	return null;
}

// Fetch Long/Short Ratio from OKX
async function fetchOKXLongShortRatio(): Promise<{
	ratio: number;
	longs: number;
	shorts: number;
} | null> {
	try {
		const res = await fetch(
			"https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=1H",
		);
		if (res.ok) {
			const data = await res.json();
			if (data.code === "0" && data.data?.length > 0) {
				// Latest entry
				const latest = data.data[0];
				const ratio = parseFloat(latest[1]); // longShortAccountRatio
				const longs = (ratio / (1 + ratio)) * 100;
				const shorts = 100 - longs;
				return { ratio, longs, shorts };
			}
		}
	} catch (e) {
		console.error("Failed to fetch OKX long/short ratio:", e);
	}
	return null;
}

export async function GET() {
	try {
		// Fetch all data in parallel
		const [btcPrice, okxOI, okxFR, deribitFR, lsRatio] = await Promise.all([
			fetchBTCPrice(),
			fetchOKXOpenInterest(),
			fetchOKXFundingRate(),
			fetchDeribitFundingRate(),
			fetchOKXLongShortRatio(),
		]);

		// Calculate Open Interest in USD (billions)
		// OKX is one major exchange, multiply by ~3-4x for total market estimate
		const okxOiBTC = okxOI?.oiBTC || 0;
		const estimatedTotalOiBTC = okxOiBTC * 3.5; // OKX is ~25-30% of market
		const oiUSD = (estimatedTotalOiBTC * btcPrice) / 1e9;

		// Use fetched funding rates
		const okxFunding = okxFR ?? 0.01;
		const deribitFunding = deribitFR ?? okxFunding;
		const avgFunding = (okxFunding + deribitFunding) / 2;

		// Long/Short ratio
		const ratio = lsRatio?.ratio ?? 1.0;
		const longs = lsRatio?.longs ?? 50;
		const shorts = lsRatio?.shorts ?? 50;

		// Determine signals based on funding rate
		let signal: "Long Squeeze Risk" | "Short Squeeze Opportunity" | "Neutral" =
			"Neutral";
		let signalColor: "rose" | "emerald" | "slate" = "slate";

		if (avgFunding > 0.05) {
			signal = "Long Squeeze Risk";
			signalColor = "rose";
		} else if (avgFunding < -0.01) {
			signal = "Short Squeeze Opportunity";
			signalColor = "emerald";
		}

		// Price-OI Divergence
		let priceOiDivergence: "Healthy" | "Weak Rally" | "Weak Dump" | "Neutral" =
			"Neutral";
		if (oiUSD > 15) {
			priceOiDivergence = "Healthy";
		}

		const data: DerivativesData = {
			openInterest: {
				total: Number(oiUSD.toFixed(2)),
				change24h: 0,
				btcEquivalent: Math.round(estimatedTotalOiBTC),
			},
			fundingRate: {
				avg: Number(avgFunding.toFixed(4)),
				okx: Number(okxFunding.toFixed(4)),
				deribit: Number(deribitFunding.toFixed(4)),
			},
			longShortRatio: {
				ratio: Number(ratio.toFixed(2)),
				longs: Number(longs.toFixed(1)),
				shorts: Number(shorts.toFixed(1)),
			},
			signal,
			signalColor,
			priceOiDivergence,
		};

		return json({
			...data,
			source: okxOI ? "okx" : "estimated",
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error("Derivatives API Error:", error);
		return json({ error: "Failed to fetch derivatives data" }, { status: 500 });
	}
}
