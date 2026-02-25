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
	SUI: "sui",
	PEPE: "pepe",
	VIRTUAL: "virtual-protocol",
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
	price_change_percentage_1h_in_currency?: number;
	price_change_percentage_7d_in_currency?: number;
	price_change_percentage_30d_in_currency?: number;
	price_change_percentage_1y_in_currency?: number;
	market_cap_rank: number;
}

interface BitgetTicker {
	symbol: string;
	lastPr: string;
	open24h: string;
	high24h: string;
	low24h: string;
	quoteVolume: string;
	baseVolume: string;
	usdtVolume: string;
	ts: string;
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

		// --- 1. Fetch CoinGecko (Longer Cache / Stale Fallback) ---
		let cgData: CoinGeckoMarket[] = [];
		const cgCacheKey = "market_cap_cg_raw";
		const cachedCG = apiCache.get<CoinGeckoMarket[]>(cgCacheKey);

		if (cachedCG) {
			cgData = cachedCG;
			console.log("MARKET_API: Using cached CoinGecko data");
		} else {
			const cgUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${cgIds}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h,24h,7d,30d,1y`;
			try {
				const cgRes = await fetch(cgUrl, {
					headers: { "User-Agent": "BTCInsight/1.0" },
				});

				if (cgRes.ok) {
					const text = await cgRes.text();
					const parsed = JSON.parse(text);
					if (Array.isArray(parsed) && parsed.length > 0) {
						cgData = parsed;
						// Cache for 5 minutes
						apiCache.set(cgCacheKey, cgData, 5 * 60 * 1000);
						console.log("MARKET_API: Fetched & Cached new CoinGecko data");
					} else {
						console.warn("MARKET_API: CG data invalid/empty");
					}
				} else {
					console.warn(`MARKET_API: CG Fetch Failed ${cgRes.status}`);
					throw new Error(`Status ${cgRes.status}`);
				}
			} catch (e) {
				console.warn("MARKET_API: CoinGecko Error:", e);
				// Fallback to stale data
				const stale = apiCache.getStale<CoinGeckoMarket[]>(cgCacheKey);
				if (stale && stale.length > 0) {
					console.log("MARKET_API: Using STALE CoinGecko data as fallback");
					cgData = stale;
				}
			}
		}

		// --- 2. Fetch Bitget (Always Fresh) ---
		const bitgetData: Record<string, BitgetTicker> = {};
		// Fetch all tickers to find matches
		const bitgetUrl = "https://api.bitget.com/api/v2/spot/market/tickers";
		try {
			const bRes = await fetch(bitgetUrl);
			if (bRes.ok) {
				const json = await bRes.json();
				if (json.code !== "00000") {
					console.warn("MARKET_API: Bitget Warning:", json.msg);
				} else if (Array.isArray(json.data)) {
					json.data.forEach((t: BitgetTicker) => {
						bitgetData[t.symbol] = t;
					});
				}
			}
		} catch (e) {
			console.error("MARKET_API: Bitget Fetch Failed:", e);
		}

		const result = Object.keys(COINGECKO_MAP).map((symbol) => {
			const cgId = COINGECKO_MAP[symbol];
			const bitgetSymbol = `${symbol}USDT`;

			const cgAsset = Array.isArray(cgData)
				? cgData.find((c) => c.id === cgId)
				: null;
			const bAsset = bitgetData[bitgetSymbol];

			let price = cgAsset?.current_price || 0;
			let change24h = cgAsset?.price_change_percentage_24h || 0;

			if (bAsset) {
				const bPrice = Number.parseFloat(bAsset.lastPr);
				if (!Number.isNaN(bPrice)) {
					price = bPrice;
					const openPrice = Number.parseFloat(bAsset.open24h);
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
				change1h: cgAsset?.price_change_percentage_1h_in_currency || 0,
				change24h,
				change7d: cgAsset?.price_change_percentage_7d_in_currency || 0,
				change30d: cgAsset?.price_change_percentage_30d_in_currency || 0,
				change1y: cgAsset?.price_change_percentage_1y_in_currency || 0,
				rank: cgAsset?.market_cap_rank || 999,
			};
		});

		result.sort((a, b) => a.rank - b.rank);
		// Check data quality before caching
		const validDataCount = result.filter(
			(r) => r.price > 0 || r.change24h !== 0,
		).length;
		const isPartialData = validDataCount < result.length * 0.5;

		if (isPartialData) {
			console.warn(
				"MARKET_API: Partial data detected. Caching for shorter duration.",
			);
			// Cache for only 10 seconds if data is poor to allow retry soon
			apiCache.set(cacheKey, result, 10 * 1000);
		} else {
			apiCache.set(cacheKey, result, CACHE_DURATIONS.MARKET_DATA);
			console.log("MARKET_API: Success, caching full result.");
		}

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
