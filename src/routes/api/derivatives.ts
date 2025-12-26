import { json } from "@solidjs/router";

// Derivatives data - Demo data with realistic patterns
// In production: Coinglass API

interface DerivativesData {
	openInterest: {
		total: number; // In billions USD
		change24h: number;
		btcEquivalent: number;
	};
	fundingRate: {
		avg: number; // Average across major exchanges
		binance: number;
		bybit: number;
		okx: number;
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

// Fetch current BTC price for OI calculation
async function fetchBTCPrice(): Promise<number> {
	try {
		const res = await fetch(
			"https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
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

export async function GET() {
	try {
		const btcPrice = await fetchBTCPrice();

		// Generate realistic derivatives data
		// Open Interest typically 15-25B during active markets
		const oiBase = 18 + Math.random() * 5;
		const oiChange = (Math.random() - 0.4) * 8; // Slight positive bias

		// Funding rate: typically -0.05% to 0.15%
		// High positive = long squeeze risk, negative = short squeeze opportunity
		const baseFunding = 0.02 + Math.random() * 0.06;
		const fundingVariance = (Math.random() - 0.5) * 0.02;

		const binanceFunding = Number((baseFunding + fundingVariance).toFixed(4));
		const bybitFunding = Number((baseFunding + (Math.random() - 0.5) * 0.02).toFixed(4));
		const okxFunding = Number((baseFunding + (Math.random() - 0.5) * 0.02).toFixed(4));
		const avgFunding = Number(((binanceFunding + bybitFunding + okxFunding) / 3).toFixed(4));

		// Long/Short ratio: typically 0.8 to 1.3
		const lsRatio = 0.95 + Math.random() * 0.25;
		const totalPositions = 100;
		const longs = (lsRatio / (1 + lsRatio)) * totalPositions;
		const shorts = totalPositions - longs;

		// Determine signals
		let signal: "Long Squeeze Risk" | "Short Squeeze Opportunity" | "Neutral" = "Neutral";
		let signalColor: "rose" | "emerald" | "slate" = "slate";

		if (avgFunding > 0.05) {
			signal = "Long Squeeze Risk";
			signalColor = "rose";
		} else if (avgFunding < 0) {
			signal = "Short Squeeze Opportunity";
			signalColor = "emerald";
		}

		// Price-OI Divergence analysis
		let priceOiDivergence: "Healthy" | "Weak Rally" | "Weak Dump" | "Neutral" = "Neutral";
		if (oiChange > 2) {
			priceOiDivergence = "Healthy";
		} else if (oiChange < -2) {
			priceOiDivergence = "Weak Rally";
		}

		const data: DerivativesData = {
			openInterest: {
				total: Number(oiBase.toFixed(2)),
				change24h: Number(oiChange.toFixed(2)),
				btcEquivalent: Math.round((oiBase * 1e9) / btcPrice),
			},
			fundingRate: {
				avg: avgFunding,
				binance: binanceFunding,
				bybit: bybitFunding,
				okx: okxFunding,
			},
			longShortRatio: {
				ratio: Number(lsRatio.toFixed(2)),
				longs: Number(longs.toFixed(1)),
				shorts: Number(shorts.toFixed(1)),
			},
			signal,
			signalColor,
			priceOiDivergence,
		};

		return json({
			...data,
			isDemo: true,
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error("Derivatives API Error:", error);
		return json({ error: "Failed to fetch derivatives data" }, { status: 500 });
	}
}
