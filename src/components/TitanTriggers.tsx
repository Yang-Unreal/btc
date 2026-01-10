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
	allocation: string; // New: Left vs Right split
	strategy: string; // Right-Side Strategy Name
	interval: "1d" | "1w";
	entryLabel: string;
	exitLabel: string; // Combined Stop/Take Profit based on Matrix
}

const TITAN_ASSETS: AssetTriggerConfig[] = [
	{
		ticker: "BTC",
		krakenId: "XBT",
		role: "Master Switch",
		allocation: "80% Left / 20% Right",
		strategy: "Heavy Add",
		interval: "1w",
		entryLabel: "Weekly Close > 21 EMA",
		exitLabel: "Weekly Close < 21 EMA",
	},
	{
		ticker: "SOL",
		krakenId: "SOL",
		role: "Core",
		allocation: "60% Left / 40% Right",
		strategy: "Breakout Buy",
		interval: "1d",
		entryLabel: "Daily Close > 50 SMA",
		exitLabel: "Daily Close < 20 SMA",
	},
	{
		ticker: "ONDO",
		krakenId: "ONDO",
		role: "The Insider",
		allocation: "60% Left / 40% Right",
		strategy: "Breakout Buy",
		interval: "1d",
		entryLabel: "Daily Close > 50 SMA",
		exitLabel: "Daily Close < 20 SMA",
	},
	{
		ticker: "KAS",
		krakenId: "KAS",
		role: "The Cult",
		allocation: "60% Left / 40% Right",
		strategy: "Breakout Buy",
		interval: "1d",
		entryLabel: "Daily Close > 100 SMA",
		exitLabel: "Daily Close < 50 SMA",
	},
	{
		ticker: "TAO",
		krakenId: "TAO",
		role: "Anchor (AI)",
		allocation: "30% Left / 70% Right",
		strategy: "Breakout Buy",
		interval: "1d",
		entryLabel: "Close > 50 SMA + Prev High",
		exitLabel: "Daily Close < 20 SMA",
	},
	{
		ticker: "SUI",
		krakenId: "SUI",
		role: "Vanguard",
		allocation: "20% Left / 80% Right",
		strategy: "Aggressive Buy",
		interval: "1d",
		entryLabel: "Break > 20-Day High",
		exitLabel: "Daily Close < 10 EMA",
	},
	{
		ticker: "RENDER",
		krakenId: "RENDER",
		role: "Berserker",
		allocation: "30% Left / 70% Right",
		strategy: "Aggressive Buy",
		interval: "1d",
		entryLabel: "Break > 20-Day High",
		exitLabel: "Trail 10 EMA (Free Ride)",
	},
	{
		ticker: "PEPE",
		krakenId: "PEPE",
		role: "Berserker",
		allocation: "0% Left / 100% Right",
		strategy: "Aggressive Buy",
		interval: "1d",
		entryLabel: "Break > 20-Day High",
		exitLabel: "Trail 10 EMA (Free Ride)",
	},
	{
		ticker: "VIRTUAL",
		krakenId: "VIRTUAL",
		role: "Berserker",
		allocation: "0% Left / 100% Right",
		strategy: "Aggressive Buy",
		interval: "1d",
		entryLabel: "Break > 20-Day High",
		exitLabel: "Trail 10 EMA (Free Ride)",
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
		const cur = currency();
		const initialMap: Record<string, boolean> = {};
		for (const a of TITAN_ASSETS) {
			initialMap[a.ticker] = true;
		}
		setLoadingMap(initialMap);

		for (const asset of TITAN_ASSETS) {
			const data = await fetchHistory(asset.ticker, asset.interval, cur);
			if (currency() !== cur) return;

			setAssetData((prev) => ({ ...prev, [asset.ticker]: data }));
			setLoadingMap((prev) => ({ ...prev, [asset.ticker]: false }));
			await new Promise((r) => setTimeout(r, 600));
		}

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
			ws?.send(
				JSON.stringify({
					event: "subscribe",
					pair: [`XBT/${cur}`],
					subscription: { name: "ohlc", interval: 10080 },
				}),
			);

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
					const pair = data[data.length - 1];
					const kline = data[1];
					const asset = TITAN_ASSETS.find(
						(a) => pair.includes(a.krakenId) && pair.includes(cur),
					);

					if (!asset) return;

					const newCandle: CandlestickData = {
						time: Math.floor(parseFloat(kline[1])),
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
				exit: false,
				freeRide: false,
				loading: true,
				error: false,
			};
		if (!data || data.length < 105)
			return {
				entry: false,
				exit: false,
				freeRide: false,
				loading: false,
				error: true,
			};

		const closes = data.map((d) => d.close);
		const highs = data.map((d) => d.high);
		const currentPrice = closes[closes.length - 1];

		let entry = false;
		let exit = false; // Combined Stop/TP
		let freeRide = false;

		// 2x Gain Check (Free Ride Status)
		if (userAsset && userAsset.averageBuyPrice > 0) {
			if (currentPrice >= 2 * userAsset.averageBuyPrice) {
				freeRide = true;
			}
		}

		switch (ticker) {
			case "BTC": {
				// Entry: > 21 EMA. Exit: < 21 EMA
				const ema21 = calculateEMA(closes, 21);
				const lastEMA = ema21[ema21.length - 1];
				if (lastEMA && !Number.isNaN(lastEMA)) {
					entry = currentPrice > lastEMA;
					exit = currentPrice < lastEMA;
				}
				break;
			}
			case "SOL":
			case "ONDO": {
				// Image: Entry > 50 SMA. Exit < 20 SMA.
				const sma50 = calculateSMA(closes, 50);
				const sma20 = calculateSMA(closes, 20);
				const lastSMA50 = sma50[sma50.length - 1];
				const lastSMA20 = sma20[sma20.length - 1];

				if (lastSMA50 && !Number.isNaN(lastSMA50))
					entry = currentPrice > lastSMA50;
				if (lastSMA20 && !Number.isNaN(lastSMA20))
					exit = currentPrice < lastSMA20;
				break;
			}
			case "TAO": {
				// Image: Entry > 50 SMA AND > Prev High. Exit < 20 SMA.
				const sma50 = calculateSMA(closes, 50);
				const sma20 = calculateSMA(closes, 20);
				const lastSMA50 = sma50[sma50.length - 1];
				const lastSMA20 = sma20[sma20.length - 1];

				const swingHigh = findLastSwingHigh(highs, 10, 2);
				// We need price to be above BOTH 50 SMA and the Swing High
				if (lastSMA50 && !Number.isNaN(lastSMA50) && swingHigh) {
					entry = currentPrice > lastSMA50 && currentPrice > swingHigh;
				}
				if (lastSMA20 && !Number.isNaN(lastSMA20))
					exit = currentPrice < lastSMA20;
				break;
			}
			case "KAS": {
				// Image: Entry > 100 SMA. Exit < 50 SMA.
				const sma100 = calculateSMA(closes, 100);
				const sma50 = calculateSMA(closes, 50);
				const lastSMA100 = sma100[sma100.length - 1];
				const lastSMA50 = sma50[sma50.length - 1];

				if (lastSMA100 && !Number.isNaN(lastSMA100))
					entry = currentPrice > lastSMA100;
				if (lastSMA50 && !Number.isNaN(lastSMA50))
					exit = currentPrice < lastSMA50;
				break;
			}
			case "SUI":
			case "PEPE":
			case "RENDER":
			case "VIRTUAL": {
				// Image: Entry Break > 20-Day High. Exit < 10 EMA.
				// (For Berserkers, the exit is "Free Ride + Trail 10 EMA")
				const last21Highs = highs.slice(-21, -1); // Previous 20 days excluding current
				const prev20High =
					last21Highs.length > 0 ? Math.max(...last21Highs) : Infinity;

				entry = currentPrice > prev20High;

				const ema10 = calculateEMA(closes, 10);
				const lastEMA10 = ema10[ema10.length - 1];
				if (lastEMA10 && !Number.isNaN(lastEMA10)) {
					exit = currentPrice < lastEMA10;
				}
				break;
			}
		}

		return { entry, exit, freeRide, loading: false, error: false };
	};

	return (
		<div class="space-y-6">
			<div class="flex items-center gap-4 flex-wrap">
				<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em]">
					TITAN_09_MATRIX
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
							<th class="py-4 px-4 font-bold">Allocation (L/R)</th>
							<th class="py-4 px-4 font-bold text-center">Entry Trigger</th>
							<th class="py-4 px-4 font-bold text-center">Exit / Trail</th>
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
											{asset.allocation}
										</td>

										{/* Entry Trigger */}
										<td class="py-4 px-4 text-center">
											<div class="flex flex-col items-center gap-1">
												<div
													class={`w-2 h-2 rounded-full ${
														status().loading
															? "bg-slate-700 animate-pulse"
															: status().error
																? "bg-amber-500/50"
																: status().entry
																	? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
																	: "bg-slate-700"
													}`}
												></div>
												<span class="text-[9px] text-slate-500 uppercase tracking-wide">
													{asset.entryLabel}
												</span>
											</div>
										</td>

										{/* Exit / Take Profit */}
										<td class="py-4 px-4 text-center">
											<div class="flex flex-col items-center gap-1">
												<div
													class={`w-2 h-2 rounded-full ${
														status().loading
															? "bg-slate-700 animate-pulse"
															: status().error
																? "bg-amber-500/50"
																: status().freeRide && !status().exit
																	? "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] animate-pulse"
																	: status().exit
																		? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
																		: "bg-slate-700"
													}`}
												></div>
												<span class="text-[9px] text-slate-500 uppercase tracking-wide">
													{status().freeRide
														? "2X GAIN (RIDE)"
														: asset.exitLabel}
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
