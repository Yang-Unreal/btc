import { createMemo, createSignal, For, onCleanup, onMount } from "solid-js";
import {
	calculateEMA,
	calculateSMA,
	findLastSwingHigh,
	findLastSwingLow,
} from "../lib/indicators";

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
	krakenId: string; // Added for WS
	role: string;
	strategy: string;
	interval: "1d" | "1w"; // BTC uses Weekly
	entryLabel: string;
	exitLabel: string;
}

const TITAN_ASSETS: AssetTriggerConfig[] = [
	{
		ticker: "BTC",
		krakenId: "XBT",
		role: "Master Switch",
		strategy: "Macro Trend",
		interval: "1w",
		entryLabel: "Weekly Close > 21 EMA",
		exitLabel: "Weekly Close < 21 EMA",
	},
	{
		ticker: "SOL",
		krakenId: "SOL",
		role: "Core",
		strategy: "Structure",
		interval: "1d",
		entryLabel: "Break > 50D MA & Swing High",
		exitLabel: "Break < 50D MA",
	},
	{
		ticker: "SUI",
		krakenId: "SUI",
		role: "Vanguard",
		strategy: "Momentum",
		interval: "1d",
		entryLabel: "Break 20-Day High",
		exitLabel: "Break < 10D MA",
	},
	{
		ticker: "PEPE",
		krakenId: "PEPE",
		role: "Berserker",
		strategy: "Momentum",
		interval: "1d",
		entryLabel: "Break 20-Day High",
		exitLabel: "Break < 10D MA",
	},
	{
		ticker: "TAO",
		krakenId: "TAO",
		role: "Anchor",
		strategy: "Structure",
		interval: "1d",
		entryLabel: "Break > 50D MA & Swing High",
		exitLabel: "Break < 50D MA",
	},
	{
		ticker: "RENDER",
		krakenId: "RENDER",
		role: "Berserker",
		strategy: "Momentum",
		interval: "1d",
		entryLabel: "Break 20-Day High",
		exitLabel: "Break < 10D MA",
	},
	{
		ticker: "ONDO",
		krakenId: "ONDO",
		role: "The Insider",
		strategy: "Structure",
		interval: "1d",
		entryLabel: "Break > 50D MA & Swing High",
		exitLabel: "Break < 50D MA",
	},
	{
		ticker: "KAS",
		krakenId: "KAS",
		role: "The Cult",
		strategy: "Structure",
		interval: "1d",
		entryLabel: "Break > 100D MA",
		exitLabel: "Break < Swing Low",
	},
	{
		ticker: "VIRTUAL",
		krakenId: "VIRTUAL",
		role: "Berserker",
		strategy: "Momentum",
		interval: "1d",
		entryLabel: "Break 20-Day High",
		exitLabel: "Break < 10D MA",
	},
];

