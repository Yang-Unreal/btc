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
	ONDO: "ondo",
	PENDLE: "pendle",
	TAO: "bittensor",
	AERO: "aerodrome-finance",
	RENDER: "render-token",
	AKT: "akash-network",
	EWT: "energy-web-token",
	AAVE: "aave",
	TON: "toncoin",
	HNT: "helium",
	KAS: "kaspa",
	NIGHT: "midnight-3",
};

// Basic CoinGecko Response Type
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

export async function GET() {
	const cacheKey = "market_cap_data";

	// Check cache first
	const cachedData = apiCache.get(cacheKey);
	if (cachedData) {
		return json(cachedData);
	}

	const ids = Object.values(COINGECKO_MAP).join(",");
	const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`;

	try {
		// Add a simple user-agent to avoid some basic blocking
		const response = await fetch(url, {
			headers: {
				"User-Agent": "BTCInsight/1.0",
			},
		});

		if (!response.ok) {
			console.error(`CoinGecko API Error: ${response.status}`);
			// Fallback or empty array on error
			return json([]);
		}

		const data: CoinGeckoMarket[] = await response.json();

		// Map back to our structure if needed, or return raw
		// We'll return the raw list but ensure it matches our symbols
		const result = data.map((coin: CoinGeckoMarket) => {
			// Find our symbol key
			const symbol =
				Object.keys(COINGECKO_MAP).find(
					(key) => COINGECKO_MAP[key] === coin.id,
				) || coin.symbol.toUpperCase();
			return {
				symbol: symbol,
				name: coin.name,
				image: coin.image,
				price: coin.current_price,
				marketCap: coin.market_cap,
				volume24h: coin.total_volume,
				change24h: coin.price_change_percentage_24h,
				rank: coin.market_cap_rank,
			};
		});

		// Cache the result
		apiCache.set(cacheKey, result, CACHE_DURATIONS.MARKET_DATA);

		return json(result);
	} catch (error) {
		console.error("Market Cap Data Error:", error);
		return json([]);
	}
}
