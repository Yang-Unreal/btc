import type { AssetConfig, CurrencyConfig, Interval } from "./types";

export const CURRENCIES: CurrencyConfig[] = [
	{ code: "USD", symbol: "$", wsPair: "XBT/USD", locale: "en-US" },
	{ code: "EUR", symbol: "€", wsPair: "XBT/EUR", locale: "de-DE" },
	{ code: "GBP", symbol: "£", wsPair: "XBT/GBP", locale: "en-GB" },
];

export const SUPPORTED_ASSETS: AssetConfig[] = [
	{ symbol: "BTC", name: "Bitcoin", krakenId: "XBT" },
	{ symbol: "ETH", name: "Ethereum", krakenId: "ETH" },
	{ symbol: "SOL", name: "Solana", krakenId: "SOL" },
	{ symbol: "DOGE", name: "Dogecoin", krakenId: "XDG" },
	{ symbol: "LINK", name: "Chainlink", krakenId: "LINK" },
	{ symbol: "TIA", name: "Celestia", krakenId: "TIA" },
	{ symbol: "ONDO", name: "Ondo", krakenId: "ONDO" },
	{ symbol: "PENDLE", name: "Pendle", krakenId: "PENDLE" },
	{ symbol: "TAO", name: "Bittensor", krakenId: "TAO" },
	{ symbol: "AERO", name: "Aerodrome", krakenId: "AERO" },
	{ symbol: "RENDER", name: "Render", krakenId: "RENDER" },
	{ symbol: "AKT", name: "Akash Network", krakenId: "AKT" },
	{ symbol: "EWT", name: "Energy Web Token", krakenId: "EWT" },
	{ symbol: "AAVE", name: "Aave", krakenId: "AAVE" },
	{ symbol: "TON", name: "Toncoin", krakenId: "TON" },
	{ symbol: "HNT", name: "Helium", krakenId: "HNT" },
	{ symbol: "KAS", name: "Kaspa", krakenId: "KAS" },
	{ symbol: "NIGHT", name: "Midnight", krakenId: "NIGHT" },
	{ symbol: "SUI", name: "Sui", krakenId: "SUI" },
	{ symbol: "PEPE", name: "Pepe", krakenId: "PEPE" },
	{ symbol: "VIRTUAL", name: "Virtuals Protocol", krakenId: "VIRTUAL" },
];

// Map asset symbol to AssetConfig
export const ASSET_MAP: Record<string, AssetConfig> = SUPPORTED_ASSETS.reduce(
	(acc, asset) => {
		acc[asset.symbol] = asset;
		return acc;
	},
	{} as Record<string, AssetConfig>,
);

export const KRAKEN_INTERVAL_MAP: Record<Interval, number> = {
	"1m": 1,
	"3m": 5,
	"5m": 5,
	"15m": 15,
	"30m": 30,
	"1h": 60,
	"2h": 240, // Fallback to 4h as Kraken doesn't support 2h
	"4h": 240,
	"12h": 1440,
	"1d": 1440,
	"3d": 10080, // Fallback to 1w as Kraken doesn't support 3d
	"1w": 10080,
	"1M": 21600,
};

export const BITGET_INTERVAL_MAP: Record<Interval, string> = {
	"1m": "1min",
	"3m": "5min",
	"5m": "5min",
	"15m": "15min",
	"30m": "30min",
	"1h": "1h",
	"2h": "1h",
	"4h": "4h",
	"12h": "12h",
	"1d": "1day",
	"3d": "1day",
	"1w": "1week",
	"1M": "1month",
};
