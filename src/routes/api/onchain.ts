import { json } from "@solidjs/router";

// On-Chain metrics - Demo data with realistic Bitcoin cycle patterns
// In production: Glassnode, CryptoQuant APIs

interface OnChainData {
	mvrv: {
		zScore: number;
		rawValue: number;
		signal: "Overheated" | "Neutral" | "Undervalued";
		signalColor: "rose" | "slate" | "emerald";
	};
	exchangeBalance: {
		btc: number;
		change7d: number;
		change30d: number;
		signal: "Supply Shock" | "Neutral" | "Dump Risk";
		signalColor: "emerald" | "slate" | "rose";
	};
	realizedPrice: {
		sth: number; // Short-term holder realized price
		lth: number; // Long-term holder realized price
		current: number;
		sthRatio: number;
		lthRatio: number;
		trendBroken: boolean;
	};
}

// Fetch current BTC price for realized price context
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
		console.error("Failed to fetch BTC price for on-chain:", e);
	}
	return 95000; // Fallback
}

export async function GET() {
	try {
		const btcPrice = await fetchBTCPrice();

		// MVRV Z-Score simulation based on current market conditions
		// Real MVRV typically ranges from -1 (extreme bear) to 7+ (extreme bull)
		// Current 2024-2025 cycle: elevated but not extreme
		const mvrvBase = 1.8 + Math.random() * 0.6; // 1.8 to 2.4 range
		const mvrvZScore = Number((mvrvBase + (Math.random() - 0.5) * 0.3).toFixed(2));

		let mvrvSignal: "Overheated" | "Neutral" | "Undervalued" = "Neutral";
		let mvrvColor: "rose" | "slate" | "emerald" = "slate";

		if (mvrvZScore > 3.0) {
			mvrvSignal = "Overheated";
			mvrvColor = "rose";
		} else if (mvrvZScore < 0) {
			mvrvSignal = "Undervalued";
			mvrvColor = "emerald";
		}

		// Exchange Balance simulation
		// Current trend: BTC leaving exchanges (bullish)
		const exchangeBtc = 2350000 + Math.floor(Math.random() * 50000);
		const change7d = -1.2 + Math.random() * 0.8; // Slight decrease trend
		const change30d = -3.5 + Math.random() * 1.5;

		let exchangeSignal: "Supply Shock" | "Neutral" | "Dump Risk" = "Neutral";
		let exchangeColor: "emerald" | "slate" | "rose" = "slate";

		if (change7d < -2) {
			exchangeSignal = "Supply Shock";
			exchangeColor = "emerald";
		} else if (change7d > 2) {
			exchangeSignal = "Dump Risk";
			exchangeColor = "rose";
		}

		// Realized Prices
		// STH typically 10-20% below current in bull markets
		// LTH typically 40-60% below current in bull markets
		const sthRealized = Math.round(btcPrice * (0.82 + Math.random() * 0.08));
		const lthRealized = Math.round(btcPrice * (0.45 + Math.random() * 0.1));

		const sthRatio = btcPrice / sthRealized;
		const lthRatio = btcPrice / lthRealized;
		const trendBroken = btcPrice < sthRealized;

		const data: OnChainData = {
			mvrv: {
				zScore: mvrvZScore,
				rawValue: 2.1 + mvrvZScore * 0.3,
				signal: mvrvSignal,
				signalColor: mvrvColor,
			},
			exchangeBalance: {
				btc: exchangeBtc,
				change7d: Number(change7d.toFixed(2)),
				change30d: Number(change30d.toFixed(2)),
				signal: exchangeSignal,
				signalColor: exchangeColor,
			},
			realizedPrice: {
				sth: sthRealized,
				lth: lthRealized,
				current: btcPrice,
				sthRatio: Number(sthRatio.toFixed(2)),
				lthRatio: Number(lthRatio.toFixed(2)),
				trendBroken,
			},
		};

		return json({
			...data,
			isDemo: true,
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error("On-Chain API Error:", error);
		return json({ error: "Failed to fetch on-chain data" }, { status: 500 });
	}
}