const fetchHistory = async (
	symbol: string,
	interval: string,
): Promise<CandlestickData[]> => {
	try {
		console.log(`[Titan] Fetching ${symbol} ${interval}...`);
		const res = await fetch(
			`/api/history?interval=${interval}&symbol=${symbol}&currency=USD`,
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
	const [assetData, setAssetData] = createSignal<
		Record<string, CandlestickData[]>
	>({});
	const [loadingMap, setLoadingMap] = createSignal<Record<string, boolean>>({});

	let ws: WebSocket | undefined;

	onMount(async () => {
		// Initial Load
		const initialMap: Record<string, boolean> = {};
		for (const a of TITAN_ASSETS) {
			initialMap[a.ticker] = true;
		}
		setLoadingMap(initialMap);

		const newData: Record<string, CandlestickData[]> = {};

		// Sequential Fetch to avoid Rate Limiting
		for (const asset of TITAN_ASSETS) {
			const data = await fetchHistory(asset.ticker, asset.interval);
			newData[asset.ticker] = data;
			setLoadingMap((prev) => ({ ...prev, [asset.ticker]: false }));

			// Incremental update so user sees progress
			setAssetData((prev) => ({ ...prev, [asset.ticker]: data }));

			// Delay between requests
			await new Promise((r) => setTimeout(r, 600));
		}

		// Connect WS
		connectWebSocket();
	});

	onCleanup(() => {
		if (ws) ws.close();
	});

	const connectWebSocket = () => {
		if (ws) ws.close();
		ws = new WebSocket("wss://ws.kraken.com");

		ws.onopen = () => {
			console.log("[Titan] WS Connected");

			// Subscribe to 1w for BTC
			ws?.send(
				JSON.stringify({
					event: "subscribe",
					pair: ["XBT/USD"],
					subscription: { name: "ohlc", interval: 10080 },
				}),
			);

			// Subscribe to 1d for others
			const dailyPairs = TITAN_ASSETS.filter((a) => a.ticker !== "BTC").map(
				(a) => `${a.krakenId}/USD`,
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

					const asset = TITAN_ASSETS.find((a) => `${a.krakenId}/USD` === pair);
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

		if (isLoading)
			return { entry: false, exit: false, loading: true, error: false };
		if (!data || data.length < 20)
			return { entry: false, exit: false, loading: false, error: true }; // Insufficient data

		const closes = data.map((d) => d.close);
		const highs = data.map((d) => d.high);
		const lows = data.map((d) => d.low);
		const currentPrice = closes[closes.length - 1];

		let entry = false;
		let exit = false;

		switch (ticker) {
			case "BTC": {
				const ema21 = calculateEMA(closes, 21);
				const lastEMA = ema21[ema21.length - 1];
				if (lastEMA) {
					entry = currentPrice > lastEMA;
					exit = currentPrice < lastEMA;
				}
				break;
			}
			case "SOL":
			case "TAO":
			case "ONDO": {
				const sma50 = calculateSMA(closes, 50);
				const lastSMA50 = sma50[sma50.length - 1];

				const swingHigh = findLastSwingHigh(highs, 10, 2);
				const breakSwingHigh = swingHigh ? currentPrice > swingHigh : false;

				if (lastSMA50) {
					entry = currentPrice > lastSMA50 && breakSwingHigh;
					exit = currentPrice < lastSMA50;
				}
				break;
			}
			case "SUI":
			case "PEPE":
			case "RENDER":
			case "VIRTUAL": {
				const last20Candles = highs.slice(-21, -1);
				const prev20High =
					last20Candles.length > 0 ? Math.max(...last20Candles) : Infinity;

				const sma10 = calculateSMA(closes, 10);
				const lastSMA10 = sma10[sma10.length - 1];

				entry = currentPrice > prev20High;
				if (lastSMA10) exit = currentPrice < lastSMA10;
				break;
			}
			case "KAS": {
				const sma100 = calculateSMA(closes, 100);
				const lastSMA100 = sma100[sma100.length - 1];
				const swingLow = findLastSwingLow(lows, 10, 2);

				if (lastSMA100) entry = currentPrice > lastSMA100;
				exit = swingLow ? currentPrice < swingLow : false;
				break;
			}
		}

		return { entry, exit, loading: false, error: false };
	};

	return (
		<div class="space-y-6">
			<div class="flex items-center gap-4 flex-wrap">
				<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em]">
					TITAN_09_PROTOCOL
				</span>
				<div class="h-px grow bg-white/5"></div>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-left border-collapse">
					<thead>
						<tr class="border-b border-white/5 text-[10px] uppercase text-slate-500 tracking-widest bg-white/5">
							<th class="py-4 px-4 font-bold">Ticker</th>
							<th class="py-4 px-4 font-bold">Role</th>
							<th class="py-4 px-4 font-bold">Strategy</th>
							<th class="py-4 px-4 font-bold text-center">Entry Trigger</th>
							<th class="py-4 px-4 font-bold text-center">Exit Trigger</th>
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

										{/* Exit Trigger */}
										<td class="py-4 px-4 text-center">
											<div class="flex flex-col items-center gap-1">
												<div
													class={`w-2 h-2 rounded-full ${status().loading ? "bg-slate-700 animate-pulse" : status().error ? "bg-amber-500/50" : status().exit ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" : "bg-slate-700"}`}
													title={
														status().error
															? "Insufficient Data"
															: asset.exitLabel
													}
												></div>
												<span
													class="text-[9px] text-slate-500 uppercase tracking-wide max-w-[120px] truncate"
													title={asset.exitLabel}
												>
													{asset.exitLabel}
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
