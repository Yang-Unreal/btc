import {
	type CandlestickData,
	CandlestickSeries,
	createChart,
	createSeriesMarkers,
	type IChartApi,
	type ISeriesApi,
	type LineData,
	LineSeries,
	type MouseEventParams,
	type SeriesMarker,
	type UTCTimestamp,
} from "lightweight-charts";
import {
	createEffect,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";

type BTCData = CandlestickData<UTCTimestamp>;
type RawKlineData = [number, number, number, number, number];
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

// Enhanced Tooltip Data
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
	rsi?: string;
	fng?: string;
	fngClass?: string;
	// New TD Seq fields
	tdLabel?: string;
	tdColor?: string;
	tdDescription?: string;
	snapY: number;
}

interface FNGData {
	value: string;
	value_classification: string;
	timestamp: string;
}

interface TDState {
	label: string;
	type: "buy" | "sell";
	stage: "setup" | "countdown";
	description: string;
}

interface ISeriesMarkersPrimitive {
	setMarkers(markers: SeriesMarker<UTCTimestamp>[]): void;
}

// Icons for UI
const IconPulse = () => (
	<span class="relative flex h-2.5 w-2.5 mr-2">
		<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
		<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
	</span>
);

const IconWifiOff = () => (
	<svg
		class="w-4 h-4 text-gray-400 mr-2"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<title>WiFi Off</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M6 18L18 6M6 6l12 12"
		/>
	</svg>
);

