import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
} from "solid-js";
import {
	calculateEMA,
	calculateSMA,
	findLastSwingHigh,
	findLastSwingLow,
} from "../lib/indicators";
import { globalStore } from "../lib/store";

// Types matching BTCChart
interface CandlestickData {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
}

type RawKlineData = [number, number, number, number, number, number];

interface AssetTriggerConfig {
	ticker: string;
	krakenId: string;
	role: string;
	strategy: string;
	interval: "1d" | "1w";
	entryLabel: string;
	stopLossLabel: string; // Renamed from exitLabel
	takeProfitLabel: string; // New
}

const TITAN_ASSETS: AssetTriggerConfig[] = [
	{
		ticker: "BTC",
		krakenId: "XBT",
		role: "Master Switch",
		strategy: "Macro Trend",
		interval: "1w",
		entryLabel: "Weekly Close > 21 EMA",
		stopLossLabel: "Weekly Close < 21 EMA",
		takeProfitLabel: "Weekly Close < 21 EMA",
	},
	{
		ticker: "SOL",
		krakenId: "SOL",
		role: "Core",
		strategy: "Structure",
		interval: "1d",
		entryLabel: "Break > 50D MA & Swing High",
		stopLossLabel: "Daily Close < 50 SMA",
		takeProfitLabel: "Daily Close < 20 SMA",
	},
	{
		ticker: "SUI",
		krakenId: "SUI",
		role: "Vanguard",
		strategy: "Momentum",
		interval: "1d",
		entryLabel: "Break 20-Day High",
		stopLossLabel: "Daily Close < 10 EMA",
		takeProfitLabel: "Daily Close < 10 EMA",
	},
	{
		ticker: "PEPE",
		krakenId: "PEPE",
		role: "Berserker",
		strategy: "Momentum",
		interval: "1d",
		entryLabel: "Break 20-Day High",
		stopLossLabel: "Daily Close < 10 EMA",
		takeProfitLabel: "Free Ride + Trail 10 EMA",
	},
	{
		ticker: "TAO",
		krakenId: "TAO",
		role: "Anchor",
		strategy: "Structure",
		interval: "1d",
		entryLabel: "Break > 50D MA & Swing High",
		stopLossLabel: "Daily Close < 50 SMA",
		takeProfitLabel: "Daily Close < 20 SMA",
	},
	{
		ticker: "RENDER",
		krakenId: "RENDER",
		role: "Berserker",
		strategy: "Momentum",
		interval: "1d",
		entryLabel: "Break 20-Day High",
		stopLossLabel: "Daily Close < 10 EMA",
		takeProfitLabel: "Free Ride + Trail 10 EMA",
	},
	{
		ticker: "ONDO",
		krakenId: "ONDO",
		role: "The Insider",
		strategy: "Structure",
		interval: "1d",
		entryLabel: "Break > 50D MA & Swing High",
		stopLossLabel: "Daily Close < 50 SMA",
		takeProfitLabel: "Daily Close < 20 SMA",
	},
	{
		ticker: "KAS",
		krakenId: "KAS",
		role: "The Cult",
		strategy: "Structure",
		interval: "1d",
		entryLabel: "Break > 100D MA",
		stopLossLabel: "Break Prev. Swing Low",
		takeProfitLabel: "Daily Close < 50 SMA",
	},
	{
		ticker: "VIRTUAL",
		krakenId: "VIRTUAL",
		role: "Berserker",
		strategy: "Momentum",
		interval: "1d",
		entryLabel: "Break 20-Day High",
		stopLossLabel: "Daily Close < 10 EMA",
		takeProfitLabel: "Free Ride + Trail 10 EMA",
	},
];

const fetchHistory = async (
	symbol: string,
	interval: string,
	currency: string,
): Promise<CandlestickData[]> => {
	try {
		console.log(`[Titan] Fetching ${symbol} ${interval} in ${currency}...`);
		const res = await fetch(
			`/api/history?interval=${interval}&symbol=${symbol}&currency=${currency}`,
		);
		const json = await res.json();
		if (json.error) {
			console.error(`[Titan] Error fetching ${symbol}:`, json.error);
			return [];
		}
		if (!Array.isArray(json)) {
			console.warn(`[Titan] Invalid format for ${symbol}`, json);
			return [];
		}

		console.log(`[Titan] Fetched ${symbol}: ${json.length} candles`);
		return json
			.map((item: RawKlineData) => ({
				time: Math.floor(item[0] / 1000),
				open: item[1],
				high: item[2],
				low: item[3],
				close: item[4],
			}))
			.sort((a, b) => a.time - b.time);
	} catch (e) {
		console.error(`[Titan] Failed to fetch ${symbol}`, e);
		return [];
	}
};

