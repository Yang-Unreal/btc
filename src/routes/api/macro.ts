import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";

// Define types for Yahoo Finance API response
interface YahooChartMeta {
	regularMarketPrice?: number;
	chartPreviousClose?: number;
}

interface YahooChartQuote {
	close?: number[];
}

interface YahooChartIndicators {
	quote?: YahooChartQuote[];
}

interface YahooChartResult {
	meta?: YahooChartMeta;
	indicators?: YahooChartIndicators;
}

interface YahooChartData {
	chart?: {
		result?: YahooChartResult[];
	};
}

// 1. mimic a real browser to avoid 403 Forbidden
const FETCH_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	Accept:
		"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.5",
	"Cache-Control": "no-cache",
	Pragma: "no-cache",
};

// 2. Helper to fetch from Yahoo Chart API (v8 is more robust than v7/quote)
async function fetchYahooPrice(symbol: string) {
	const url1 = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
	const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

	try {
		// Try primary host
		let res = await fetch(url1, { headers: FETCH_HEADERS });

		// Fallback to secondary host if primary blocked
		if (!res.ok) {
			res = await fetch(url2, { headers: FETCH_HEADERS });
		}

		if (!res.ok) {
			console.error(`Yahoo API Error for ${symbol}: ${res.status}`);
			return null;
		}

		const data = await res.json();
		return extractPrice(data);
	} catch (e) {
		console.error(`Fetch exception for ${symbol}:`, e);
		return null;
	}
}

// 3. Robust Price Extractor
function extractPrice(data: YahooChartData) {
	const result = data.chart?.result?.[0];
	if (!result) return null;

	// Try Live Market Price first
	if (result.meta?.regularMarketPrice) {
		return result.meta.regularMarketPrice;
	}

	// Fallback to last closed candle if market is closed
	const quotes = result.indicators?.quote?.[0];
	if (quotes?.close?.length) {
		const validCloses = quotes.close.filter(
			(c: number) => typeof c === "number",
		);
		if (validCloses.length > 0) {
			return validCloses[validCloses.length - 1];
		}
	}

	return result.meta?.chartPreviousClose || null;
}

export async function GET({ request: _request }: APIEvent) {
	// Fetch in parallel
	// ^TNX = 10 Year Treasury Yield
	// DX=F = US Dollar Index Futures (Streams better than DX-Y.NYB)
	// ZQ=F = 30 Day Fed Funds Futures
	const [us10y, dxy, fedFutures] = await Promise.all([
		fetchYahooPrice("^TNX"),
		fetchYahooPrice("DX=F"),
		fetchYahooPrice("ZQ=F"),
	]);

	// Derived Calculations

	// Implied Rate = 100 - Futures Price (e.g. 95.50 -> 4.50%)
	const impliedFedRate = fedFutures ? 100 - fedFutures : null;

	// Real Rate = 10Y Yield - 2.5% (Approx Inflation Anchor)
	const realRate = us10y ? us10y - 2.5 : null;

	// Return JSON structure expected by frontend
	return json({
		us10y,
		dxy,
		impliedFedRate,
		realRate,
	});
}
