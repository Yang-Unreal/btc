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
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";

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
	snapY: number;
}

interface FNGData {
	value: string;
	value_classification: string;
	timestamp: string;
}

// Interface for the markers primitive to satisfy Biome strictness
interface ISeriesMarkersPrimitive {
	setMarkers(markers: SeriesMarker<UTCTimestamp>[]): void;
}

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
	const [error, setError] = createSignal<string | null>(null);
	const [interval, setInterval] = createSignal<Interval>("1h");
	const [isMobile, setIsMobile] = createSignal(false);

	const [tooltip, setTooltip] = createSignal<TooltipData | null>(null);
	const [indicators, setIndicators] = createSignal<Record<string, boolean>>({
		ema20: false,
		ema60: false,
		ema120: false,
		ema150: false,
		ema200: false,
		rsi: false,
		fng: false,
		tdSeq: false,
	});

	const [btcData, setBtcData] = createSignal<BTCData[]>([]);
	const [fngCache, setFngCache] = createSignal<Map<number, number>>(new Map());

	// Keep track of last values for real-time updates
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
		{ label: "1M", value: "1M" },
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

	// --- TD Sequential Marker Update (Setup + Countdown) ---
	const updateTDMarkers = (data: BTCData[]) => {
		if (!markersPrimitive) return;

		try {
			// Logic to clear markers if disabled
			if (!indicators().tdSeq || data.length < 5) {
				markersPrimitive.setMarkers([]);
				return;
			}

			const markers: SeriesMarker<UTCTimestamp>[] = [];

			// Setup Variables
			let buySetup = 0;
			let sellSetup = 0;

			// Countdown Variables
			let activeBuyCountdown = false;
			let activeSellCountdown = false;
			let buyCountdown = 0;
			let sellCountdown = 0;

			for (let i = 4; i < data.length; i++) {
				const currentClose = data[i].close;
				const closeLag4 = data[i - 4].close;

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

				// Check for Completed Setup (9)
				if (buySetup === 9) {
					markers.push({
						time: data[i].time,
						position: "belowBar",
						color: "#00C853",
						shape: "arrowUp",
						text: "9",
						size: 2,
					});

					// Start Buy Countdown, Cancel Sell Countdown
					activeBuyCountdown = true;
					buyCountdown = 0;
					activeSellCountdown = false;
					sellCountdown = 0;

					buySetup = 0; // Reset setup count
				} else if (buySetup > 0) {
					// Optional: Show intermediate numbers 1-8?
					// Keeping it clean: only show 9 for Setup, but logic tracks internal count.
				}

				if (sellSetup === 9) {
					markers.push({
						time: data[i].time,
						position: "aboveBar",
						color: "#D50000",
						shape: "arrowDown",
						text: "9",
						size: 2,
					});

					// Start Sell Countdown, Cancel Buy Countdown
					activeSellCountdown = true;
					sellCountdown = 0;
					activeBuyCountdown = false;
					buyCountdown = 0;

					sellSetup = 0; // Reset setup count
				}

				// --- 2. COUNTDOWN PHASE (1-13) ---
				// Rules:
				// Buy Countdown: Close <= Low of 2 bars earlier
				// Sell Countdown: Close >= High of 2 bars earlier
				if (activeBuyCountdown && i >= 2) {
					const lowLag2 = data[i - 2].low;
					if (currentClose <= lowLag2) {
						buyCountdown++;
						if (buyCountdown === 13) {
							markers.push({
								time: data[i].time,
								position: "belowBar",
								color: "#FFD600", // Gold/Yellow for 13
								shape: "square",
								text: "13",
								size: 2,
							});
							activeBuyCountdown = false; // Reset after 13
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
								color: "#FFD600", // Gold/Yellow for 13
								shape: "square",
								text: "13",
								size: 2,
							});
							activeSellCountdown = false; // Reset after 13
							sellCountdown = 0;
						}
					}
				}
			}

			markersPrimitive.setMarkers(
				markers.sort((a, b) => (a.time as number) - (b.time as number)),
			);
		} catch {
			// Ignore marker errors to prevent crash
		}
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
			const krakenInterval = mapIntervalToKrakenWS(activeInterval);
			ws?.send(
				JSON.stringify({
					event: "subscribe",
					pair: ["XBT/USD"],
					subscription: { name: "ohlc", interval: krakenInterval },
				}),
			);
		};

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

					candlestickSeries.update(newData);
					setBtcData((prev) => {
						const last = prev[prev.length - 1];
						// If current candle, replace it. Else append.
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

		// Update TD Markers
		updateTDMarkers(currentData);
	};

	const loadData = async (activeInterval: Interval) => {
		if (!candlestickSeries) return;
		setIsLoading(true);
		setError(null);

		setBtcData([]);
		candlestickSeries.setData([]);

		// Safe reset of markers
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
			chart?.timeScale().fitContent();

			// Update TD Markers
			updateTDMarkers(history);
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
			height: chartContainer.clientHeight,
			crosshair: {
				mode: 1,
				vertLine: {
					width: 1,
					color: "#9B7DFF",
					style: 3,
					labelBackgroundColor: "#9B7DFF",
				},
				horzLine: { color: "#9B7DFF", labelBackgroundColor: "#9B7DFF" },
			},
			timeScale: { timeVisible: true, secondsVisible: false },
			rightPriceScale: {
				borderColor: "#dfdfdf",
				scaleMargins: { top: 0.1, bottom: 0.1 },
			},
			handleScale: { axisPressedMouseMove: true },
			handleScroll: { vertTouchDrag: false },
		});

		candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: "#26a69a",
			downColor: "#ef5350",
			borderVisible: false,
			wickUpColor: "#26a69a",
			wickDownColor: "#ef5350",
		});

		// Initialize Markers Primitive (Type assertion to bypass potential type mismatch)
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
			color: "#BDBDBD",
			lineWidth: 1,
			lineStyle: 2,
			axisLabelVisible: false,
			title: "",
		});
		rsiSeries.createPriceLine({
			price: 30,
			color: "#BDBDBD",
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
				ema20: indicators().ema20 ? getVal(ema20Series) : undefined,
				ema60: indicators().ema60 ? getVal(ema60Series) : undefined,
				ema120: indicators().ema120 ? getVal(ema120Series) : undefined,
				ema150: indicators().ema150 ? getVal(ema150Series) : undefined,
				ema200: indicators().ema200 ? getVal(ema200Series) : undefined,
				rsi: rsiVal ? rsiVal.value.toFixed(1) : undefined,
				fng: fngNum?.toString(),
				fngClass,
				snapY: snapY ?? param.point.y,
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

	// Indicator Logic (Non-Marker Updates)
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

		// 2. Update TD Markers
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
		<div class="my-4 md:my-8 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden font-sans">
			{/* Header */}
			<div class="flex flex-col lg:flex-row justify-between items-start lg:items-center p-4 lg:p-5 border-b border-gray-100 bg-gray-50/50 backdrop-blur-sm gap-4 lg:gap-0">
				<div class="w-full lg:w-auto">
					<div class="flex justify-between items-center w-full">
						<h2 class="text-xl md:text-2xl font-bold text-gray-800 tracking-tight">
							Bitcoin{" "}
							<span class="text-gray-400 text-lg font-normal">/ USDT</span>
						</h2>
						<Show when={isMobile() && tooltip()}>
							<div class="text-right">
								<div
									class={`text-sm font-bold font-mono ${tooltip()?.changeColor}`}
								>
									{tooltip()?.close}
								</div>
								<div class="text-[10px] text-gray-400">
									{tooltip()?.time.split(",")[0]}
								</div>
							</div>
						</Show>
					</div>

					<div class="hidden md:flex gap-3 mt-1 text-xs text-gray-500 font-medium font-mono">
						<span>{tooltip() ? tooltip()?.time : ""}</span>
						<span>O: {tooltip() ? tooltip()?.open : "---"}</span>
						<span>H: {tooltip() ? tooltip()?.high : "---"}</span>
						<span>L: {tooltip() ? tooltip()?.low : "---"}</span>
						<span>C: {tooltip() ? tooltip()?.close : "---"}</span>
					</div>
				</div>

				<div class="flex flex-col gap-3 w-full lg:w-auto items-start lg:items-end">
					<div class="w-full overflow-x-auto no-scrollbar pb-1 lg:pb-0">
						<div class="flex gap-1 bg-gray-200 p-1 rounded-lg w-max">
							{intervals.map((opt) => (
								<button
									type="button"
									class={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${interval() === opt.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
									onClick={() => setInterval(opt.value)}
								>
									{opt.label}
								</button>
							))}
						</div>
					</div>

					<div class="flex flex-wrap gap-3 text-xs items-center">
						<span class="text-gray-400 text-[10px] uppercase font-bold tracking-wider mr-1">
							Indicators
						</span>
						{[20, 60, 120, 150, 200].map((p) => (
							<label class="flex items-center gap-1.5 cursor-pointer group select-none">
								<div
									class={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${indicators()[`ema${p}`] ? "bg-indigo-600 border-indigo-600" : "border-gray-400 bg-white"}`}
								>
									<Show when={indicators()[`ema${p}`]}>
										<svg
											class="w-2 h-2 text-white"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="4"
											aria-hidden="true"
										>
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

						<div class="w-px h-4 bg-gray-300 mx-1"></div>

						<label class="flex items-center gap-1.5 cursor-pointer group select-none">
							<div
								class={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${indicators().rsi ? "bg-purple-600 border-purple-600" : "border-gray-400 bg-white"}`}
							>
								<Show when={indicators().rsi}>
									<svg
										class="w-2 h-2 text-white"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="4"
										aria-hidden="true"
									>
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
								checked={indicators().rsi ?? false}
								onChange={(e) =>
									setIndicators((prev) => ({ ...prev, rsi: e.target.checked }))
								}
							/>
							<span class="text-gray-600 group-hover:text-purple-600 transition-colors font-bold">
								RSI
							</span>
						</label>

						<label class="flex items-center gap-1.5 cursor-pointer group select-none">
							<div
								class={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${indicators().fng ? "bg-orange-500 border-orange-500" : "border-gray-400 bg-white"}`}
							>
								<Show when={indicators().fng}>
									<svg
										class="w-2 h-2 text-white"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="4"
										aria-hidden="true"
									>
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
								checked={indicators().fng ?? false}
								onChange={(e) =>
									setIndicators((prev) => ({ ...prev, fng: e.target.checked }))
								}
							/>
							<span class="text-gray-600 group-hover:text-orange-500 transition-colors font-bold">
								F&G
							</span>
						</label>

						<label class="flex items-center gap-1.5 cursor-pointer group select-none">
							<div
								class={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${indicators().tdSeq ? "bg-green-600 border-green-600" : "border-gray-400 bg-white"}`}
							>
								<Show when={indicators().tdSeq}>
									<svg
										class="w-2 h-2 text-white"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="4"
										aria-hidden="true"
									>
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
								checked={indicators().tdSeq ?? false}
								onChange={(e) =>
									setIndicators((prev) => ({
										...prev,
										tdSeq: e.target.checked,
									}))
								}
							/>
							<span class="text-gray-600 group-hover:text-green-600 transition-colors font-bold">
								TD Seq
							</span>
						</label>
					</div>
				</div>
			</div>

			{/* Chart Area */}
			<div class="relative h-[350px] md:h-[450px] w-full group cursor-crosshair touch-action-none">
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

				<div ref={chartContainer} class="w-full h-full" />

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
								class={`absolute z-20 pointer-events-none bg-white/95 backdrop-blur-md border border-gray-200/60 shadow-xl p-3 text-xs transition-all duration-100 ease-out flex flex-col gap-2 
								${isMobile() ? "top-2 left-2 rounded-lg w-[140px] border-l-4 border-l-indigo-500" : "rounded-lg w-64"}`}
								style={
									!isMobile()
										? {
												top: "0",
												left: "0",
												transform: `translate(${Math.min(Math.max(10, t().x + 20), (chartContainer?.clientWidth ?? 800) - 270)}px, ${Math.min(Math.max(10, t().y - 50), 300)}px)`,
											}
										: {}
								}
							>
								<div class="text-gray-500 font-medium border-b border-gray-100 pb-2 text-center uppercase tracking-wider text-[10px] truncate">
									{t().time}
								</div>

								<div
									class={`grid ${isMobile() ? "grid-cols-1 gap-y-1" : "grid-cols-2 gap-x-4 gap-y-3"}`}
								>
									<div class={isMobile() ? "flex justify-between" : ""}>
										<span class="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">
											Open
										</span>
										<span class="font-mono text-gray-900 text-sm block">
											{t().open}
										</span>
									</div>
									<div class={isMobile() ? "flex justify-between" : ""}>
										<span class="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">
											High
										</span>
										<span class="font-mono text-gray-900 text-sm block">
											{t().high}
										</span>
									</div>
									<div class={isMobile() ? "flex justify-between" : ""}>
										<span class="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">
											Low
										</span>
										<span class="font-mono text-gray-900 text-sm block">
											{t().low}
										</span>
									</div>
									<div class={isMobile() ? "flex justify-between" : ""}>
										<span class="block text-[10px] text-gray-400 font-semibold uppercase mb-0.5">
											Close
										</span>
										<span
											class={`font-mono text-sm font-bold block ${t().changeColor}`}
										>
											{t().close}
										</span>
									</div>
								</div>

								{(t().ema20 ||
									t().ema60 ||
									t().ema120 ||
									t().ema150 ||
									t().ema200 ||
									t().rsi ||
									t().fng) && (
									<div class="border-t border-gray-100 pt-2 mt-1 space-y-1">
										<Show when={t().ema20}>
											<div class="flex justify-between text-blue-500 items-center">
												<span>EMA 20</span>{" "}
												<span class="font-mono">{t().ema20}</span>
											</div>
										</Show>
										<Show when={t().ema60}>
											<div class="flex justify-between text-green-500 items-center">
												<span>EMA 60</span>{" "}
												<span class="font-mono">{t().ema60}</span>
											</div>
										</Show>
										<Show when={t().ema120}>
											<div class="flex justify-between text-orange-500 items-center">
												<span>EMA 120</span>{" "}
												<span class="font-mono">{t().ema120}</span>
											</div>
										</Show>
										<Show when={t().ema150}>
											<div class="flex justify-between text-red-500 items-center">
												<span>EMA 150</span>{" "}
												<span class="font-mono">{t().ema150}</span>
											</div>
										</Show>
										<Show when={t().ema200}>
											<div class="flex justify-between text-purple-500 items-center">
												<span>EMA 200</span>{" "}
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
											<div class="border-t border-dashed border-gray-200 my-1"></div>
										</Show>

										<Show when={t().rsi}>
											<div class="flex justify-between text-purple-600 font-bold items-center">
												<span>RSI 14</span>{" "}
												<span class="font-mono">{t().rsi}</span>
											</div>
										</Show>
										<Show when={t().fng}>
											<div
												class={`flex justify-between ${t().fngClass} items-center`}
											>
												<span>F&G Index</span>{" "}
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
