import {
	type CandlestickData,
	CandlestickSeries,
	createChart,
	type IChartApi,
	type ISeriesApi,
	type LineData,
	LineSeries,
	type MouseEventParams,
	type UTCTimestamp,
} from "lightweight-charts";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";

type BTCData = CandlestickData<UTCTimestamp>;
type RawKlineData = [number, string, string, string, string];
type Interval =
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

interface TooltipData {
	x: number;
	y: number;
	time: string;
	open: string;
	high: string;
	low: string;
	close: string;
	changeColor: string;
	ema20?: string;
	ema60?: string;
	ema120?: string;
	ema150?: string;
	ema200?: string;
	snapY: number; // For the magnetic dot
}

export default function BTCChart() {
	let chartContainer: HTMLDivElement | undefined;
	let chart: IChartApi | undefined;
	let candlestickSeries: ISeriesApi<"Candlestick"> | undefined;

	// EMA Series Refs
	let ema20Series: ISeriesApi<"Line"> | undefined;
	let ema60Series: ISeriesApi<"Line"> | undefined;
	let ema120Series: ISeriesApi<"Line"> | undefined;
	let ema150Series: ISeriesApi<"Line"> | undefined;
	let ema200Series: ISeriesApi<"Line"> | undefined;

	let ws: WebSocket | undefined;

	const [isLoading, setIsLoading] = createSignal(true);
	const [error, setError] = createSignal<string | null>(null);
	const [interval, setInterval] = createSignal<Interval>("1h");

	// Tooltip State
	const [tooltip, setTooltip] = createSignal<TooltipData | null>(null);

	const [indicators, setIndicators] = createSignal<Record<string, boolean>>({
		ema20: false,
		ema60: false,
		ema120: false,
		ema150: false,
		ema200: false,
	});

	const [btcData, setBtcData] = createSignal<BTCData[]>([]);

	// Keep track of last EMA values for incremental updates
	const [lastEMA20, setLastEMA20] = createSignal<number | null>(null);
	const [lastEMA60, setLastEMA60] = createSignal<number | null>(null);
	const [lastEMA120, setLastEMA120] = createSignal<number | null>(null);
	const [lastEMA150, setLastEMA150] = createSignal<number | null>(null);
	const [lastEMA200, setLastEMA200] = createSignal<number | null>(null);

	const intervals: { label: string; value: Interval }[] = [
		{ label: "1m", value: "1m" },
		{ label: "5m", value: "5m" },
		{ label: "15m", value: "15m" },
		{ label: "30m", value: "30m" },
		{ label: "1H", value: "1h" },
		{ label: "4H", value: "4h" },
		{ label: "1D", value: "1d" },
		{ label: "1W", value: "1w" },
	];

	// --- EMA Calculation Helper ---
	const calculateEMA = (data: number[], period: number): number[] => {
		if (data.length < period) return [];
		const ema: number[] = [];
		const multiplier = 2 / (period + 1);

		// Simple Moving Average for the first point
		let sum = 0;
		for (let i = 0; i < period; i++) sum += data[i];
		let emaValue = sum / period;

		// Fill initial empty spaces to match data length alignment
		for (let i = 0; i < period - 1; i++) ema.push(NaN); // placeholder

		ema.push(emaValue);

		for (let i = period; i < data.length; i++) {
			emaValue = (data[i] - emaValue) * multiplier + emaValue;
			ema.push(emaValue);
		}

		// We filter out NaNs when mapping to chart data,
		// but returning equal length array helps with indexing
		return ema;
	};

	const fetchHistoricalData = async (
		activeInterval: Interval,
	): Promise<BTCData[]> => {
		try {
			const response = await fetch(`/api/history?interval=${activeInterval}`);
			if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
			const data = await response.json();
			if (data.error) throw new Error(data.error);

			const mappedData = data.map((item: RawKlineData) => ({
				time: Math.floor(item[0] / 1000) as UTCTimestamp,
				open: parseFloat(item[1]),
				high: parseFloat(item[2]),
				low: parseFloat(item[3]),
				close: parseFloat(item[4]),
			}));

			return mappedData
				.sort(
					(a: BTCData, b: BTCData) => (a.time as number) - (b.time as number),
				)
				.filter(
					(item: BTCData, index: number, arr: BTCData[]) =>
						index === 0 || item.time !== arr[index - 1].time,
				);
		} catch (err) {
			console.error("Error fetching history:", err);
			setError("Failed to load chart data");
			return [];
		}
	};

	const mapIntervalToKrakenWS = (interval: Interval): string => {
		const map: Record<string, string> = {
			"1m": "1",
			"3m": "5",
			"5m": "5",
			"15m": "15",
			"30m": "30",
			"1h": "60",
			"2h": "240",
			"4h": "240",
			"12h": "1440",
			"1d": "1440",
			"3d": "10080",
			"1w": "10080",
			"1M": "21600",
		};
		return map[interval] || "1440";
	};

	const connectWebSocket = (activeInterval: Interval) => {
		if (ws) ws.close();
		ws = new WebSocket("wss://ws.kraken.com");

		ws.onopen = () => {
			console.log(`WebSocket connected (${activeInterval})`);
			ws?.send(
				JSON.stringify({
					event: "subscribe",
					pair: ["XBT/USD"],
					subscription: {
						name: "ohlc",
						interval: mapIntervalToKrakenWS(activeInterval),
					},
				}),
			);
		};

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				// Standard Kraken OHLC payload: [channelID, [time, et, o, h, l, c, v, count], channelName, pair]
				if (Array.isArray(data) && data[1] && candlestickSeries) {
					// Handle array format update
					const kline = data[1]; // This is [time, et, o, h, l, c, v, count]
					const timeVal = parseFloat(kline[0]);
					const newData: BTCData = {
						time: Math.floor(timeVal) as UTCTimestamp,
						open: parseFloat(kline[2]),
						high: parseFloat(kline[3]),
						low: parseFloat(kline[4]),
						close: parseFloat(kline[5]),
					};

					candlestickSeries.update(newData);
					setBtcData((prev) => {
						const last = prev[prev.length - 1];
						if (last && last.time === newData.time) {
							// Update last candle
							return [...prev.slice(0, -1), newData];
						}
						// Add new candle
						return [...prev, newData];
					});

					// Simple incremental EMA update (simplified for brevity)
					updateIndicatorRealtime(newData);
				}
			} catch (err) {
				console.error("WebSocket message error:", err);
			}
		};
	};

	const updateIndicatorRealtime = (newData: BTCData) => {
		const current = indicators();
		const updateSeries = (
			series: ISeriesApi<"Line"> | undefined,
			lastVal: number | null,
			setLast: (v: number) => void,
			period: number,
		) => {
			if (series && lastVal !== null) {
				const multiplier = 2 / (period + 1);
				const newVal = (newData.close - lastVal) * multiplier + lastVal;
				setLast(newVal);
				series.update({ time: newData.time, value: newVal });
			}
		};

		if (current.ema20) updateSeries(ema20Series, lastEMA20(), setLastEMA20, 20);
		if (current.ema60) updateSeries(ema60Series, lastEMA60(), setLastEMA60, 60);
		if (current.ema120)
			updateSeries(ema120Series, lastEMA120(), setLastEMA120, 120);
		if (current.ema150)
			updateSeries(ema150Series, lastEMA150(), setLastEMA150, 150);
		if (current.ema200)
			updateSeries(ema200Series, lastEMA200(), setLastEMA200, 200);
	};

	const loadData = async (activeInterval: Interval) => {
		if (!candlestickSeries) return;
		setIsLoading(true);
		setError(null);

		const history = await fetchHistoricalData(activeInterval);
		if (history.length > 0) {
			candlestickSeries.setData(history);
			setBtcData(history);
			chart?.timeScale().fitContent();
		}
		connectWebSocket(activeInterval);
		setIsLoading(false);
	};

	onMount(() => {
		if (!chartContainer) return;

		chart = createChart(chartContainer, {
			layout: { background: { color: "#ffffff" }, textColor: "#333" },
			grid: {
				vertLines: { color: "#f0f0f0" },
				horzLines: { color: "#f0f0f0" },
			},
			width: chartContainer.clientWidth,
			height: 420,
			crosshair: {
				mode: 1, // Magnet mode default
				vertLine: {
					width: 1,
					color: "#9B7DFF",
					style: 3,
					labelBackgroundColor: "#9B7DFF",
				},
				horzLine: {
					color: "#9B7DFF",
					labelBackgroundColor: "#9B7DFF",
				},
			},
			timeScale: { timeVisible: true, secondsVisible: false },
			rightPriceScale: { borderColor: "#dfdfdf" },
		});

		candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: "#26a69a",
			downColor: "#ef5350",
			borderVisible: false,
			wickUpColor: "#26a69a",
			wickDownColor: "#ef5350",
		});

		const createLineSeries = (color: string) =>
			(chart as IChartApi).addSeries(LineSeries, {
				color,
				lineWidth: 2,
				crosshairMarkerVisible: false,
			});

		ema20Series = createLineSeries("#2196F3");
		ema60Series = createLineSeries("#4CAF50");
		ema120Series = createLineSeries("#FF9800");
		ema150Series = createLineSeries("#F44336");
		ema200Series = createLineSeries("#9C27B0");

		// --- CROSSHAIR HANDLER ---
		chart.subscribeCrosshairMove((param: MouseEventParams) => {
			if (!chartContainer || !candlestickSeries) return;
			if (
				param.point === undefined ||
				!param.time ||
				param.point.x < 0 ||
				param.point.x > chartContainer.clientWidth ||
				param.point.y < 0 ||
				param.point.y > chartContainer.clientHeight
			) {
				setTooltip(null);
				return;
			}

			// Get OHLC data
			const candle = param.seriesData.get(candlestickSeries) as
				| BTCData
				| undefined;
			if (!candle) {
				setTooltip(null);
				return;
			}

			// Get EMA data
			const getVal = (series: ISeriesApi<"Line"> | undefined) => {
				const val = series ? param.seriesData.get(series) : undefined;
				return val ? (val as LineData).value.toFixed(2) : undefined;
			};

			const ema20 = indicators().ema20 ? getVal(ema20Series) : undefined;
			const ema60 = indicators().ema60 ? getVal(ema60Series) : undefined;
			const ema120 = indicators().ema120 ? getVal(ema120Series) : undefined;
			const ema150 = indicators().ema150 ? getVal(ema150Series) : undefined;
			const ema200 = indicators().ema200 ? getVal(ema200Series) : undefined;

			// Calculate "Snap" Y coordinate for the magnetic dot (snaps to Close price)
			const snapY = candlestickSeries.priceToCoordinate(candle.close);

			// Format Date
			const dateStr = new Date(Number(param.time) * 1000).toLocaleString(
				"en-US",
				{
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				},
			);

			setTooltip({
				x: param.point.x,
				y: param.point.y,
				time: dateStr,
				open: candle.open.toFixed(2),
				high: candle.high.toFixed(2),
				low: candle.low.toFixed(2),
				close: candle.close.toFixed(2),
				changeColor:
					candle.close >= candle.open ? "text-teal-600" : "text-red-500",
				ema20,
				ema60,
				ema120,
				ema150,
				ema200,
				snapY: snapY ?? param.point.y,
			});
		});

		loadData(interval());

		const handleResize = () => {
			if (chart && chartContainer)
				chart.applyOptions({ width: chartContainer.clientWidth });
		};
		window.addEventListener("resize", handleResize);

		onCleanup(() => {
			if (ws) ws.close();
			if (chart) chart.remove();
			window.removeEventListener("resize", handleResize);
		});
	});

	// Re-calc indicators when data or toggles change
	createEffect(() => {
		const currentData = btcData();
		const currentInd = indicators();
		if (!currentData.length) return;

		const closes = currentData.map((d) => d.close);

		const processEMA = (
			active: boolean,
			series: ISeriesApi<"Line"> | undefined,
			period: number,
			setLast: (n: number) => void,
		) => {
			if (active && series && closes.length >= period) {
				const vals = calculateEMA(closes, period);
				// Map back to data skipping initial NaNs
				const lineData: LineData[] = [];
				for (let i = 0; i < vals.length; i++) {
					if (!Number.isNaN(vals[i])) {
						lineData.push({ time: currentData[i].time, value: vals[i] });
					}
				}
				series.setData(lineData);
				setLast(vals[vals.length - 1]);
			} else if (series) {
				series.setData([]);
				setLast(0); // reset
			}
		};

		processEMA(currentInd.ema20, ema20Series, 20, setLastEMA20);
		processEMA(currentInd.ema60, ema60Series, 60, setLastEMA60);
		processEMA(currentInd.ema120, ema120Series, 120, setLastEMA120);
		processEMA(currentInd.ema150, ema150Series, 150, setLastEMA150);
		processEMA(currentInd.ema200, ema200Series, 200, setLastEMA200);
	});

	// Change Interval Effect
	createEffect(() => {
		if (candlestickSeries) loadData(interval());
	});

	return (
		<div class="my-8 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden font-sans">
			{/* Header */}
			<div class="flex flex-col md:flex-row justify-between items-start md:items-center p-5 border-b border-gray-100 bg-gray-50/50 backdrop-blur-sm">
				<div>
					<h2 class="text-2xl font-bold text-gray-800 tracking-tight">
						Bitcoin{" "}
						<span class="text-gray-400 text-lg font-normal">/ USDT</span>
					</h2>
					<div class="flex gap-2 mt-1 text-xs text-gray-500 font-medium">
						<span>O: {tooltip() ? tooltip()?.open : "---"}</span>
						<span>H: {tooltip() ? tooltip()?.high : "---"}</span>
						<span>L: {tooltip() ? tooltip()?.low : "---"}</span>
						<span>C: {tooltip() ? tooltip()?.close : "---"}</span>
					</div>
				</div>

				<div class="flex flex-col gap-3 mt-4 md:mt-0 items-end">
					{/* Intervals */}
					<div class="flex gap-1 bg-gray-200 p-1 rounded-lg">
						{intervals.map((opt) => (
							<button
								type="button"
								class={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${
									interval() === opt.value
										? "bg-white text-gray-900 shadow-sm"
										: "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
								}`}
								onClick={() => setInterval(opt.value)}
							>
								{opt.label}
							</button>
						))}
					</div>

					{/* Indicators */}
					<div class="flex flex-wrap gap-3 text-xs">
						{[20, 60, 120, 150, 200].map((p) => (
							<label class="flex items-center gap-1.5 cursor-pointer group select-none">
								<div
									class={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${
										indicators()[`ema${p}`]
											? "bg-indigo-600 border-indigo-600"
											: "border-gray-400 bg-white"
									}`}
								>
									{/* @ts-ignore */}
									<Show when={indicators()[`ema${p}`]}>
										<svg
											class="w-2 h-2 text-white"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="4"
											role="img"
											aria-label="Selected"
										>
											<title>Selected indicator</title>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M5 13l4 4L19 7"
											/>
										</svg>
									</Show>
								</div>
								<input
									type="checkbox"
									class="hidden"
									checked={indicators()[`ema${p}`] ?? false}
									onChange={(e) =>
										setIndicators((prev) => ({
											...prev,
											[`ema${p}`]: e.target.checked,
										}))
									}
								/>
								<span class="text-gray-600 group-hover:text-indigo-600 transition-colors">
									EMA {p}
								</span>
							</label>
						))}
					</div>
				</div>
			</div>

			{/* Chart Area */}
			<div class="relative h-[420px] w-full group cursor-crosshair">
				{/* Loading / Error States */}
				<Show when={isLoading()}>
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm">
						<div class="flex flex-col items-center gap-2">
							<div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
							<span class="text-sm font-medium text-indigo-900">
								Syncing Market Data...
							</span>
						</div>
					</div>
				</Show>
				<Show when={error()}>
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-white/90">
						<div class="text-red-500 font-medium bg-red-50 px-4 py-2 rounded-lg border border-red-100">
							Error: {error()}
						</div>
					</div>
				</Show>

				{/* Actual Chart Container */}
				<div ref={chartContainer} class="w-full h-full" />

				{/* Floating Tooltip & Magnetic Snap Dot */}
				<Show when={tooltip()}>
					{(t) => (
						<>
							{/* Magnetic Dot Snapped to Candle Close */}
							<div
								class="absolute w-3 h-3 bg-indigo-600 rounded-full border-2 border-white shadow-sm pointer-events-none z-10 transition-transform duration-75 ease-out"
								style={{
									top: "0",
									left: "0",
									transform: `translate(${t().x - 6}px, ${t().snapY - 6}px)`,
								}}
							/>

							{/* Tooltip Card */}
							<div
								class="absolute z-20 pointer-events-none bg-white/95 backdrop-blur-md border border-gray-200/50 shadow-xl rounded-lg p-3 text-xs w-48 transition-all duration-100 ease-out flex flex-col gap-1.5"
								style={{
									top: "0",
									left: "0",
									// Logic to keep tooltip inside chart bounds
									transform: `translate(${Math.min(Math.max(10, t().x + 20), (chartContainer?.clientWidth ?? 800) - 200)}px, ${Math.min(Math.max(10, t().y - 50), 300)}px)`,
								}}
							>
								<div class="text-gray-400 font-medium border-b border-gray-100 pb-1 mb-0.5">
									{t().time}
								</div>

								<div class="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-600">
									<div class="flex justify-between">
										<span>Open</span>{" "}
										<span class="font-mono text-gray-900">{t().open}</span>
									</div>
									<div class="flex justify-between">
										<span>High</span>{" "}
										<span class="font-mono text-gray-900">{t().high}</span>
									</div>
									<div class="flex justify-between">
										<span>Low</span>{" "}
										<span class="font-mono text-gray-900">{t().low}</span>
									</div>
									<div class="flex justify-between">
										<span>Close</span>{" "}
										<span class={`font-mono font-bold ${t().changeColor}`}>
											{t().close}
										</span>
									</div>
								</div>

								{/* EMA Section - Only shows if active */}
								{(t().ema20 ||
									t().ema60 ||
									t().ema120 ||
									t().ema150 ||
									t().ema200) && (
									<div class="border-t border-gray-100 pt-1 mt-0.5 space-y-0.5">
										<Show when={t().ema20}>
											<div class="flex justify-between text-blue-500">
												<span>EMA 20</span>{" "}
												<span class="font-mono">{t().ema20}</span>
											</div>
										</Show>
										<Show when={t().ema60}>
											<div class="flex justify-between text-green-500">
												<span>EMA 60</span>{" "}
												<span class="font-mono">{t().ema60}</span>
											</div>
										</Show>
										<Show when={t().ema120}>
											<div class="flex justify-between text-orange-500">
												<span>EMA 120</span>{" "}
												<span class="font-mono">{t().ema120}</span>
											</div>
										</Show>
										<Show when={t().ema150}>
											<div class="flex justify-between text-red-500">
												<span>EMA 150</span>{" "}
												<span class="font-mono">{t().ema150}</span>
											</div>
										</Show>
										<Show when={t().ema200}>
											<div class="flex justify-between text-purple-500">
												<span>EMA 200</span>{" "}
												<span class="font-mono">{t().ema200}</span>
											</div>
										</Show>
									</div>
								)}
							</div>
						</>
					)}
				</Show>
			</div>
		</div>
	);
}