export default function TitanTriggers() {
	const { currency, portfolio } = globalStore;

	const [assetData, setAssetData] = createSignal<
		Record<string, CandlestickData[]>
	>({});
	const [loadingMap, setLoadingMap] = createSignal<Record<string, boolean>>({});

	let ws: WebSocket | undefined;

	// Reactive Data Fetcher
	createEffect(async () => {
		const cur = currency(); // dependency
		const initialMap: Record<string, boolean> = {};
		for (const a of TITAN_ASSETS) {
			initialMap[a.ticker] = true;
		}
		setLoadingMap(initialMap);

		// Sequential Fetch
		for (const asset of TITAN_ASSETS) {
			const data = await fetchHistory(asset.ticker, asset.interval, cur);
			// Verify we are still on the same currency request (basic race check)
			if (currency() !== cur) return;

			setAssetData((prev) => ({ ...prev, [asset.ticker]: data }));
			setLoadingMap((prev) => ({ ...prev, [asset.ticker]: false }));
			await new Promise((r) => setTimeout(r, 600)); // Rate limit
		}

		// Reconnect WS
		connectWebSocket(cur);
	});

	onCleanup(() => {
		if (ws) ws.close();
	});

	const connectWebSocket = (cur: string) => {
		if (ws) ws.close();
		ws = new WebSocket("wss://ws.kraken.com");

		ws.onopen = () => {
			console.log(`[Titan] WS Connected (${cur})`);

			// Subscribe to 1w for BTC
			ws?.send(
				JSON.stringify({
					event: "subscribe",
					pair: [`XBT/${cur}`],
					subscription: { name: "ohlc", interval: 10080 },
				}),
			);

			// Subscribe to 1d for others
			const dailyPairs = TITAN_ASSETS.filter((a) => a.ticker !== "BTC").map(
				(a) => `${a.krakenId}/${cur}`,
			);

			if (dailyPairs.length > 0) {
				ws?.send(
					JSON.stringify({
						event: "subscribe",
						pair: dailyPairs,
						subscription: { name: "ohlc", interval: 1440 },
					}),
				);
			}
		};

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (Array.isArray(data) && data[1]) {
					const pair = data[data.length - 1]; // e.g. XBT/USD or XXBTZEUR
					const kline = data[1];

					// Normalize pair name might be needed if Kraken returns convoluted names like XXBTZEUR
					// Simplest check: iterate our assets and check if string includes ID and Currency
					const asset = TITAN_ASSETS.find(
						(a) => pair.includes(a.krakenId) && pair.includes(cur),
					);

					if (!asset) return;

					const newCandle: CandlestickData = {
						time: Math.floor(parseFloat(kline[1])), // etime
						open: parseFloat(kline[2]),
						high: parseFloat(kline[3]),
						low: parseFloat(kline[4]),
						close: parseFloat(kline[5]),
					};

					setAssetData((prev) => {
						const currentArr = prev[asset.ticker] || [];
						if (currentArr.length === 0) return prev;

						const last = currentArr[currentArr.length - 1];
						const newArr = [...currentArr];
						newArr[newArr.length - 1] = {
							...last,
							...newCandle,
							time: last.time,
						};

						return { ...prev, [asset.ticker]: newArr };
					});
				}
			} catch {
				// ignore
			}
		};
	};

	const checkTriggers = (ticker: string) => {
		const data = assetData()[ticker];
		const isLoading = loadingMap()[ticker];
		const userAsset = portfolio()[ticker];

		if (isLoading)
			return {
				entry: false,
				stop: false,
				takeProfit: false,
				freeRide: false,
				loading: true,
				error: false,
			};
		if (!data || data.length < 55)
			// Increased req length for 50SMA
			return {
				entry: false,
				stop: false,
				takeProfit: false,
				freeRide: false,
				loading: false,
				error: true,
			};

		const closes = data.map((d) => d.close);
		const highs = data.map((d) => d.high);
		const lows = data.map((d) => d.low);
		const currentPrice = closes[closes.length - 1];

		let entry = false;
		let stop = false;
		let takeProfit = false;
		let freeRide = false;

		// Free Ride Check (2x Gain)
		if (userAsset && userAsset.averageBuyPrice > 0) {
			if (currentPrice >= 2 * userAsset.averageBuyPrice) {
				freeRide = true;
			}
		}

		switch (ticker) {
			case "BTC": {
				const ema21 = calculateEMA(closes, 21);
				const lastEMA = ema21[ema21.length - 1];
				if (lastEMA) {
					entry = currentPrice > lastEMA;
					stop = currentPrice < lastEMA;
					takeProfit = currentPrice < lastEMA; // Same for BTC
				}
				break;
			}
			case "SOL":
			case "TAO":
			case "ONDO": {
				const sma50 = calculateSMA(closes, 50);
				const sma20 = calculateSMA(closes, 20); // For Trail Stop
				const lastSMA50 = sma50[sma50.length - 1];
				const lastSMA20 = sma20[sma20.length - 1];

				const swingHigh = findLastSwingHigh(highs, 10, 2);
				const breakSwingHigh = swingHigh ? currentPrice > swingHigh : false;

				if (lastSMA50) {
					entry = currentPrice > lastSMA50 && breakSwingHigh;
					stop = currentPrice < lastSMA50;
				}
				if (lastSMA20) {
					takeProfit = currentPrice < lastSMA20;
				}
				break;
			}
			case "SUI":
			case "PEPE":
			case "RENDER":
			case "VIRTUAL": {
				// Entry: Break 20D High
				const last20Candles = highs.slice(-21, -1);
				const prev20High =
					last20Candles.length > 0 ? Math.max(...last20Candles) : Infinity;
				entry = currentPrice > prev20High;

				// Stop: Close < 10 EMA
				const ema10 = calculateEMA(closes, 10);
				const lastEMA10 = ema10[ema10.length - 1];
				if (lastEMA10) {
					stop = currentPrice < lastEMA10;
					takeProfit = currentPrice < lastEMA10; // For Free Ride, trail 10 EMA
				}
				break;
			}
			case "KAS": {
				const sma100 = calculateSMA(closes, 100);
				const sma50 = calculateSMA(closes, 50); // TP
				const lastSMA100 = sma100[sma100.length - 1];
				const lastSMA50 = sma50[sma50.length - 1];

				const swingLow = findLastSwingLow(lows, 10, 2);

				if (lastSMA100) entry = currentPrice > lastSMA100;
				stop = swingLow ? currentPrice < swingLow : false;
				if (lastSMA50) takeProfit = currentPrice < lastSMA50;
				break;
			}
		}

		return { entry, stop, takeProfit, freeRide, loading: false, error: false };
	};

	return (
		<div class="space-y-6">
			<div class="flex items-center gap-4 flex-wrap">
				<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em]">
					TITAN_09_PROTOCOL
				</span>
				<div class="h-px grow bg-white/5"></div>

				<a
					href="/profile"
					class="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] hover:text-indigo-400 transition-colors"
				>
					[MY PORTFOLIO]
				</a>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-left border-collapse">
					<thead>
						<tr class="border-b border-white/5 text-[10px] uppercase text-slate-500 tracking-widest bg-white/5">
							<th class="py-4 px-4 font-bold">Ticker</th>
							<th class="py-4 px-4 font-bold">Role</th>
							<th class="py-4 px-4 font-bold">Strategy</th>
							<th class="py-4 px-4 font-bold text-center">Entry Trigger</th>
							<th class="py-4 px-4 font-bold text-center">Stop Loss</th>
							<th class="py-4 px-4 font-bold text-center">Take Profit</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/5">
						<For each={TITAN_ASSETS}>
							{(asset) => {
								const status = createMemo(() => checkTriggers(asset.ticker));

								return (
									<tr class="hover:bg-white/5 transition-colors">
										<td class="py-4 px-4 font-bold text-white">
											{asset.ticker}
										</td>
										<td class="py-4 px-4 text-xs text-slate-400">
											{asset.role}
										</td>
										<td class="py-4 px-4 text-xs text-slate-400">
											{asset.strategy}
										</td>

										{/* Entry Trigger */}
										<td class="py-4 px-4 text-center">
											<div class="flex flex-col items-center gap-1">
												<div
													class={`w-2 h-2 rounded-full ${status().loading ? "bg-slate-700 animate-pulse" : status().error ? "bg-amber-500/50" : status().entry ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-slate-700"}`}
													title={
														status().error
															? "Insufficient Data"
															: asset.entryLabel
													}
												></div>
												<span
													class="text-[9px] text-slate-500 uppercase tracking-wide max-w-[120px] truncate"
													title={asset.entryLabel}
												>
													{asset.entryLabel}
												</span>
											</div>
										</td>

										{/* Stop Loss (Prev Exit) */}
										<td class="py-4 px-4 text-center">
											<div class="flex flex-col items-center gap-1">
												<div
													class={`w-2 h-2 rounded-full ${status().loading ? "bg-slate-700 animate-pulse" : status().error ? "bg-amber-500/50" : status().stop ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" : "bg-slate-700"}`}
													title={
														status().error
															? "Insufficient Data"
															: asset.stopLossLabel
													}
												></div>
												<span
													class="text-[9px] text-slate-500 uppercase tracking-wide max-w-[120px] truncate"
													title={asset.stopLossLabel}
												>
													{asset.stopLossLabel}
												</span>
											</div>
										</td>

										{/* Take Profit (New) */}
										<td class="py-4 px-4 text-center">
											<div class="flex flex-col items-center gap-1">
												<div
													class={`w-2 h-2 rounded-full ${
														status().loading
															? "bg-slate-700 animate-pulse"
															: status().error
																? "bg-amber-500/50"
																: status().freeRide
																	? "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] animate-pulse" // Free Ride Priority
																	: status().takeProfit
																		? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
																		: "bg-slate-700"
													}`}
													title={
														status().error
															? "Insufficient Data"
															: status().freeRide
																? "Free Ride Active (2x Gain Reached!)"
																: asset.takeProfitLabel
													}
												></div>
												<span
													class="text-[9px] text-slate-500 uppercase tracking-wide max-w-[120px] truncate"
													title={asset.takeProfitLabel}
												>
													{status().freeRide
														? "2X GAIN REACHED"
														: asset.takeProfitLabel}
												</span>
											</div>
										</td>
									</tr>
								);
							}}
						</For>
					</tbody>
				</table>
			</div>
		</div>
	);
}