export default function BTCChart() {
	let chartContainer: HTMLDivElement | undefined;
	let chart: IChartApi | undefined;
	let candlestickSeries: ISeriesApi<"Candlestick"> | undefined;
	let markersPrimitive: ISeriesMarkersPrimitive | undefined;

	// Indicator Series Refs
	let ema20Series: ISeriesApi<"Line"> | undefined;
	let ema60Series: ISeriesApi<"Line"> | undefined;
	let ema120Series: ISeriesApi<"Line"> | undefined;
	let ema150Series: ISeriesApi<"Line"> | undefined;
	let ema200Series: ISeriesApi<"Line"> | undefined;
	let rsiSeries: ISeriesApi<"Line"> | undefined;
	let fngSeries: ISeriesApi<"Line"> | undefined;

	let ws: WebSocket | undefined;

	const [isLoading, setIsLoading] = createSignal(true);
	const [wsConnected, setWsConnected] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [interval, setInterval] = createSignal<Interval>("1h");
	const [isMobile, setIsMobile] = createSignal(false);

	const [tooltip, setTooltip] = createSignal<TooltipData | null>(null);
	// Current live price for header display
	const [currentPrice, setCurrentPrice] = createSignal<number>(0);
	const [priceColor, setPriceColor] = createSignal("text-gray-900");

	const [indicators, setIndicators] = createSignal<Record<string, boolean>>({
		ema20: false,
		ema60: false,
		ema120: false,
		ema150: false,
		ema200: false,
		rsi: false,
		fng: false,
		tdSeq: true, // Default to true for showcase
	});

	const [btcData, setBtcData] = createSignal<BTCData[]>([]);
	const [fngCache, setFngCache] = createSignal<Map<number, number>>(new Map());
	const [tdMap, setTdMap] = createSignal<Map<number, TDState>>(new Map());

	const [lastEMA20, setLastEMA20] = createSignal<number | null>(null);
	const [lastEMA60, setLastEMA60] = createSignal<number | null>(null);
	const [lastEMA120, setLastEMA120] = createSignal<number | null>(null);
	const [lastEMA150, setLastEMA150] = createSignal<number | null>(null);
	const [lastEMA200, setLastEMA200] = createSignal<number | null>(null);

	const intervals: { label: string; value: Interval }[] = [
		{ label: "15m", value: "15m" },
		{ label: "30m", value: "30m" },
		{ label: "1H", value: "1h" },
		{ label: "4H", value: "4h" },
		{ label: "1D", value: "1d" },
		{ label: "1W", value: "1w" },
	];

	// Indicator Config for UI generation
	const indicatorConfig = [
		{
			key: "ema20",
			label: "EMA 20",
			color: "bg-[#2196F3]",
			textColor: "text-[#2196F3]",
			borderColor: "border-[#2196F3]",
		},
		{
			key: "ema60",
			label: "EMA 60",
			color: "bg-[#4CAF50]",
			textColor: "text-[#4CAF50]",
			borderColor: "border-[#4CAF50]",
		},
		{
			key: "ema120",
			label: "EMA 120",
			color: "bg-[#FF9800]",
			textColor: "text-[#FF9800]",
			borderColor: "border-[#FF9800]",
		},
		{
			key: "ema150",
			label: "EMA 150",
			color: "bg-[#F44336]",
			textColor: "text-[#F44336]",
			borderColor: "border-[#F44336]",
		},
		{
			key: "ema200",
			label: "EMA 200",
			color: "bg-[#9C27B0]",
			textColor: "text-[#9C27B0]",
			borderColor: "border-[#9C27B0]",
		},
		{
			key: "rsi",
			label: "RSI",
			color: "bg-[#7E57C2]",
			textColor: "text-[#7E57C2]",
			borderColor: "border-[#7E57C2]",
		},
		{
			key: "fng",
			label: "Fear & Greed",
			color: "bg-[#F7931A]",
			textColor: "text-[#F7931A]",
			borderColor: "border-[#F7931A]",
		},
		{
			key: "tdSeq",
			label: "TD Sequential",
			color: "bg-emerald-600",
			textColor: "text-emerald-600",
			borderColor: "border-emerald-600",
		},
	];

	// --- EMA Calculation ---
	const calculateEMA = (data: number[], period: number): number[] => {
		if (data.length < period) return [];
		const ema: number[] = [];
		const multiplier = 2 / (period + 1);

		let sum = 0;
		for (let i = 0; i < period; i++) sum += data[i];
		let emaValue = sum / period;

		for (let i = 0; i < period - 1; i++) ema.push(NaN);
		ema.push(emaValue);

		for (let i = period; i < data.length; i++) {
			emaValue = (data[i] - emaValue) * multiplier + emaValue;
			ema.push(emaValue);
		}
		return ema;
	};

	// --- RSI Calculation ---
	const calculateRSI = (data: number[], period = 14): number[] => {
		if (data.length <= period) return Array(data.length).fill(NaN);
		const rsiArray: number[] = [];
		let gains = 0;
		let losses = 0;

		for (let i = 1; i <= period; i++) {
			const change = data[i] - data[i - 1];
			if (change >= 0) gains += change;
			else losses += Math.abs(change);
		}

		let avgGain = gains / period;
		let avgLoss = losses / period;

		for (let i = 0; i < period; i++) rsiArray.push(NaN);
		let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
		rsiArray.push(100 - 100 / (1 + rs));

		for (let i = period + 1; i < data.length; i++) {
			const change = data[i] - data[i - 1];
			const currentGain = change > 0 ? change : 0;
			const currentLoss = change < 0 ? Math.abs(change) : 0;
			avgGain = (avgGain * (period - 1) + currentGain) / period;
			avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
			rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
			rsiArray.push(100 - 100 / (1 + rs));
		}
		return rsiArray;
	};

	// --- TD Sequential Logic ---
	const updateTDMarkers = (data: BTCData[]) => {
		if (!markersPrimitive) return;

		// Clear map if disabled
		if (!indicators().tdSeq || data.length < 5) {
			markersPrimitive.setMarkers([]);
			setTdMap(new Map());
			return;
		}

		const markers: SeriesMarker<UTCTimestamp>[] = [];
		const tempMap = new Map<number, TDState>();

		let buySetup = 0;
		let sellSetup = 0;
		let activeBuyCountdown = false;
		let activeSellCountdown = false;
		let buyCountdown = 0;
		let sellCountdown = 0;

		for (let i = 4; i < data.length; i++) {
			const currentClose = data[i].close;
			const closeLag4 = data[i - 4].close;
			const time = data[i].time as number;

			// --- 1. SETUP PHASE (1-9) ---
			if (currentClose < closeLag4) {
				buySetup++;
				sellSetup = 0;
			} else if (currentClose > closeLag4) {
				sellSetup++;
				buySetup = 0;
			} else {
				buySetup = 0;
				sellSetup = 0;
			}

			// --- Setup Completion (9) ---
			if (buySetup === 9) {
				markers.push({
					time: data[i].time,
					position: "belowBar",
					color: "#10B981", // Emerald 500
					shape: "arrowUp",
					text: "9",
					size: 2,
				});
				tempMap.set(time, {
					label: "Bullish Setup (9)",
					type: "buy",
					stage: "setup",
					description: "Potential reversal to the upside",
				});

				activeBuyCountdown = true;
				buyCountdown = 0;
				activeSellCountdown = false;
				sellCountdown = 0;
				buySetup = 0;
			}

			if (sellSetup === 9) {
				markers.push({
					time: data[i].time,
					position: "aboveBar",
					color: "#EF4444", // Red 500
					shape: "arrowDown",
					text: "9",
					size: 2,
				});
				tempMap.set(time, {
					label: "Bearish Setup (9)",
					type: "sell",
					stage: "setup",
					description: "Potential reversal to the downside",
				});

				activeSellCountdown = true;
				sellCountdown = 0;
				activeBuyCountdown = false;
				buyCountdown = 0;
				sellSetup = 0;
			}

			// --- 2. COUNTDOWN PHASE (13) ---
			if (activeBuyCountdown && i >= 2) {
				const lowLag2 = data[i - 2].low;
				if (currentClose <= lowLag2) {
					buyCountdown++;
					if (buyCountdown === 13) {
						markers.push({
							time: data[i].time,
							position: "belowBar",
							color: "#F59E0B", // Amber 500
							shape: "circle",
							text: "13",
							size: 2,
						});
						tempMap.set(time, {
							label: "Buy Exhaustion (13)",
							type: "buy",
							stage: "countdown",
							description: "Trend likely exhausted, look for entry",
						});
						activeBuyCountdown = false;
						buyCountdown = 0;
					}
				}
			}

			if (activeSellCountdown && i >= 2) {
				const highLag2 = data[i - 2].high;
				if (currentClose >= highLag2) {
					sellCountdown++;
					if (sellCountdown === 13) {
						markers.push({
							time: data[i].time,
							position: "aboveBar",
							color: "#F59E0B", // Amber 500
							shape: "circle",
							text: "13",
							size: 2,
						});
						tempMap.set(time, {
							label: "Sell Exhaustion (13)",
							type: "sell",
							stage: "countdown",
							description: "Trend likely exhausted, look for short",
						});
						activeSellCountdown = false;
						sellCountdown = 0;
					}
				}
			}
		}

		markersPrimitive.setMarkers(
			markers.sort((a, b) => (a.time as number) - (b.time as number)),
		);
		setTdMap(tempMap);
	};

	// --- Fetch History ---
	const fetchHistoricalData = async (
		activeInterval: Interval,
	): Promise<BTCData[]> => {
		try {
			const url = `/api/history?interval=${activeInterval}`;
			const response = await fetch(url);
			if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
			const data = await response.json();
			if (data.error) throw new Error(data.error);

			if (!Array.isArray(data)) return [];

			const mappedData = data.map((item: RawKlineData) => ({
				time: Math.floor(item[0] / 1000) as UTCTimestamp,
				open: item[1],
				high: item[2],
				low: item[3],
				close: item[4],
			}));

			return mappedData.sort(
				(a: BTCData, b: BTCData) => (a.time as number) - (b.time as number),
			);
		} catch (err) {
			console.error("Error fetching history:", err);
			setError("Failed to load chart data");
			return [];
		}
	};

	// --- Fetch F&G ---
	const fetchFNGData = async () => {
		if (fngCache().size > 0) return;
		try {
			const res = await fetch("https://api.alternative.me/fng/?limit=0");
			const json = await res.json();
			if (json.data && Array.isArray(json.data)) {
				const map = new Map<number, number>();
				json.data.forEach((item: FNGData) => {
					const ts = parseInt(item.timestamp, 10);
					const date = new Date(ts * 1000);
					date.setUTCHours(0, 0, 0, 0);
					const normalizedTs = Math.floor(date.getTime() / 1000);
					map.set(normalizedTs, parseInt(item.value, 10));
				});
				setFngCache(map);
			}
		} catch (e) {
			console.error("Failed to fetch FNG data", e);
		}
	};

	// --- WebSocket ---
	const mapIntervalToKrakenWS = (interval: Interval): number => {
		const map: Record<string, number> = {
			"1m": 1,
			"3m": 5,
			"5m": 5,
			"15m": 15,
			"30m": 30,
			"1h": 60,
			"2h": 240,
			"4h": 240,
			"12h": 1440,
			"1d": 1440,
			"3d": 10080,
			"1w": 10080,
			"1M": 21600,
		};
		return map[interval] || 1440;
	};

	const connectWebSocket = (activeInterval: Interval) => {
		if (ws) ws.close();
		ws = new WebSocket("wss://ws.kraken.com");

		ws.onopen = () => {
			setWsConnected(true);
			const krakenInterval = mapIntervalToKrakenWS(activeInterval);
			ws?.send(
				JSON.stringify({
					event: "subscribe",
					pair: ["XBT/USD"],
					subscription: { name: "ohlc", interval: krakenInterval },
				}),
			);
		};

		ws.onclose = () => setWsConnected(false);
		ws.onerror = () => setWsConnected(false);

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (Array.isArray(data) && data[1] && candlestickSeries) {
					const kline = data[1];
					const endTime = parseFloat(kline[1]);
					const intervalMinutes = mapIntervalToKrakenWS(activeInterval);
					const startTime = endTime - intervalMinutes * 60;

					const newData: BTCData = {
						time: Math.floor(startTime) as UTCTimestamp,
						open: parseFloat(kline[2]),
						high: parseFloat(kline[3]),
						low: parseFloat(kline[4]),
						close: parseFloat(kline[5]),
					};

					// Update Header Price
					const price = newData.close;
					const prev = currentPrice();
					if (price > prev) setPriceColor("text-emerald-500");
					else if (price < prev) setPriceColor("text-rose-500");
					setCurrentPrice(price);

					candlestickSeries.update(newData);
					setBtcData((prev) => {
						const last = prev[prev.length - 1];
						if (last && last.time === newData.time) {
							const copy = [...prev];
							copy[copy.length - 1] = newData;
							return copy;
						}
						return [...prev, newData];
					});
					updateIndicatorRealtime(newData);
				}
			} catch (err) {
				console.error("WebSocket message error:", err);
			}
		};
	};

	const updateIndicatorRealtime = (newData: BTCData) => {
		const currentInd = indicators();
		const currentData = btcData();

		const updateEMA = (
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

		if (currentInd.ema20) updateEMA(ema20Series, lastEMA20(), setLastEMA20, 20);
		if (currentInd.ema60) updateEMA(ema60Series, lastEMA60(), setLastEMA60, 60);
		if (currentInd.ema120)
			updateEMA(ema120Series, lastEMA120(), setLastEMA120, 120);
		if (currentInd.ema150)
			updateEMA(ema150Series, lastEMA150(), setLastEMA150, 150);
		if (currentInd.ema200)
			updateEMA(ema200Series, lastEMA200(), setLastEMA200, 200);

		if (currentInd.rsi && rsiSeries && currentData.length > 20) {
			const lookback = 50;
			const slice = currentData.slice(-lookback);
			const closes = slice.map((d) => d.close);
			const rsiValues = calculateRSI(closes, 14);
			const lastRSI = rsiValues[rsiValues.length - 1];
			if (!Number.isNaN(lastRSI)) {
				rsiSeries.update({ time: newData.time, value: lastRSI });
			}
		}

		if (currentInd.fng && fngSeries) {
			const date = new Date((newData.time as number) * 1000);
			date.setUTCHours(0, 0, 0, 0);
			const dayTs = Math.floor(date.getTime() / 1000);
			const val = fngCache().get(dayTs);
			if (val !== undefined) {
				fngSeries.update({ time: newData.time, value: val });
			}
		}

		updateTDMarkers(currentData);
	};

	const loadData = async (activeInterval: Interval) => {
		if (!candlestickSeries) return;
		setIsLoading(true);
		setError(null);

		setBtcData([]);
		candlestickSeries.setData([]);
		setTdMap(new Map());

		if (markersPrimitive) {
			try {
				markersPrimitive.setMarkers([]);
			} catch {
				// Ignore
			}
		}

		[
			ema20Series,
			ema60Series,
			ema120Series,
			ema150Series,
			ema200Series,
			rsiSeries,
			fngSeries,
		].forEach((s) => {
			s?.setData([]);
		});

		const history = await fetchHistoricalData(activeInterval);
		if (history.length > 0) {
			candlestickSeries.setData(history);
			setBtcData(history);

			// Set initial price for header
			setCurrentPrice(history[history.length - 1].close);

			chart?.timeScale().fitContent();
			updateTDMarkers(history);
		}
		connectWebSocket(activeInterval);
		setIsLoading(false);
	};

	onMount(() => {
		if (!chartContainer) return;

		chart = createChart(chartContainer, {
			layout: { background: { color: "transparent" }, textColor: "#64748b" },
			grid: {
				vertLines: { color: "#f1f5f9" },
				horzLines: { color: "#f1f5f9" },
			},
			width: chartContainer.clientWidth,
			height: chartContainer.clientHeight,
			crosshair: {
				mode: 1,
				vertLine: {
					width: 1,
					color: "#6366f1",
					style: 3,
					labelBackgroundColor: "#6366f1",
				},
				horzLine: { color: "#6366f1", labelBackgroundColor: "#6366f1" },
			},
			timeScale: {
				timeVisible: true,
				secondsVisible: false,
				borderColor: "#e2e8f0",
			},
			rightPriceScale: {
				borderColor: "#e2e8f0",
				scaleMargins: { top: 0.1, bottom: 0.1 },
			},
			handleScale: { axisPressedMouseMove: true },
			handleScroll: { vertTouchDrag: false },
		});

		candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: "#10b981",
			downColor: "#ef4444",
			borderVisible: false,
			wickUpColor: "#10b981",
			wickDownColor: "#ef4444",
		});

		markersPrimitive = createSeriesMarkers(
			candlestickSeries,
			[],
		) as unknown as ISeriesMarkersPrimitive;

		const createLineSeries = (color: string) =>
			(chart as IChartApi).addSeries(LineSeries, {
				color,
				lineWidth: 2,
				crosshairMarkerVisible: false,
			});

		// Create Indicator Lines
		ema20Series = createLineSeries("#2196F3");
		ema60Series = createLineSeries("#4CAF50");
		ema120Series = createLineSeries("#FF9800");
		ema150Series = createLineSeries("#F44336");
		ema200Series = createLineSeries("#9C27B0");

		const oscillatorOptions = {
			priceScaleId: "oscillators",
			crosshairMarkerVisible: false,
		};
		rsiSeries = chart.addSeries(LineSeries, {
			...oscillatorOptions,
			color: "#7E57C2",
		});
		fngSeries = chart.addSeries(LineSeries, {
			...oscillatorOptions,
			color: "#F7931A",
		});

		rsiSeries.createPriceLine({
			price: 70,
			color: "#cbd5e1",
			lineWidth: 1,
			lineStyle: 2,
			axisLabelVisible: false,
			title: "",
		});
		rsiSeries.createPriceLine({
			price: 30,
			color: "#cbd5e1",
			lineWidth: 1,
			lineStyle: 2,
			axisLabelVisible: false,
			title: "",
		});

		chart.priceScale("oscillators").applyOptions({
			scaleMargins: { top: 0.8, bottom: 0 },
			visible: false,
			borderVisible: false,
		});

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
			const candle = param.seriesData.get(candlestickSeries) as
				| BTCData
				| undefined;
			if (!candle) {
				setTooltip(null);
				return;
			}
			const getVal = (series: ISeriesApi<"Line"> | undefined) => {
				const val = series ? param.seriesData.get(series) : undefined;
				return val ? (val as LineData).value.toFixed(2) : undefined;
			};

			const rsiVal = rsiSeries
				? (param.seriesData.get(rsiSeries) as LineData)
				: undefined;
			const fngVal = fngSeries
				? (param.seriesData.get(fngSeries) as LineData)
				: undefined;

			const snapY = candlestickSeries.priceToCoordinate(candle.close);
			const dateStr = new Date(Number(param.time) * 1000).toLocaleString(
				"en-US",
				{
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				},
			);

			const fngNum = fngVal ? Math.round(fngVal.value) : undefined;
			let fngClass = "text-gray-500";
			if (fngNum !== undefined) {
				if (fngNum < 25) fngClass = "text-red-600 font-bold";
				else if (fngNum < 45) fngClass = "text-orange-500 font-bold";
				else if (fngNum > 75) fngClass = "text-green-600 font-bold";
				else if (fngNum > 55) fngClass = "text-teal-500 font-bold";
			}

			// Check TD status for this timestamp
			const tdStatus = tdMap().get(Number(param.time));
			let tdColor = "";
			if (tdStatus) {
				if (tdStatus.type === "buy")
					tdColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
				else tdColor = "bg-rose-50 text-rose-700 border-rose-100";

				if (tdStatus.stage === "countdown") {
					tdColor = "bg-amber-50 text-amber-700 border-amber-100";
				}
			}

			setTooltip({
				x: param.point.x,
				y: param.point.y,
				time: dateStr,
				open: candle.open.toFixed(2),
				high: candle.high.toFixed(2),
				low: candle.low.toFixed(2),
				close: candle.close.toFixed(2),
				changeColor:
					candle.close >= candle.open ? "text-emerald-600" : "text-rose-500",
				ema20: indicators().ema20 ? getVal(ema20Series) : undefined,
				ema60: indicators().ema60 ? getVal(ema60Series) : undefined,
				ema120: indicators().ema120 ? getVal(ema120Series) : undefined,
				ema150: indicators().ema150 ? getVal(ema150Series) : undefined,
				ema200: indicators().ema200 ? getVal(ema200Series) : undefined,
				rsi: rsiVal ? rsiVal.value.toFixed(1) : undefined,
				fng: fngNum?.toString(),
				fngClass,
				snapY: snapY ?? param.point.y,
				// TD Data
				tdLabel: tdStatus?.label,
				tdColor: tdColor,
				tdDescription: tdStatus?.description,
			});
		});

		loadData(interval());

		const handleResize = () => {
			if (chart && chartContainer) {
				chart.applyOptions({ width: chartContainer.clientWidth });
			}
			setIsMobile(window.innerWidth < 768);
		};

		handleResize();
		window.addEventListener("resize", handleResize);

		onCleanup(() => {
			if (ws) ws.close();
			if (chart) {
				chart.remove();
				chart = undefined;
				candlestickSeries = undefined;
				ema20Series = undefined;
				ema60Series = undefined;
				ema120Series = undefined;
				ema150Series = undefined;
				ema200Series = undefined;
				rsiSeries = undefined;
				fngSeries = undefined;
			}
			window.removeEventListener("resize", handleResize);
		});
	});

	createEffect(() => {
		const currentData = btcData();
		const currentInd = indicators();

		if (!chart || !candlestickSeries) return;

		// 1. Layout
		if (currentInd.rsi || currentInd.fng) {
			chart.priceScale("right").applyOptions({
				scaleMargins: { top: 0.1, bottom: 0.3 },
			});
			chart.priceScale("oscillators").applyOptions({
				visible: true,
				scaleMargins: { top: 0.75, bottom: 0.05 },
			});
		} else {
			chart.priceScale("right").applyOptions({
				scaleMargins: { top: 0.1, bottom: 0.1 },
			});
			chart.priceScale("oscillators").applyOptions({
				visible: false,
			});
		}

		updateTDMarkers(currentData);

		if (currentInd.fng) {
			fetchFNGData().then(() => {
				if (!fngSeries || !currentData.length) return;
				const cache = fngCache();
				if (cache.size === 0) return;
				const fngLineData: LineData[] = [];
				currentData.forEach((candle) => {
					const date = new Date((candle.time as number) * 1000);
					date.setUTCHours(0, 0, 0, 0);
					const dayTs = Math.floor(date.getTime() / 1000);
					const val = cache.get(dayTs);
					if (val !== undefined)
						fngLineData.push({ time: candle.time, value: val });
				});
				fngSeries.setData(fngLineData);
			});
		} else if (fngSeries) {
			fngSeries.setData([]);
		}

		if (!currentData.length) return;
		const closes = currentData.map((d) => d.close);

		// 3. EMAs
		const processEMA = (
			active: boolean,
			series: ISeriesApi<"Line"> | undefined,
			period: number,
			setLast: (n: number) => void,
		) => {
			if (active && series && closes.length >= period) {
				const vals = calculateEMA(closes, period);
				const lineData: LineData[] = [];
				for (let i = 0; i < vals.length; i++) {
					if (!Number.isNaN(vals[i]))
						lineData.push({ time: currentData[i].time, value: vals[i] });
				}
				series.setData(lineData);
				setLast(vals[vals.length - 1]);
			} else if (series) {
				series.setData([]);
				setLast(0);
			}
		};
		processEMA(currentInd.ema20, ema20Series, 20, setLastEMA20);
		processEMA(currentInd.ema60, ema60Series, 60, setLastEMA60);
		processEMA(currentInd.ema120, ema120Series, 120, setLastEMA120);
		processEMA(currentInd.ema150, ema150Series, 150, setLastEMA150);
		processEMA(currentInd.ema200, ema200Series, 200, setLastEMA200);

		// 4. RSI
		if (currentInd.rsi && rsiSeries && closes.length > 14) {
			const rsiVals = calculateRSI(closes, 14);
			const rsiData: LineData[] = [];
			for (let i = 0; i < rsiVals.length; i++) {
				if (!Number.isNaN(rsiVals[i]))
					rsiData.push({ time: currentData[i].time, value: rsiVals[i] });
			}
			rsiSeries.setData(rsiData);
		} else if (rsiSeries) {
			rsiSeries.setData([]);
		}
	});

	createEffect(() => {
		if (candlestickSeries) loadData(interval());
	});

	return (
		<div class="my-4 md:my-8 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden font-sans ring-1 ring-slate-100">
			{/* Top Bar: Asset Info & Main Controls */}
			<div class="flex flex-col lg:flex-row justify-between items-stretch lg:items-center p-5 border-b border-slate-100 bg-white">
				{/* Left: Asset Ticker & Price */}
				<div class="flex items-center gap-4 mb-4 lg:mb-0">
					<div class="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold">
						₿
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h2 class="text-lg font-bold text-slate-800 tracking-tight leading-none">
								Bitcoin <span class="text-slate-400 font-normal">/ USD</span>
							</h2>
							<div class="flex items-center px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
								{wsConnected() ? <IconPulse /> : <IconWifiOff />}
								<span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
									{wsConnected() ? "Live" : "Offline"}
								</span>
							</div>
						</div>
						<div
							class={`text-2xl font-mono font-bold tracking-tight leading-tight transition-colors duration-300 ${priceColor()}`}
						>
							$
							{currentPrice().toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</div>
					</div>
				</div>

				{/* Right: Timeframes */}
				<div class="flex bg-slate-100 p-1 rounded-lg self-start lg:self-auto overflow-x-auto max-w-full">
					<For each={intervals}>
						{(opt) => (
							<button
								type="button"
								class={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-200 whitespace-nowrap ${interval() === opt.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"}`}
								onClick={() => setInterval(opt.value)}
							>
								{opt.label}
							</button>
						)}
					</For>
				</div>
			</div>

			{/* Secondary Bar: Indicators (Chips) */}
			<div class="px-5 py-3 border-b border-slate-100 bg-slate-50/50 overflow-x-auto no-scrollbar">
				<div class="flex items-center gap-2">
					<span class="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">
						Indicators
					</span>

					<For each={indicatorConfig}>
						{(ind) => (
							<button
								type="button"
								onClick={() =>
									setIndicators((prev) => ({
										...prev,
										[ind.key]: !prev[ind.key],
									}))
								}
								class={`
									group flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 shrink-0 select-none
									${
										indicators()[ind.key]
											? `bg-white ${ind.textColor} ${ind.borderColor} shadow-sm ring-1 ring-inset ${ind.borderColor} bg-opacity-100`
											: "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
									}
								`}
							>
								<span
									class={`w-2 h-2 rounded-full ${ind.color} ${indicators()[ind.key] ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`}
								></span>
								{ind.label}
							</button>
						)}
					</For>
				</div>
			</div>

			{/* Chart Area */}
			<div class="relative h-[400px] md:h-[500px] w-full group cursor-crosshair touch-action-none bg-white">
				<Show when={isLoading()}>
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm transition-all">
						<div class="flex flex-col items-center gap-3">
							<div class="w-10 h-10 border-[3px] border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
							<span class="text-xs font-semibold text-slate-500 uppercase tracking-widest animate-pulse">
								Loading Data...
							</span>
						</div>
					</div>
				</Show>
				<Show when={error()}>
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-white/90">
						<div class="flex items-center gap-2 text-rose-600 font-medium bg-rose-50 px-4 py-3 rounded-xl border border-rose-100 shadow-sm">
								<svg
									class="w-5 h-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<title>Error</title>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
								{error()}
							</div>
					</div>
				</Show>

				<div ref={chartContainer} class="w-full h-full" />

				{/* Floating Tooltip */}
				<Show when={tooltip()}>
					{(t) => (
						<>
							<div
								class="hidden md:block absolute w-3 h-3 bg-indigo-600 rounded-full border-2 border-white shadow-sm pointer-events-none z-10 transition-transform duration-75 ease-out"
								style={{
									top: "0",
									left: "0",
									transform: `translate(${t().x - 6}px, ${t().snapY - 6}px)`,
								}}
							/>

							<div
								class={`absolute z-20 pointer-events-none bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl p-4 text-xs transition-all duration-100 ease-out flex flex-col gap-3 
								${isMobile() ? "top-2 left-2 right-2 rounded-xl border-t-4 border-t-indigo-500" : "rounded-xl w-72"}`}
								style={
									!isMobile()
										? {
												top: "0",
												left: "0",
												transform: `translate(${Math.min(Math.max(10, t().x + 20), (chartContainer?.clientWidth ?? 800) - 300)}px, ${Math.min(Math.max(10, t().y - 50), 350)}px)`,
											}
										: {}
								}
							>
								{/* Tooltip Header */}
								<div class="flex justify-between items-center pb-2 border-b border-slate-100">
									<div class="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
										{t().time}
									</div>
								</div>

								{/* TD Sequential Banner */}
								<Show when={t().tdLabel}>
									<div
										class={`px-3 py-2 rounded-md border flex flex-col ${t().tdColor}`}
									>
										<span class="font-bold text-[11px] flex items-center gap-1.5">
											<span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
											{t().tdLabel}
										</span>
										<span class="text-[10px] opacity-90 leading-tight mt-0.5">
											{t().tdDescription}
										</span>
									</div>
								</Show>

								{/* OHLC Grid */}
								<div class="grid grid-cols-2 gap-x-4 gap-y-2">
									<div class="flex justify-between items-baseline">
										<span class="text-[10px] text-slate-400 font-bold uppercase">
											Open
										</span>
										<span class="font-mono text-slate-700 font-medium">
											{t().open}
										</span>
									</div>
									<div class="flex justify-between items-baseline">
										<span class="text-[10px] text-slate-400 font-bold uppercase">
											High
										</span>
										<span class="font-mono text-slate-700 font-medium">
											{t().high}
										</span>
									</div>
									<div class="flex justify-between items-baseline">
										<span class="text-[10px] text-slate-400 font-bold uppercase">
											Low
										</span>
										<span class="font-mono text-slate-700 font-medium">
											{t().low}
										</span>
									</div>
									<div class="flex justify-between items-baseline">
										<span class="text-[10px] text-slate-400 font-bold uppercase">
											Close
										</span>
										<span class={`font-mono font-bold ${t().changeColor}`}>
											{t().close}
										</span>
									</div>
								</div>

								{/* Active Indicators List */}
								{(t().ema20 ||
									t().ema60 ||
									t().ema120 ||
									t().ema150 ||
									t().ema200 ||
									t().rsi ||
									t().fng) && (
									<div class="border-t border-slate-100 pt-3 space-y-1.5">
										<Show when={t().ema20}>
											<div class="flex justify-between items-center text-[#2196F3]">
												<span class="font-bold">EMA 20</span>{" "}
												<span class="font-mono">{t().ema20}</span>
											</div>
										</Show>
										<Show when={t().ema60}>
											<div class="flex justify-between items-center text-[#4CAF50]">
												<span class="font-bold">EMA 60</span>{" "}
												<span class="font-mono">{t().ema60}</span>
											</div>
										</Show>
										<Show when={t().ema120}>
											<div class="flex justify-between items-center text-[#FF9800]">
												<span class="font-bold">EMA 120</span>{" "}
												<span class="font-mono">{t().ema120}</span>
											</div>
										</Show>
										<Show when={t().ema150}>
											<div class="flex justify-between items-center text-[#F44336]">
												<span class="font-bold">EMA 150</span>{" "}
												<span class="font-mono">{t().ema150}</span>
											</div>
										</Show>
										<Show when={t().ema200}>
											<div class="flex justify-between items-center text-[#9C27B0]">
												<span class="font-bold">EMA 200</span>{" "}
												<span class="font-mono">{t().ema200}</span>
											</div>
										</Show>

										<Show
											when={
												(t().ema20 ||
													t().ema60 ||
													t().ema120 ||
													t().ema150 ||
													t().ema200) &&
												(t().rsi || t().fng)
											}
										>
											<div class="h-px bg-slate-100 my-1"></div>
										</Show>

										<Show when={t().rsi}>
											<div class="flex justify-between items-center text-[#7E57C2]">
												<span class="font-bold">RSI (14)</span>{" "}
												<span class="font-mono">{t().rsi}</span>
											</div>
										</Show>
										<Show when={t().fng}>
											<div
												class={`flex justify-between items-center ${t().fngClass}`}
											>
												<span class="font-bold">Fear & Greed</span>{" "}
												<span class="font-mono">{t().fng}</span>
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
