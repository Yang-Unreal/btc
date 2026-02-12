export type Interval =
	| "1m"
	| "3m"
	| "5m"
	| "15m"
	| "30m"
	| "1h"
	| "2h"
	| "4h"
	| "12h"
	| "1d"
	| "3d"
	| "1w"
	| "1M";

export type CurrencyCode = "USD" | "EUR" | "GBP";

export interface CurrencyConfig {
	code: CurrencyCode;
	symbol: string;
	wsPair: string; // Kraken WS uses "XBT/USD", "XBT/EUR"
	locale: string;
}

export interface AssetConfig {
	symbol: string;
	name: string;
	krakenId: string; // Used for WS pair construction
}
