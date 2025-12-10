import {
	type CandlestickData,
	CandlestickSeries,
	createChart,
	type IChartApi,
	type ISeriesApi,
	type LineData,
	LineSeries,
	type UTCTimestamp,
} from "lightweight-charts";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";

type BTCData = CandlestickData<UTCTimestamp>;
type RawKlineData = [number, string, string, string, string];
type Interval = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "12h" | "1d" | "3d" | "1w" | "1M";
export default function BTCChart() {
	let chartContainer: HTMLDivElement | undefined;
	let chart: IChartApi | undefined;
	let candlestickSeries: ISeriesApi<"Candlestick"> | undefined;
	let ema20Series: ISeriesApi<"Line"> | undefined;
	let ema60Series: ISeriesApi<"Line"> | undefined;
	let ema120Series: ISeriesApi<"Line"> | undefined;
	let ema150Series: ISeriesApi<"Line"> | undefined;
	let ema200Series: ISeriesApi<"Line"> | undefined;
	let ws: WebSocket | undefined;
	const [isLoading, setIsLoading] = createSignal(true);
	const [error, setError] = createSignal<string | null>(null);
	// Default to '1d' (Day)
	const [interval, setInterval] = createSignal<Interval>("1h");
	const [indicators, setIndicators] = createSignal<{ ema20: boolean; ema60: boolean; ema120: boolean; ema150: boolean; ema200: boolean }>({
		ema20: false,
		ema60: false,
		ema120: false,
		ema150: false,
		ema200: false,
	});
	const [btcData, setBtcData] = createSignal<BTCData[]>([]);
	const [lastEMA20, setLastEMA20] = createSignal<number | null>(null);
	const [lastEMA60, setLastEMA60] = createSignal<number | null>(null);
	const [lastEMA120, setLastEMA120] = createSignal<number | null>(null);
	const [lastEMA150, setLastEMA150] = createSignal<number | null>(null);
	const [lastEMA200, setLastEMA200] = createSignal<number | null>(null);

	const intervals: { label: string; value: Interval }[] = [
		{ label: "1 Minute", value: "1m" },
		{ label: "3 Minutes", value: "3m" },
		{ label: "5 Minutes", value: "5m" },
		{ label: "15 Minutes", value: "15m" },
		{ label: "30 Minutes", value: "30m" },
		{ label: "1 Hour", value: "1h" },
		{ label: "2 Hours", value: "2h" },
		{ label: "4 Hours", value: "4h" },
		{ label: "12 Hours", value: "12h" },
		{ label: "1 Day", value: "1d" },
		{ label: "3 Days", value: "3d" },
		{ label: "1 Week", value: "1w" },
		{ label: "1 Month", value: "1M" },
	];

	// Calculate EMA
	const calculateEMA = (data: number[], period: number): number[] => {
		const ema: number[] = [];
		const multiplier = 2 / (period + 1);
		let emaValue = data[0];
		ema.push(emaValue);

		for (let i = 1; i < data.length; i++) {
			emaValue = (data[i] - emaValue) * multiplier + emaValue;
			ema.push(emaValue);
		}

		return ema;
	};

	// Fetch historical data from our API proxy
	const fetchHistoricalData = async (
		activeInterval: Interval,
	): Promise<BTCData[]> => {
		try {
			const response = await fetch(`/api/history?interval=${activeInterval}`);

			if (!response.ok) {
				throw new Error(`Failed to fetch: ${response.status}`);
			}

			const data = await response.json();

			if (data.error) throw new Error(data.error);
			if (!Array.isArray(data)) throw new Error("Invalid data format");

			const mappedData = data.map((item: RawKlineData) => ({
				time: Math.floor(item[0] / 1000) as UTCTimestamp,
				open: parseFloat(item[1]),
				high: parseFloat(item[2]),
				low: parseFloat(item[3]),
				close: parseFloat(item[4]),
			}));

			// Sort by time ascending and remove duplicates
			const sortedData = mappedData
				.sort((a, b) => a.time - b.time)
				.filter((item, index, arr) => index === 0 || item.time !== arr[index - 1].time);

			return sortedData;
		} catch (err) {
			console.error("Error fetching history:", err);
			setError("Failed to load chart data");
			return [];
		}
	};

	// Map intervals to Kraken format for WebSocket
	const mapIntervalToKrakenWS = (interval: Interval): string => {
		switch (interval) {
			case "1m": return "1";
			case "3m": return "5"; // Closest: 5m
			case "5m": return "5";
			case "15m": return "15";
			case "30m": return "30";
			case "1h": return "60";
			case "2h": return "240"; // Closest: 4h
			case "4h": return "240";
			case "12h": return "1440"; // Closest: 1d
			case "1d": return "1440";
			case "3d": return "10080"; // Closest: 1w
			case "1w": return "10080";
			case "1M": return "21600";
			default: return "1440"; // Default to 1d
		}
	};

	// Setup WebSocket for live updates
	const connectWebSocket = (activeInterval: Interval) => {
		// Close existing connection if any
		if (ws) {
			ws.close();
		}

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
				if (data.k && candlestickSeries) {
					const kline = data.k;
					const newData: BTCData = {
						time: Math.floor(kline.t / 1000) as UTCTimestamp,
						open: parseFloat(kline.o),
						high: parseFloat(kline.h),
						low: parseFloat(kline.l),
						close: parseFloat(kline.c),
					};
					candlestickSeries.update(newData);

					// Update btcData for indicators
					setBtcData(prev => [...prev, newData]);

					// Update EMAs incrementally
					const currentIndicators = indicators();
					if (currentIndicators.ema20 && lastEMA20() !== null && ema20Series) {
						const currentEMA20 = lastEMA20() as number;
						const multiplier = 2 / (20 + 1);
						const newEMA20 = (newData.close - currentEMA20) * multiplier + currentEMA20;
						setLastEMA20(newEMA20);
						ema20Series.update({ time: newData.time, value: newEMA20 });
					}
					if (currentIndicators.ema60 && lastEMA60() !== null && ema60Series) {
						const currentEMA60 = lastEMA60() as number;
						const multiplier = 2 / (60 + 1);
						const newEMA60 = (newData.close - currentEMA60) * multiplier + currentEMA60;
						setLastEMA60(newEMA60);
						ema60Series.update({ time: newData.time, value: newEMA60 });
					}
					if (currentIndicators.ema120 && lastEMA120() !== null && ema120Series) {
						const currentEMA120 = lastEMA120() as number;
						const multiplier = 2 / (120 + 1);
						const newEMA120 = (newData.close - currentEMA120) * multiplier + currentEMA120;
						setLastEMA120(newEMA120);
						ema120Series.update({ time: newData.time, value: newEMA120 });
					}
					if (currentIndicators.ema150 && lastEMA150() !== null && ema150Series) {
						const currentEMA150 = lastEMA150() as number;
						const multiplier = 2 / (150 + 1);
						const newEMA150 = (newData.close - currentEMA150) * multiplier + currentEMA150;
						setLastEMA150(newEMA150);
						ema150Series.update({ time: newData.time, value: newEMA150 });
					}
					if (currentIndicators.ema200 && lastEMA200() !== null && ema200Series) {
						const currentEMA200 = lastEMA200() as number;
						const multiplier = 2 / (200 + 1);
						const newEMA200 = (newData.close - currentEMA200) * multiplier + currentEMA200;
						setLastEMA200(newEMA200);
						ema200Series.update({ time: newData.time, value: newEMA200 });
					}
				}
			} catch (err) {
				console.error("WebSocket message error:", err);
			}
		};

		ws.onerror = (e) => console.error("WS Error:", e);
	};

	// Main data loader function
	const loadData = async (activeInterval: Interval) => {
		if (!candlestickSeries) return;

		setIsLoading(true);
		setError(null);

		// 1. Load History
		const history = await fetchHistoricalData(activeInterval);
		if (history.length > 0) {
			candlestickSeries.setData(history);
			setBtcData(history);
			// Fit content to show recent data nicely
			chart?.timeScale().fitContent();
		}

		// 2. Connect Live Stream
		connectWebSocket(activeInterval);

		setIsLoading(false);
	};

	onMount(() => {
		if (!chartContainer) return;

		// Initialize Chart
		chart = createChart(chartContainer, {
			layout: {
				background: { color: "#ffffff" },
				textColor: "#333",
			},
			grid: {
				vertLines: { color: "#f0f0f0" },
				horzLines: { color: "#f0f0f0" },
			},
			width: chartContainer.clientWidth,
			height: 420,
			timeScale: {
				timeVisible: true,
				secondsVisible: false,
			},
		});

		candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: "#26a69a",
			downColor: "#ef5350",
			borderVisible: false,
			wickUpColor: "#26a69a",
			wickDownColor: "#ef5350",
		});

		ema20Series = chart.addSeries(LineSeries, {
			color: "#2196F3",
			lineWidth: 2,
		});

		ema60Series = chart.addSeries(LineSeries, {
			color: "#4CAF50",
			lineWidth: 2,
		});

		ema120Series = chart.addSeries(LineSeries, {
			color: "#FF9800",
			lineWidth: 2,
		});

		ema150Series = chart.addSeries(LineSeries, {
			color: "#F44336",
			lineWidth: 2,
		});

		ema200Series = chart.addSeries(LineSeries, {
			color: "#9C27B0",
			lineWidth: 2,
		});

		// Initial Load
		loadData(interval());

		// Handle Resize
		const handleResize = () => {
			if (chart && chartContainer) {
				chart.applyOptions({ width: chartContainer.clientWidth });
			}
		};
		window.addEventListener("resize", handleResize);

		onCleanup(() => {
			if (ws) ws.close();
			if (chart) chart.remove();
			window.removeEventListener("resize", handleResize);
		});
	});

	// React to interval changes
	createEffect(() => {
		const currentInterval = interval();
		// Only reload if chart is already initialized
		if (candlestickSeries) {
			loadData(currentInterval);
		}
	});

	// React to indicators changes
	createEffect(() => {
		const currentIndicators = indicators();
		const currentData = btcData();

		if (currentData.length === 0 || !ema20Series || !ema60Series || !ema120Series || !ema150Series || !ema200Series) return;

		const closes = currentData.map(d => d.close);

		if (currentIndicators.ema20) {
			if (closes.length >= 20) {
				const ema20Values = calculateEMA(closes, 20);
				const ema20Data: LineData[] = currentData.map((d, i) => ({
					time: d.time,
					value: ema20Values[i],
				}));
				ema20Series.setData(ema20Data);
				setLastEMA20(ema20Values[ema20Values.length - 1]);
			} else {
				ema20Series.setData([]);
				setLastEMA20(null);
			}
		} else {
			ema20Series.setData([]);
			setLastEMA20(null);
		}

		if (currentIndicators.ema60) {
			if (closes.length >= 60) {
				const ema60Values = calculateEMA(closes, 60);
				const ema60Data: LineData[] = currentData.map((d, i) => ({
					time: d.time,
					value: ema60Values[i],
				}));
				ema60Series.setData(ema60Data);
				setLastEMA60(ema60Values[ema60Values.length - 1]);
			} else {
				ema60Series.setData([]);
				setLastEMA60(null);
			}
		} else {
			ema60Series.setData([]);
			setLastEMA60(null);
		}

		if (currentIndicators.ema120) {
			if (closes.length >= 120) {
				const ema120Values = calculateEMA(closes, 120);
				const ema120Data: LineData[] = currentData.map((d, i) => ({
					time: d.time,
					value: ema120Values[i],
				}));
				ema120Series.setData(ema120Data);
				setLastEMA120(ema120Values[ema120Values.length - 1]);
			} else {
				ema120Series.setData([]);
				setLastEMA120(null);
			}
		} else {
			ema120Series.setData([]);
			setLastEMA120(null);
		}

		if (currentIndicators.ema150) {
			if (closes.length >= 150) {
				const ema150Values = calculateEMA(closes, 150);
				const ema150Data: LineData[] = currentData.map((d, i) => ({
					time: d.time,
					value: ema150Values[i],
				}));
				ema150Series.setData(ema150Data);
				setLastEMA150(ema150Values[ema150Values.length - 1]);
			} else {
				ema150Series.setData([]);
				setLastEMA150(null);
			}
		} else {
			ema150Series.setData([]);
			setLastEMA150(null);
		}

		if (currentIndicators.ema200) {
			if (closes.length >= 200) {
				const ema200Values = calculateEMA(closes, 200);
				const ema200Data: LineData[] = currentData.map((d, i) => ({
					time: d.time,
					value: ema200Values[i],
				}));
				ema200Series.setData(ema200Data);
				setLastEMA200(ema200Values[ema200Values.length - 1]);
			} else {
				ema200Series.setData([]);
				setLastEMA200(null);
			}
		} else {
			ema200Series.setData([]);
			setLastEMA200(null);
		}
	});

	return (
		<div class="my-8 bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
			<div class="flex justify-between items-center p-4 border-b border-gray-100">
				<h2 class="text-xl font-medium text-gray-800 m-0">Bitcoin (BTC/USDT)</h2>
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2 text-sm">
						<span>Indicators:</span>
						<label class="flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								checked={indicators().ema20}
								onChange={(e) => setIndicators(prev => ({ ...prev, ema20: e.target.checked }))}
								class="m-0"
							/>
							EMA 20
						</label>
						<label class="flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								checked={indicators().ema60}
								onChange={(e) => setIndicators(prev => ({ ...prev, ema60: e.target.checked }))}
								class="m-0"
							/>
							EMA 60
						</label>
						<label class="flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								checked={indicators().ema120}
								onChange={(e) => setIndicators(prev => ({ ...prev, ema120: e.target.checked }))}
								class="m-0"
							/>
							EMA 120
						</label>
						<label class="flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								checked={indicators().ema150}
								onChange={(e) => setIndicators(prev => ({ ...prev, ema150: e.target.checked }))}
								class="m-0"
							/>
							EMA 150
						</label>
						<label class="flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								checked={indicators().ema200}
								onChange={(e) => setIndicators(prev => ({ ...prev, ema200: e.target.checked }))}
								class="m-0"
							/>
							EMA 200
						</label>
					</div>
					<div class="flex gap-2">
						{intervals.map((opt) => (
							<button
								type="button"
								class={`px-3 py-1 border border-gray-300 bg-gray-50 rounded text-sm cursor-pointer transition-all hover:bg-gray-100 ${interval() === opt.value ? "bg-gray-800 text-white border-gray-800" : ""}`}
								onClick={() => setInterval(opt.value)}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>
			</div>

			<div class="relative h-[420px]">
				{isLoading() && <div class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10 font-medium">Loading data...</div>}
				{error() && <div class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10 font-medium text-red-500">{error()}</div>}
				<div ref={chartContainer} class="w-full h-full" />
			</div>

		</div>
	);
}
