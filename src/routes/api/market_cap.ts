import { json } from "@solidjs/router";
import { apiCache, CACHE_DURATIONS } from "~/lib/cache";

// Mapping: Internal Symbol -> CoinGecko API ID
const COINGECKO_MAP: Record<string, string> = {
	BTC: "bitcoin",
	ETH: "ethereum",
	SOL: "solana",
	DOGE: "dogecoin",
	LINK: "chainlink",
	TIA: "celestia",
	ONDO: "ondo-finance",
	PENDLE: "pendle",
	TAO: "bittensor",
	AERO: "aerodrome-finance",
	RENDER: "render-token",
	AKT: "akash-network",
	EWT: "energy-web-token",
	AAVE: "aave",
	TON: "the-open-network",
	HNT: "helium",
	KAS: "kaspa",
	NIGHT: "midnight-3",
};

const KRAKEN_MAP: Record<string, string> = {
	BTC: "XXBTZUSD",
	ETH: "XETHZUSD",
	SOL: "SOLUSD",
	DOGE: "XDGUSD",
	LINK: "LINKUSD",
	TIA: "TIAUSD",
	ONDO: "ONDOUSD",
	PENDLE: "PENDLEUSD",
	TAO: "TAOUSD",
	AERO: "AEROUSD",
	RENDER: "RENDERUSD",
	AKT: "AKTUSD",
	EWT: "EWTUSD",
	AAVE: "AAVEUSD",
	TON: "TONUSD",
	HNT: "HNTUSD",
	KAS: "KASUSD",
	NIGHT: "NIGHTUSD",
};

interface CoinGeckoMarket {
	id: string;
	symbol: string;
	name: string;
	image: string;
	current_price: number;
	market_cap: number;
	total_volume: number;
	price_change_percentage_24h: number;
	market_cap_rank: number;
}

interface KrakenTicker {
	a: string[]; // ask
	b: string[]; // bid
	c: string[]; // last trade: [price, whole lot volume]
	v: string[]; // volume
	p: string[]; // vwap
	t: number[]; // trades
	l: string[]; // low
	h: string[]; // high
	o: string; // opening price
}

export async function GET() {
	console.log("MARKET_API: Request received");
	try {
		const cacheKey = "market_cap_data";
		const cachedData = apiCache.get(cacheKey);
		if (cachedData) {
			console.log("MARKET_API: Returning cached data");
			return json(cachedData);
		}

		console.log("MARKET_API: Fetching fresh data...");
		const cgIds = Object.values(COINGECKO_MAP).join(",");
		const krakenPairs = Object.values(KRAKEN_MAP).join(",");

		const cgUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${cgIds}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`;
		const krakenUrl = `https://api.kraken.com/0/public/Ticker?pair=${krakenPairs}`;

		const [cgRes, krakenRes] = await Promise.all([
			fetch(cgUrl, { headers: { "User-Agent": "BTCInsight/1.0" } }).catch(
				(e) => ({ ok: false, error: e }),
			),
			fetch(krakenUrl).catch((e) => ({ ok: false, error: e })),
		]);

		console.log(
			"MARKET_API: Fetch complete. CG:",
			cgRes.ok,
			"Kraken:",
			krakenRes.ok,
		);

		let cgData: CoinGeckoMarket[] = [];
		if (cgRes.ok) {
			const text = await (cgRes as Response).text();
			try {
				cgData = JSON.parse(text);
				if (!Array.isArray(cgData)) {
					console.warn(
						"MARKET_API: CG data is not an array:",
						text.substring(0, 100),
					);
					cgData = [];
				}
			} catch {
				console.error("MARKET_API: CG JSON parse failed");
				cgData = [];
			}
		}

		let krakenData: Record<string, KrakenTicker> = {};
		if (krakenRes.ok) {
			try {
				const res = await (krakenRes as Response).json();
				krakenData = res.result || {};
			} catch {
				console.error("MARKET_API: Kraken JSON parse failed");
			}
		}

		const result = Object.keys(COINGECKO_MAP).map((symbol) => {
			const cgId = COINGECKO_MAP[symbol];
			const krakenPair = KRAKEN_MAP[symbol];

			const cgAsset = Array.isArray(cgData)
				? cgData.find((c) => c.id === cgId)
				: null;
			const kAsset = krakenData ? krakenData[krakenPair] : null;

			let price = cgAsset?.current_price || 0;
			let change24h = cgAsset?.price_change_percentage_24h || 0;

			if (kAsset?.c?.[0]) {
				const kPrice = Number.parseFloat(kAsset.c[0]);
				if (!Number.isNaN(kPrice)) {
					price = kPrice;
					const openPrice = Number.parseFloat(kAsset.o);
					if (openPrice > 0) {
						change24h = ((price - openPrice) / openPrice) * 100;
					}
				}
			}

			return {
				symbol,
				name: cgAsset?.name || symbol,
				image: cgAsset?.image || "",
				price,
				marketCap: cgAsset?.market_cap || 0,
				volume24h: cgAsset?.total_volume || 0,
				change24h,
				rank: cgAsset?.market_cap_rank || 999,
			};
		});

		result.sort((a, b) => a.rank - b.rank);
		apiCache.set(cacheKey, result, CACHE_DURATIONS.MARKET_DATA);
		console.log("MARKET_API: Success, returning", result.length, "assets");
		return json(result);
	} catch (error: unknown) {
		console.error("CRITICAL MARKET API ERROR:", error);
		const message = error instanceof Error ? error.message : String(error);
		return json(
			{
				error: "Internal Server Error",
				message,
			},
			{ status: 500 },
		);
	}
}
