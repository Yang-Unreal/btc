import { json } from "@solidjs/router";

// DefiLlama Stablecoins API - Free and reliable
interface StablecoinData {
	id: string;
	name: string;
	symbol: string;
	circulating: {
		peggedUSD: number;
	};
	circulatingPrevDay?: {
		peggedUSD: number;
	};
	circulatingPrevWeek?: {
		peggedUSD: number;
	};
	circulatingPrevMonth?: {
		peggedUSD: number;
	};
}

interface DefiLlamaResponse {
	peggedAssets: StablecoinData[];
}

export async function GET() {
	try {
		const response = await fetch("https://stablecoins.llama.fi/stablecoins?includePrices=false", {
			headers: {
				"User-Agent": "BTCInsight/1.0",
			},
		});

		if (!response.ok) {
			console.error(`DefiLlama API Error: ${response.status}`);
			return json({ error: "API Error" }, { status: 500 });
		}

		const data: DefiLlamaResponse = await response.json();

		// Find USDT and USDC
		const usdt = data.peggedAssets.find((s) => s.symbol === "USDT");
		const usdc = data.peggedAssets.find((s) => s.symbol === "USDC");

		const usdtSupply = usdt?.circulating?.peggedUSD || 0;
		const usdcSupply = usdc?.circulating?.peggedUSD || 0;
		const totalSupply = usdtSupply + usdcSupply;

		// Calculate changes
		const usdtPrevDay = usdt?.circulatingPrevDay?.peggedUSD || usdtSupply;
		const usdcPrevDay = usdc?.circulatingPrevDay?.peggedUSD || usdcSupply;
		const totalPrevDay = usdtPrevDay + usdcPrevDay;

		const usdtPrevWeek = usdt?.circulatingPrevWeek?.peggedUSD || usdtSupply;
		const usdcPrevWeek = usdc?.circulatingPrevWeek?.peggedUSD || usdcSupply;
		const totalPrevWeek = usdtPrevWeek + usdcPrevWeek;

		const usdtPrevMonth = usdt?.circulatingPrevMonth?.peggedUSD || usdtSupply;
		const usdcPrevMonth = usdc?.circulatingPrevMonth?.peggedUSD || usdcSupply;
		const totalPrevMonth = usdtPrevMonth + usdcPrevMonth;

		// Calculate percentage changes
		const change1d = totalPrevDay > 0 ? ((totalSupply - totalPrevDay) / totalPrevDay) * 100 : 0;
		const change7d = totalPrevWeek > 0 ? ((totalSupply - totalPrevWeek) / totalPrevWeek) * 100 : 0;
		const change30d = totalPrevMonth > 0 ? ((totalSupply - totalPrevMonth) / totalPrevMonth) * 100 : 0;

		// Determine signal
		let signal: "Bullish" | "Bearish" | "Neutral" = "Neutral";
		let signalLabel = "Stable";

		if (change7d > 0.5) {
			signal = "Bullish";
			signalLabel = "Minting";
		} else if (change7d < -0.5) {
			signal = "Bearish";
			signalLabel = "Redeeming";
		}

		return json({
			usdt: {
				supply: usdtSupply,
				change1d: ((usdtSupply - usdtPrevDay) / usdtPrevDay) * 100,
			},
			usdc: {
				supply: usdcSupply,
				change1d: ((usdcSupply - usdcPrevDay) / usdcPrevDay) * 100,
			},
			total: {
				supply: totalSupply,
				change1d,
				change7d,
				change30d,
			},
			signal,
			signalLabel,
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error("Stablecoin API Error:", error);
		return json({ error: "Failed to fetch stablecoin data" }, { status: 500 });
	}
}
