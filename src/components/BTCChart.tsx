import {
	type CandlestickData,
	CandlestickSeries,
	createChart,
	createSeriesMarkers,
	type HistogramData,
	HistogramSeries,
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
	untrack,
} from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { CURRENCIES, SUPPORTED_ASSETS } from "../lib/constants";
import { formatCryptoPrice } from "../lib/format";
import {
	calculateATR,
	calculateDonchianHigh,
	calculateEMA,
	calculateRSI,
	calculateSMA,
	findLastSwingHigh,
} from "../lib/indicators";
import type {
	AssetConfig,
	CurrencyCode,
	CurrencyConfig,
	Interval,
} from "../lib/types";

type BTCData = CandlestickData<UTCTimestamp> & { volume?: number };

// ... [Existing Interfaces for TooltipData, FNGData, etc. remain unchanged] ...
interface TooltipData {
	x: number;
	y: number;
	time: string;
	open: string;
	high: string;
	low: string;
	close: string;
	volume: string;
	changeColor: string;
	ema20?: string;
	ema60?: string;
	ema120?: string;
	ma20?: string;
	ma60?: string;
	ma120?: string;
	donchianHigh?: string;
	prevHigh?: string;
	rsi?: string;
	rsiDivergence?: string;
	atr?: string;
	fng?: string;
	fngClass?: string;
	tdLabel?: string;
	tdColor?: string;
	tdDescription?: string;
	snapY: number;
	currencySymbol: string;
	changeVal?: string;
	changePct?: string;
	/** Raw numeric open price — used to compute live change vs currentPrice() */
	openRaw?: number;
}

// ... [Existing Interfaces for FNGData, TDState, etc. remain unchanged] ...
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

interface DivergenceState {
	type: "bullish" | "bearish";
	priceAction: string;
	rsiAction: string;
}

interface ISeriesMarkersPrimitive {
	setMarkers(markers: SeriesMarker<UTCTimestamp>[]): void;
}

// ... [Icons remain unchanged] ...
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
		<title>Offline</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M6 18L18 6M6 6l12 12"
		/>
	</svg>
);

const IconChevronDown = () => (
	<svg
		class="w-4 h-4 ml-1"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<title>Expand</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M19 9l-7 7-7-7"
		/>
	</svg>
);

// const IconTrendUp = (props: { class?: string }) => (
// 	<svg
// 		class={props.class}
// 		fill="none"
// 		viewBox="0 0 24 24"
// 		stroke="currentColor"
// 		stroke-width="2"
// 	>
// 		<title>Trend Up</title>
// 		<path
// 			stroke-linecap="round"
// 			stroke-linejoin="round"
// 			d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
// 		/>
// 	</svg>
// );

// const IconTrendDown = (props: { class?: string }) => (
// 	<svg
// 		class={props.class}
// 		fill="none"
// 		viewBox="0 0 24 24"
// 		stroke="currentColor"
// 		stroke-width="2"
// 	>
// 		<title>Trend Down</title>
// 		<path
// 			stroke-linecap="round"
// 			stroke-linejoin="round"
// 			d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"
// 		/>
// 	</svg>
// );

export default function BTCChart() {
	let chartContainer: HTMLDivElement | undefined;
	let chart: IChartApi | undefined;
	let candlestickSeries: ISeriesApi<"Candlestick"> | undefined;
	let volumeSeries: ISeriesApi<"Histogram"> | undefined;
	let markersPrimitive: ISeriesMarkersPrimitive | undefined;

	// Indicator Series Refs
	let ema20Series: ISeriesApi<"Line"> | undefined;
	let ema60Series: ISeriesApi<"Line"> | undefined;
	let ema120Series: ISeriesApi<"Line"> | undefined;
	let ma20Series: ISeriesApi<"Line"> | undefined;
	let ma60Series: ISeriesApi<"Line"> | undefined;
	let ma120Series: ISeriesApi<"Line"> | undefined;
	let donchianHighSeries: ISeriesApi<"Line"> | undefined;
	let prevHighSeries: ISeriesApi<"Line"> | undefined;
	let rsiSeries: ISeriesApi<"Line"> | undefined;
	let fngSeries: ISeriesApi<"Line"> | undefined;
	let atrSeries: ISeriesApi<"Line"> | undefined;

	let ws: WebSocket | undefined;
	let lastLoadedSymbol = "";
	let wsCurrentAssetSymbol = ""; // track what symbol the WS is currently serving
	let wsCurrentChannel = ""; // track the current candle channel subscription

	const [isLoading, setIsLoading] = createSignal(true);
	const [isLoadingMore, setIsLoadingMore] = createSignal(false);
	const [wsConnected, setWsConnected] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const [interval, setInterval] = createSignal<Interval>("1h");

	// NEW: Currency State
	const [activeCurrency, setActiveCurrency] = createSignal<CurrencyConfig>(
		CURRENCIES[0],
	);
	const [activeAsset, setActiveAsset] = createSignal<AssetConfig>(
		SUPPORTED_ASSETS[0],
	);

	const [isMobile, setIsMobile] = createSignal(false);

	// Dropdown States

	const [showAssetMenu, setShowAssetMenu] = createSignal(false);
	const [assetSearchQuery, setAssetSearchQuery] = createSignal("");
	const [showIndicatorMenu, setShowIndicatorMenu] = createSignal(false);

	// const [tooltip, setTooltip] = createSignal<TooltipData | null>(null);
	const [currentPrice, setCurrentPrice] = createSignal<number>(0);

	const [indicators, setIndicators] = createSignal<Record<string, boolean>>({
		ma20: false,
		ma60: false,
		ma120: false,
		ema20: false,
		ema60: false,
		ema120: false,
		rsi: false,
		fng: false,
		tdSeq: false,
		atr: false,
		volume: true,
	});

	const [indicatorHeights, setIndicatorHeights] = createSignal<Record<string, number>>({
		oscillators: 100,
		atr: 100,
	});
	const [draggingArea, setDraggingArea] = createSignal<string | null>(null); // 'top' | 'middle'

	// Persistence: Fetch initial indicators
	onMount(async () => {
		try {
			const res = await fetch("/api/settings");
			const data = await res.json();
			if (data.indicators) {
				setIndicators(data.indicators);
			}
			if (data.currency) {
				const currency = CURRENCIES.find((c) => c.code === data.currency);
				if (currency) setActiveCurrency(currency);
			}
			if (data.indicatorHeights) {
				setIndicatorHeights(data.indicatorHeights);
			} else if (data.indicatorHeight) {
				// Fallback for old settings
				setIndicatorHeights({ oscillators: data.indicatorHeight / 2, atr: data.indicatorHeight / 2 });
			}
		} catch (e) {
			console.error("Failed to load indicators from DB", e);
		}
	});

	// Persistence: Save indicators when changed
	let isFirstIndicatorsEffect = true;
	createEffect(() => {
		const currentIndicators = indicators();
		const currentCurrency = activeCurrency();
		const currentIndHeights = indicatorHeights();
		if (isFirstIndicatorsEffect) {
			isFirstIndicatorsEffect = false;
			return;
		}
		// Debounce or at least run in background
		fetch("/api/settings", {
			method: "POST",
			body: JSON.stringify({
				indicators: currentIndicators,
				currency: currentCurrency.code,
				indicatorHeights: currentIndHeights,
			}),
		}).catch((err) => console.error("Failed to save settings", err));
	});

	const [btcData, setBtcData] = createSignal<BTCData[]>([]);
	const [fngCache, setFngCache] = createSignal<Map<number, number>>(new Map());
	const [tdMap, setTdMap] = createSignal<Map<number, TDState>>(new Map());
	const [divMap, setDivMap] = createSignal<Map<number, DivergenceState>>(
		new Map(),
	);
	const [legendData, setLegendData] = createSignal<TooltipData | null>(null);

	const intervals: { label: string; value: Interval }[] = [
		{ label: "1m", value: "1m" },
		{ label: "5m", value: "5m" },
		{ label: "15m", value: "15m" },
		{ label: "30m", value: "30m" },
		{ label: "1H", value: "1h" },
		{ label: "4H", value: "4h" },
		{ label: "12H", value: "12h" },
		{ label: "1D", value: "1d" },
		{ label: "1W", value: "1w" },
	];

	// Indicator Config (omitted for brevity, same as original)

	const indicatorConfig = [
		{
			key: "volume",
			label: "Volume",
			color: "bg-teal-500/50",
			textColor: "text-teal-400",
			borderColor: "border-teal-500/20",
		},
		{
			key: "ma20",
			label: "MA 20",
			color: "bg-red-500",
			textColor: "text-red-500",
			borderColor: "border-red-500",
		},
		{
			key: "ma60",
			label: "MA 60",
			color: "bg-green-500",
			textColor: "text-green-500",
			borderColor: "border-green-500",
		},
		{
			key: "ma120",
			label: "MA 120",
			color: "bg-blue-600",
			textColor: "text-blue-600",
			borderColor: "border-blue-600",
		},
		{
			key: "ema20",
			label: "EMA 20",
			color: "bg-yellow-400",
			textColor: "text-yellow-400",
			borderColor: "border-yellow-400",
		},
		{
			key: "ema60",
			label: "EMA 60",
			color: "bg-purple-400",
			textColor: "text-purple-400",
			borderColor: "border-purple-400",
		},
		{
			key: "ema120",
			label: "EMA 120",
			color: "bg-orange-400",
			textColor: "text-orange-400",
			borderColor: "border-orange-400",
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
		{
			key: "atr",
			label: "ATR 14",
			color: "bg-slate-400",
			textColor: "text-slate-400",
			borderColor: "border-slate-400",
		},
	];

	// --- Helper Functions (EMA, RSI, TDSeq) match original file ---
	// --- Helper Functions (EMA, RSI, TDSeq) match original file ---
	// Moved to src/lib/indicators.ts

	const calculateTDMarkers = (data: BTCData[]) => {
		if (!indicators().tdSeq || data.length < 5) {
			setTdMap(new Map());
			return [];
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

			if (buySetup === 9) {
				markers.push({
					time: data[i].time,
					position: "belowBar",
					color: "#10B981",
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
					color: "#EF4444",
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

			if (activeBuyCountdown && i >= 2) {
				const lowLag2 = data[i - 2].low;
				if (currentClose <= lowLag2) {
					buyCountdown++;
					if (buyCountdown === 13) {
						markers.push({
							time: data[i].time,
							position: "belowBar",
							color: "#F59E0B",
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
							color: "#F59E0B",
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
		setTdMap(tempMap);
		return markers;
	};

	const calculateDivergenceMarkers = (data: BTCData[]) => {
		if (!indicators().rsi || data.length < 50) return [];

		const rsiValues = calculateRSI(
			data.map((d) => d.close),
			14,
		);
		const markers: SeriesMarker<UTCTimestamp>[] = [];
		const newDivMap = new Map<number, DivergenceState>();

		for (let i = 20; i < data.length - 2; i++) {
			const pClose = data[i].close;
			const rVal = rsiValues[i];
			if (Number.isNaN(rVal)) continue;

			if (rVal > 70) {
				for (let j = i - 15; j < i - 5; j++) {
					if (j < 0) continue;
					const prevR = rsiValues[j];
					const prevP = data[j].close;
					if (pClose > prevP && rVal < prevR && prevR > 70) {
						markers.push({
							time: data[i].time,
							position: "aboveBar",
							color: "#EF4444",
							shape: "arrowDown",
							size: 1,
						});
						newDivMap.set(data[i].time as number, {
							type: "bearish",
							priceAction: "Higher High",
							rsiAction: "Lower High",
						});
						break;
					}
				}
			}

			if (rVal < 30) {
				for (let j = i - 15; j < i - 5; j++) {
					if (j < 0) continue;
					const prevR = rsiValues[j];
					const prevP = data[j].close;
					if (pClose < prevP && rVal > prevR && prevR < 30) {
						markers.push({
							time: data[i].time,
							position: "belowBar",
							color: "#10B981",
							shape: "arrowUp",
							size: 1,
						});
						newDivMap.set(data[i].time as number, {
							type: "bullish",
							priceAction: "Lower Low",
							rsiAction: "Higher Low",
						});
						break;
					}
				}
			}
		}

		setDivMap(newDivMap);
		return markers;
	};

	const refreshAllMarkers = (data: BTCData[]) => {
		if (!markersPrimitive) return;
		const tdMarkers = calculateTDMarkers(data);
		const divMarkers = calculateDivergenceMarkers(data);

		const allMarkers = [...tdMarkers, ...divMarkers].sort(
			(a, b) => (a.time as number) - (b.time as number),
		);
		markersPrimitive.setMarkers(allMarkers);
	};

	// --- Modified Fetch History ---
	const fetchHistoricalData = async (
		activeInterval: Interval,
		currency: CurrencyCode,
		assetSymbol: string,
		toTimestamp?: number,
	): Promise<BTCData[]> => {
		try {
			// Pass currency and symbol to API
			let url = `/api/history?interval=${activeInterval}&currency=${currency}&symbol=${assetSymbol}`;
			if (toTimestamp) {
				url += `&to=${toTimestamp}`;
			}
			const response = await fetch(url);
			if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
			const data = await response.json();
			if (data.error) throw new Error(data.error);

			// Filter out any potential duplicates and sort by time
			const seen = new Set<number>();
			const mappedData: BTCData[] = [];

			for (const item of data) {
				const ts = Math.floor(item[0] / 1000);
				if (!seen.has(ts)) {
					seen.add(ts);
					mappedData.push({
						time: ts as UTCTimestamp,
						open: item[1],
						high: item[2],
						low: item[3],
						close: item[4],
						volume: item[5],
					});
				}
			}

			return mappedData.sort(
				(a: BTCData, b: BTCData) => (a.time as number) - (b.time as number),
			);
		} catch (err) {
			console.error("Error fetching history:", err);
			setError("Failed to load chart data");
			return [];
		}
	};

	// --- Fetch More Historical Data (Infinite Scroll) ---
	let loadMoreTimer: ReturnType<typeof setTimeout> | null = null;
	const fetchMoreHistoricalData = async () => {
		if (isLoadingMore() || isLoading()) return;
		const currentData = btcData();
		if (currentData.length === 0) return;

		const earliestCandle = currentData[0];
		const earliestTimeMs = (earliestCandle.time as number) * 1000;

		setIsLoadingMore(true);
		try {
			const olderData = await fetchHistoricalData(
				interval(),
				activeCurrency().code,
				activeAsset().symbol,
				earliestTimeMs,
			);

			if (olderData.length === 0) {
				setIsLoadingMore(false);
				return;
			}

			// Filter out any duplicates
			const existingTimes = new Set(currentData.map((d) => d.time as number));
			const newData = olderData.filter(
				(d) => !existingTimes.has(d.time as number),
			);

			if (newData.length === 0) {
				setIsLoadingMore(false);
				return;
			}

			const mergedData = [...newData, ...currentData].sort(
				(a, b) => (a.time as number) - (b.time as number),
			);

			// Update all series with merged data
			if (candlestickSeries) {
				candlestickSeries.setData(mergedData);
			}
			if (volumeSeries) {
				const volumeData = mergedData.map((d) => ({
					time: d.time,
					value: d.volume || 0,
					color:
						d.close >= d.open
							? "rgba(16, 185, 129, 0.5)"
							: "rgba(239, 68, 68, 0.5)",
				}));
				volumeSeries.setData(volumeData);
			}

			setBtcData(mergedData);
			syncAllIndicators();
		} catch (err) {
			console.error("Error fetching more history:", err);
		} finally {
			setIsLoadingMore(false);
		}
	};

	// --- Fetch F&G (Unchanged) ---
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

	const mapIntervalToBitgetWS = (interval: Interval): string => {
		// Bitget WS channels: candle1m, candle5m, candle15m, candle30m, candle1H, candle4H, candle12H, candle1D, candle1W
		const map: Record<string, string> = {
			"1m": "candle1m",
			"3m": "candle5m", // Fallback
			"5m": "candle5m",
			"15m": "candle15m",
			"30m": "candle30m",
			"1h": "candle1H",
			"2h": "candle1H",
			"4h": "candle4H",
			"12h": "candle12H",
			"1d": "candle1D",
			"3d": "candle1D",
			"1w": "candle1W",
			"1M": "candle1M", // Check support if needed, assuming 1M exists or fallback
		};
		return map[interval] || "candle1H";
	};

	// --- Modified WebSocket Connection (Bitget) ---
	const connectWebSocket = (
		activeInterval: Interval,
		assetConfig: AssetConfig,
	) => {
		const wsSymbol = `${assetConfig.symbol}USDT`; // Bitget uses USDT pairs
		const newChannel = mapIntervalToBitgetWS(activeInterval);

		// --- Key fix: if WS is alive and serving the same asset, only swap
		// the candle channel subscription instead of killing everything.
		// This keeps the ticker feed uninterrupted, preventing price jumps.
		if (
			ws &&
			ws.readyState === WebSocket.OPEN &&
			wsCurrentAssetSymbol === wsSymbol
		) {
			if (wsCurrentChannel !== newChannel) {
				// Unsubscribe old candle channel
				ws.send(
					JSON.stringify({
						op: "unsubscribe",
						args: [
							{
								instType: "SPOT",
								channel: wsCurrentChannel,
								instId: wsSymbol,
							},
						],
					}),
				);
				// Subscribe new candle channel
				ws.send(
					JSON.stringify({
						op: "subscribe",
						args: [
							{
								instType: "SPOT",
								channel: newChannel,
								instId: wsSymbol,
							},
						],
					}),
				);
				wsCurrentChannel = newChannel;
			}
			// Ticker stays alive — no price jump!
			return;
		}

		// Full reconnect (new asset or WS not yet open)
		if (ws) ws.close();
		ws = new WebSocket("wss://ws.bitget.com/v2/ws/public");
		wsCurrentAssetSymbol = wsSymbol;
		wsCurrentChannel = newChannel;

		ws.onopen = () => {
			setWsConnected(true);
			ws?.send(
				JSON.stringify({
					op: "subscribe",
					args: [
						{
							instType: "SPOT",
							channel: newChannel,
							instId: wsSymbol,
						},
						{
							instType: "SPOT",
							channel: "ticker",
							instId: wsSymbol,
						},
					],
				}),
			);
		};

		ws.onclose = () => setWsConnected(false);
		ws.onerror = () => setWsConnected(false);

		ws.onmessage = (event) => {
			if (event.data === "pong") return;
			try {
				const data = JSON.parse(event.data);
				// Verify pair
				if (data.arg.instId !== wsSymbol) return;

				// 1. Handle Real-time Ticker for top-left label price
				if (data.arg.channel === "ticker" && data.data && data.data.length > 0) {
					const ticker = data.data[0];
					const bestPrice = ticker.lastPr || ticker.last || ticker.close;
					if (bestPrice) {
						setCurrentPrice(parseFloat(bestPrice));
					}
					return;
				}

				// 2. Handle Candlestick updates for the chart
				if (
					(data.action === "snapshot" || data.action === "update") &&
					data.arg.channel.startsWith("candle") &&
					data.data &&
					data.data.length > 0 &&
					candlestickSeries
				) {
					// IMPORTANT: Ignore 'snapshot' action completely!
					// Our REST API provides much more accurate and up-to-date history.
					// High-timeframe WS snapshots are often cached by the exchange (sometimes days old for 1W)
					// Processing them will brutally deform the currently perfectly-rendered chart.
					if (data.action === "snapshot") return;

					const currentHistory = untrack(() => btcData());
					const lastKnownTs = currentHistory.length > 0 ? (currentHistory[currentHistory.length - 1].time as number) : 0;

					for (let i = 0; i < data.data.length; i++) {
						const candle = data.data[i];
						// candle: [ts(ms string), open, high, low, close, vol, ...]
						const ts = Math.floor(parseInt(candle[0], 10) / 1000) as UTCTimestamp;

						if (ts < lastKnownTs) continue;

						const newData: BTCData = {
							time: ts,
							open: parseFloat(candle[1]),
							high: parseFloat(candle[2]),
							low: parseFloat(candle[3]),
							close: parseFloat(candle[4]),
							volume: parseFloat(candle[5]),
						};

						candlestickSeries.update(newData);
						if (volumeSeries && newData.volume) {
							volumeSeries.update({
								time: newData.time,
								value: newData.volume,
								color:
									newData.close >= newData.open
										? "rgba(16, 185, 129, 0.5)"
										: "rgba(239, 68, 68, 0.5)",
							});
						}

						let latestBtcData: BTCData[] = [];
						setBtcData((prev) => {
							const last = prev[prev.length - 1];
							if (last && last.time === newData.time) {
								const copy = [...prev];
								copy[copy.length - 1] = newData;
								latestBtcData = copy;
								return copy;
							}
							latestBtcData = [...prev, newData];
							return latestBtcData;
						});
						updateIndicatorRealtime(latestBtcData);
					}
				}
			} catch (err) {
				console.error("WebSocket message error:", err);
			}
		};
	};

	// --- Update Realtime Indicators (Optimized) ---
	const updateIndicatorRealtime = (allData: BTCData[]) => {
		const currentInd = indicators();
		const lastCandle = allData[allData.length - 1];
		if (!lastCandle) return;

		// Use a sufficient slice for calculation to ensure EMA convergence
		// 1000 bars is usually enough for EMA200
		const slice = allData.slice(-1000);
		const closes = slice.map((d) => d.close);

		const updateSeries = (
			series: ISeriesApi<"Line"> | undefined,
			calcFn: (data: number[], p: number) => number[],
			period: number,
		) => {
			if (series && closes.length >= period) {
				const vals = calcFn(closes, period);
				const val = vals[vals.length - 1];
				if (!Number.isNaN(val)) {
					series.update({ time: lastCandle.time, value: val });
				}
			}
		};

		if (currentInd.ema20) updateSeries(ema20Series, calculateEMA, 20);
		if (currentInd.ema60) updateSeries(ema60Series, calculateEMA, 60);
		if (currentInd.ema120) updateSeries(ema120Series, calculateEMA, 120);

		if (currentInd.ma20) updateSeries(ma20Series, calculateSMA, 20);
		if (currentInd.ma60) updateSeries(ma60Series, calculateSMA, 60);
		if (currentInd.ma120) updateSeries(ma120Series, calculateSMA, 120);

		if (currentInd.donchianHigh && donchianHighSeries && slice.length >= 20) {
			const highs = slice.map((d) => d.high);
			const vals = calculateDonchianHigh(highs, 20);
			const val = vals[vals.length - 1];
			if (!Number.isNaN(val)) {
				donchianHighSeries.update({ time: lastCandle.time, value: val });
			}
		}

		if (currentInd.rsi && rsiSeries && slice.length > 20) {
			const rsiValues = calculateRSI(closes, 14);
			const lastRSI = rsiValues[rsiValues.length - 1];
			if (!Number.isNaN(lastRSI)) {
				rsiSeries.update({ time: lastCandle.time, value: lastRSI });
			}
		}

		if (currentInd.fng && fngSeries) {
			const date = new Date((lastCandle.time as number) * 1000);
			date.setUTCHours(0, 0, 0, 0);
			const dayTs = Math.floor(date.getTime() / 1000);
			const val = fngCache().get(dayTs);
			if (val !== undefined) {
				fngSeries.update({ time: lastCandle.time, value: val });
			}
		}

		if (currentInd.atr && atrSeries && slice.length > 14) {
			const atrValues = calculateATR(
				slice.map((d) => ({ high: d.high, low: d.low, close: d.close })),
				14,
			);
			const lastATR = atrValues[atrValues.length - 1];
			if (!Number.isNaN(lastATR)) {
				atrSeries.update({ time: lastCandle.time, value: lastATR });
			}
		}

		refreshAllMarkers(allData);
		updateLegendToLatest(allData);
	};

	const updateLegendToLatest = (data: BTCData[]) => {
		if (data.length === 0) return;
		const lastCandle = data[data.length - 1];
		const currentInd = indicators();

		const dateStr = new Date(Number(lastCandle.time) * 1000).toLocaleString(
			"en-US",
			{ month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
		);

		const formatValue = (val: number | undefined) => {
			if (val === undefined || val === null || Number.isNaN(val)) return "—";
			return formatCryptoPrice(val, activeCurrency().code);
		};

		const volumeVal = lastCandle.volume;
		const formattedVolume = volumeVal
			? (Math.round(volumeVal * 100) / 100).toLocaleString()
			: "—";

		// Calculate values for latest candle
		const closes = data.map((d) => d.close);
		const highs = data.map((d) => d.high);

		const rsiValues = calculateRSI(closes, 14);
		const lastRSI = rsiValues[rsiValues.length - 1];

		const ema20 = calculateEMA(closes, 20);
		const ema60 = calculateEMA(closes, 60);
		const ema120 = calculateEMA(closes, 120);
		const ma20 = calculateSMA(closes, 20);
		const ma60 = calculateSMA(closes, 60);
		const ma120 = calculateSMA(closes, 120);
		const donchianHigh = calculateDonchianHigh(highs, 20);
		const lastPrevHigh = findLastSwingHigh(highs, 10, 2);

		const change = lastCandle.close - lastCandle.open;
		const changePct = (change / lastCandle.open) * 100;

		setLegendData({
			time: dateStr,
			open: formatValue(lastCandle.open),
			high: formatValue(lastCandle.high),
			low: formatValue(lastCandle.low),
			close: formatValue(lastCandle.close),
			changeVal: (change >= 0 ? "+" : "") + formatValue(change),
			changePct: (change >= 0 ? "+" : "") + changePct.toFixed(2) + "%",
			volume: formattedVolume,
			currencySymbol: activeCurrency().symbol,
			changeColor:
				lastCandle.close >= lastCandle.open
					? "text-emerald-500"
					: "text-rose-500",
			ema20: formatValue(ema20[ema20.length - 1]),
			ema60: formatValue(ema60[ema60.length - 1]),
			ema120: formatValue(ema120[ema120.length - 1]),
			ma20: formatValue(ma20[ma20.length - 1]),
			ma60: formatValue(ma60[ma60.length - 1]),
			ma120: formatValue(ma120[ma120.length - 1]),
			donchianHigh: formatValue(donchianHigh[donchianHigh.length - 1]),
			prevHigh: formatValue(lastPrevHigh ?? undefined),
			rsi: !Number.isNaN(lastRSI) ? lastRSI.toFixed(1) : undefined,
			atr: currentInd.atr
				? formatValue(
						calculateATR(
							data.map((d) => ({ high: d.high, low: d.low, close: d.close })),
							14,
						).pop(),
					)
				: undefined,
			tdLabel: tdMap().get(lastCandle.time as number)?.label,
			fng: currentInd.fng
				? fngCache()
						.get(
							Math.floor(
								new Date((lastCandle.time as number) * 1000).setUTCHours(
									0,
									0,
									0,
									0,
								) / 1000,
							),
						)
						?.toString()
				: undefined,
			// Raw open value used by JSX to compute live change vs currentPrice()
			openRaw: lastCandle.open,
			x: 0,
			y: 0,
			snapY: 0,
		} as TooltipData);
	};

	const syncAllIndicators = () => {
		const currentData = untrack(() => btcData());
		const currentInd = indicators();

		if (!chart || !candlestickSeries) return;

		// Sync Visibility
		ema20Series?.applyOptions({ visible: !!currentInd.ema20 });
		ema60Series?.applyOptions({ visible: !!currentInd.ema60 });
		ema120Series?.applyOptions({ visible: !!currentInd.ema120 });
		ma20Series?.applyOptions({ visible: !!currentInd.ma20 });
		ma60Series?.applyOptions({ visible: !!currentInd.ma60 });
		ma120Series?.applyOptions({ visible: !!currentInd.ma120 });
		donchianHighSeries?.applyOptions({ visible: !!currentInd.donchianHigh });
		prevHighSeries?.applyOptions({ visible: !!currentInd.prevHigh });
		rsiSeries?.applyOptions({ visible: !!currentInd.rsi });
		fngSeries?.applyOptions({ visible: !!currentInd.fng });
		atrSeries?.applyOptions({ visible: !!currentInd.atr });
		volumeSeries?.applyOptions({ visible: !!currentInd.volume });
		const totalHeight = chartContainer?.clientHeight || 450;
		const heights = indicatorHeights();
		
		const oscillatorsActive = !!(currentInd.rsi || currentInd.fng);
		const atrActive = !!currentInd.atr;

		const activeOscillators = [];
		if (oscillatorsActive) activeOscillators.push("oscillators");
		if (atrActive) activeOscillators.push("atrScale");

		const oscH = oscillatorsActive ? heights.oscillators : 0;
		const atrH = atrActive ? heights.atr : 0;
		
		const totalIndHeight = oscH + atrH;
		const marginRatio = totalIndHeight > 0 ? (totalIndHeight + 40) / totalHeight : 0.1;

		chart.priceScale("right").applyOptions({
			scaleMargins: { top: 0.1, bottom: marginRatio },
		});

		const areaStart = 1 - (totalIndHeight / totalHeight);

		if (activeOscillators.length === 1) {
			const margins = { top: areaStart, bottom: 0.05 };
			chart.priceScale(activeOscillators[0]).applyOptions({
				visible: true,
				scaleMargins: margins,
			});
			// Hide others
			const other = activeOscillators[0] === "oscillators" ? "atrScale" : "oscillators";
			chart.priceScale(other).applyOptions({ visible: false });
		} else if (activeOscillators.length === 2) {
			// Stack them: oscillators on top, ATR on bottom
			const oscRatio = oscH / totalHeight;
			const atrRatio = atrH / totalHeight;

			// ATR bottom: from (1 - atrRatio) to 1
			chart.priceScale("atrScale").applyOptions({
				visible: true,
				scaleMargins: { 
					top: 1 - atrRatio, 
					bottom: 0.05 
				},
			});
			// Oscillators above ATR: from (1 - atrRatio - oscRatio) to (1 - atrRatio)
			chart.priceScale("oscillators").applyOptions({
				visible: true,
				scaleMargins: { 
					top: 1 - atrRatio - oscRatio, 
					bottom: atrRatio + 0.02 // small gap
				},
			});
		} else {
			chart.priceScale("oscillators").applyOptions({ visible: false });
			chart.priceScale("atrScale").applyOptions({ visible: false });
		}

		refreshAllMarkers(currentData);

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

		const processEMA = (
			active: boolean,
			series: ISeriesApi<"Line"> | undefined,
			period: number,
		) => {
			if (active && series && closes.length >= period) {
				const vals = calculateEMA(closes, period);
				const lineData: LineData[] = [];
				for (let i = 0; i < vals.length; i++) {
					if (!Number.isNaN(vals[i]))
						lineData.push({ time: currentData[i].time, value: vals[i] });
				}
				series.setData(lineData);
			} else if (series) {
				series.setData([]);
			}
		};
		processEMA(currentInd.ema20, ema20Series, 20);
		processEMA(currentInd.ema60, ema60Series, 60);
		processEMA(currentInd.ema120, ema120Series, 120);

		const processMA = (
			active: boolean,
			series: ISeriesApi<"Line"> | undefined,
			period: number,
		) => {
			if (active && series && closes.length >= period) {
				const vals = calculateSMA(closes, period);
				const lineData: LineData[] = [];
				for (let i = 0; i < vals.length; i++) {
					if (!Number.isNaN(vals[i]))
						lineData.push({ time: currentData[i].time, value: vals[i] });
				}
				series.setData(lineData);
			} else if (series) {
				series.setData([]);
			}
		};
		processMA(currentInd.ma20, ma20Series, 20);
		processMA(currentInd.ma60, ma60Series, 60);
		processMA(currentInd.ma120, ma120Series, 120);

		if (
			currentInd.donchianHigh &&
			donchianHighSeries &&
			currentData.length >= 20
		) {
			const highs = currentData.map((d) => d.high);
			const vals = calculateDonchianHigh(highs, 20);
			const lineData: LineData[] = [];
			for (let i = 0; i < vals.length; i++) {
				if (!Number.isNaN(vals[i]))
					lineData.push({ time: currentData[i].time, value: vals[i] });
			}
			donchianHighSeries.setData(lineData);
		} else if (donchianHighSeries) {
			donchianHighSeries.setData([]);
		}

		// Prev High (Swing High)
		if (currentInd.prevHigh && prevHighSeries && currentData.length >= 15) {
			const highs = currentData.map((d) => d.high);
			const lineData: LineData[] = [];
			for (let i = 10; i < highs.length; i++) {
				// Look back 10 bars, forward 2 bars to find swing highs
				const currentHigh = highs[i];
				let isSwingHigh = true;

				// Check previous 10 bars
				for (let j = 1; j <= 10; j++) {
					if (highs[i - j] >= currentHigh) {
						isSwingHigh = false;
						break;
					}
				}

				if (!isSwingHigh) continue;

				// Check next 2 bars
				for (let j = 1; j <= 2; j++) {
					if (i + j < highs.length && highs[i + j] > currentHigh) {
						isSwingHigh = false;
						break;
					}
				}

				if (isSwingHigh) {
					lineData.push({ time: currentData[i].time, value: currentHigh });
				}
			}
			prevHighSeries.setData(lineData);
		} else if (prevHighSeries) {
			prevHighSeries.setData([]);
		}

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

		if (currentInd.atr && atrSeries && currentData.length > 14) {
			const atrVals = calculateATR(
				currentData.map((d) => ({ high: d.high, low: d.low, close: d.close })),
				14,
			);
			const atrData: LineData[] = [];
			for (let i = 0; i < atrVals.length; i++) {
				if (!Number.isNaN(atrVals[i]))
					atrData.push({ time: currentData[i].time, value: atrVals[i] });
			}
			atrSeries.setData(atrData);
		} else if (atrSeries) {
			atrSeries.setData([]);
		}
	};

	// --- History Query ---
	const historyQuery = createQuery(() => ({
		queryKey: ["history", interval(), activeCurrency().code, activeAsset().symbol],
		queryFn: async () => {
			return await fetchHistoricalData(
				interval(),
				activeCurrency().code,
				activeAsset().symbol,
			);
		},
		staleTime: 60 * 1000 * 5, // Cache for 5 minutes for instant interval switching
		enabled: typeof window !== "undefined", // Disable SSR fetch for relative URLs
	}));

	createEffect(() => {
		if (candlestickSeries) {
			candlestickSeries.applyOptions({
				priceFormat: {
					type: "custom",
					formatter: (price: number) =>
						formatCryptoPrice(price, activeCurrency().code),
				},
			});
		}
	});

	createEffect(() => {
		const historyData = historyQuery.data;
		const isFetching = historyQuery.isFetching;
		const fetchError = historyQuery.error;
		
		untrack(() => {
			if (!historyData) {
				if (isFetching) {
					setIsLoading(true);
				}
				return;
			}

			if (!candlestickSeries) return;

			setIsLoading(false);
			setError(fetchError ? "A serious error occurred while loading data" : null);

			const history = [...historyData]; // clone to avoid mutating solid-query cache

			if (history.length > 0) {
				const cp = currentPrice();
				const targetSymbol = activeAsset().symbol;
				
				if (cp === 0 || lastLoadedSymbol !== targetSymbol) {
					setCurrentPrice(history[history.length - 1].close);
					lastLoadedSymbol = targetSymbol;
				}

				// Clear current indicators that are reactive to chart series
				try {
					markersPrimitive?.setMarkers([]);
					setTdMap(new Map());
				} catch {
					/* ignore */
				}

				candlestickSeries.setData(history);
				if (volumeSeries) {
					const volumeData = history.map((d) => ({
						time: d.time,
						value: d.volume || 0,
						color:
							d.close >= d.open
								? "rgba(16, 185, 129, 0.5)"
								: "rgba(239, 68, 68, 0.5)",
					}));
					volumeSeries.setData(volumeData);
				}
				setBtcData(history);

				chart?.timeScale().fitContent();
				// Use requestAnimationFrame to ensure chart has processed the main data before indicators
				requestAnimationFrame(() => {
					syncAllIndicators();
					updateLegendToLatest(history);
				});

				connectWebSocket(interval(), activeAsset());
			}
		});
	});

	// --- Load Data ---
	// Removed loadData in favor of createQuery reactive updates


	onMount(() => {
		if (!chartContainer) return;

		chart = createChart(chartContainer, {
			layout: { background: { color: "transparent" }, textColor: "#64748b" },
			grid: {
				vertLines: { color: "rgba(241, 245, 249, 0.08)" },
				horzLines: { color: "rgba(241, 245, 249, 0.08)" },
			},
			width: chartContainer.clientWidth,
			height: chartContainer.clientHeight,
			crosshair: {
				// Mode 0 = Normal: crosshair follows cursor exactly and is always visible
				// (Mode 1 = Magnet snaps to candle bodies which can feel laggy)
				mode: 0,
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
				scaleMargins: { top: 0.1, bottom: 0.2 }, // Added bottom margin for volume
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
			priceFormat: {
				type: "custom",
				formatter: (price: number) =>
					formatCryptoPrice(price, activeCurrency().code),
				minMove: 0.00000001,
			},
		});

		volumeSeries = chart.addSeries(HistogramSeries, {
			color: "#26a69a",
			priceFormat: {
				type: "volume",
			},
			priceScaleId: "volume",
			priceLineVisible: false,
			lastValueVisible: true,
		});

		chart.priceScale("volume").applyOptions({
			scaleMargins: {
				top: 0.8,
				bottom: 0,
			},
			visible: false,
		});

		markersPrimitive = createSeriesMarkers(
			candlestickSeries,
			[],
		) as unknown as ISeriesMarkersPrimitive;

		const createLineSeries = (color: string) =>
			(chart as IChartApi).addSeries(LineSeries, {
				color,
				lineWidth: 1,
				crosshairMarkerVisible: false,
				visible: false,
				priceLineVisible: false,
				lastValueVisible: true,
			});

		ema20Series = createLineSeries("#FACC15"); // yellow-400
		ema60Series = createLineSeries("#C084FC"); // purple-400
		ema120Series = createLineSeries("#FB923C"); // orange-400

		ma20Series = createLineSeries("#EF4444"); // red-500
		ma60Series = createLineSeries("#22C55E"); // green-500
		ma120Series = createLineSeries("#2563EB"); // blue-600
		donchianHighSeries = createLineSeries("#f43f5e"); // rose-500
		prevHighSeries = createLineSeries("#f97316"); // orange-500

		const oscillatorOptions = {
			priceScaleId: "oscillators",
			crosshairMarkerVisible: false,
			lineWidth: 1 as const,
			priceLineVisible: false,
			lastValueVisible: true,
		};
		rsiSeries = chart.addSeries(LineSeries, {
			...oscillatorOptions,
			color: "#7E57C2",
			visible: false,
		});
		fngSeries = chart.addSeries(LineSeries, {
			...oscillatorOptions,
			color: "#F7931A",
			visible: false,
		});

		atrSeries = chart.addSeries(LineSeries, {
			...oscillatorOptions,
			priceScaleId: "atrScale",
			color: "#94a3b8", // slate-400
			visible: false,
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

		chart.priceScale("atrScale").applyOptions({
			scaleMargins: { top: 0.8, bottom: 0 },
			visible: false,
			borderVisible: false,
		});

		let lastTooltipTime: number | null = null;
		let cachedTooltipData: Omit<TooltipData, "x" | "y" | "snapY"> | null = null;

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
				updateLegendToLatest(btcData());
				lastTooltipTime = null;
				cachedTooltipData = null;
				return;
			}

			if (lastTooltipTime === (param.time as number) && cachedTooltipData) {
				const candle = param.seriesData.get(candlestickSeries) as
					| BTCData
					| undefined;
				const snapY = candle
					? candlestickSeries.priceToCoordinate(candle.close)
					: param.point.y;
				setLegendData({
					...cachedTooltipData,
					x: param.point.x,
					y: param.point.y,
					snapY: snapY ?? param.point.y,
				} as TooltipData);
				return;
			}

			const candle = param.seriesData.get(candlestickSeries) as
				| BTCData
				| undefined;
			if (!candle) {
				return;
			}
			const dateStr = new Date(Number(param.time) * 1000).toLocaleString(
				"en-US",
				{ month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
			);

			const formatTooltipPrice = (val: number | undefined) => {
				if (val === undefined || val === null || Number.isNaN(val)) return "—";
				return formatCryptoPrice(val, activeCurrency().code); // Includes symbol
			};

			const volumeVal = volumeSeries
				? (param.seriesData.get(volumeSeries) as HistogramData)
				: undefined;
			const formattedVolume = volumeVal
				? (Math.round(volumeVal.value * 100) / 100).toLocaleString()
				: "—";

			const rsiVal = rsiSeries
				? (param.seriesData.get(rsiSeries) as LineData)
				: undefined;
			const fngVal = fngSeries
				? (param.seriesData.get(fngSeries) as LineData)
				: undefined;
			const donchianHighVal = donchianHighSeries
				? (param.seriesData.get(donchianHighSeries) as LineData)
				: undefined;
			const prevHighVal = prevHighSeries
				? (param.seriesData.get(prevHighSeries) as LineData)
				: undefined;
			const snapY = candlestickSeries.priceToCoordinate(candle.close);

			const fngNum = fngVal ? Math.round(fngVal.value) : undefined;
			let fngClass = "text-gray-500";
			if (fngNum !== undefined) {
				if (fngNum < 25) fngClass = "text-red-600 font-bold";
				else if (fngNum < 45) fngClass = "text-orange-500 font-bold";
				else if (fngNum > 75) fngClass = "text-green-600 font-bold";
				else if (fngNum > 55) fngClass = "text-teal-500 font-bold";
			}

			const tdStatus = tdMap().get(Number(param.time));
			let tdColor = "";
			if (tdStatus) {
				if (tdStatus.type === "buy")
					tdColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
				else tdColor = "bg-rose-50 text-rose-700 border-rose-100";
				if (tdStatus.stage === "countdown")
					tdColor = "bg-amber-50 text-amber-700 border-amber-100";
			}

			const divStatus = divMap().get(Number(param.time));

			const ema20Val = ema20Series
				? (param.seriesData.get(ema20Series) as LineData)
				: undefined;
			const ema60Val = ema60Series
				? (param.seriesData.get(ema60Series) as LineData)
				: undefined;
			const ema120Val = ema120Series
				? (param.seriesData.get(ema120Series) as LineData)
				: undefined;
			const ma20Val = ma20Series
				? (param.seriesData.get(ma20Series) as LineData)
				: undefined;
			const ma60Val = ma60Series
				? (param.seriesData.get(ma60Series) as LineData)
				: undefined;
			const ma120Val = ma120Series
				? (param.seriesData.get(ma120Series) as LineData)
				: undefined;

			lastTooltipTime = param.time as number;
			cachedTooltipData = {
				time: dateStr,
				open: formatTooltipPrice(candle.open),
				high: formatTooltipPrice(candle.high),
				low: formatTooltipPrice(candle.low),
				close: formatTooltipPrice(candle.close),
				changeVal: (candle.close - candle.open >= 0 ? "+" : "") + formatTooltipPrice(candle.close - candle.open),
				changePct: ((candle.close - candle.open) / candle.open * 100 >= 0 ? "+" : "") + ((candle.close - candle.open) / candle.open * 100).toFixed(2) + "%",
				volume: formattedVolume,
				currencySymbol: activeCurrency().symbol,
				changeColor:
					candle.close >= candle.open ? "text-emerald-600" : "text-rose-500",
				ema20: formatTooltipPrice(ema20Val?.value),
				ema60: formatTooltipPrice(ema60Val?.value),
				ema120: formatTooltipPrice(ema120Val?.value),
				ma20: formatTooltipPrice(ma20Val?.value),
				ma60: formatTooltipPrice(ma60Val?.value),
				ma120: formatTooltipPrice(ma120Val?.value),
				donchianHigh: formatTooltipPrice(donchianHighVal?.value),
				prevHigh: formatTooltipPrice(prevHighVal?.value),
				rsi:
					rsiVal && typeof rsiVal.value === "number"
						? rsiVal.value.toFixed(1)
						: undefined,
				fng: fngNum?.toString(),
				fngClass,
				tdLabel: tdStatus?.label,
				tdColor: tdColor,
				tdDescription: tdStatus?.description,
				rsiDivergence: divStatus
					? `${divStatus.type === "bullish" ? "Bull" : "Bear"} Div: ${divStatus.priceAction} / RSI ${divStatus.rsiAction}`
					: undefined,
				atr: formatTooltipPrice(
					atrSeries
						? (param.seriesData.get(atrSeries) as LineData)?.value
						: undefined,
				),
			};

			setLegendData({
				...cachedTooltipData,
				x: param.point.x,
				y: param.point.y,
				snapY: snapY ?? param.point.y,
			} as TooltipData);
		});

		// --- Subscribe to visible range for infinite scroll ---
		chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
			if (!logicalRange || isLoadingMore() || isLoading()) return;
			// Preload when within 200 bars of the start — triggers well before reaching the edge
			if (logicalRange.from <= 200) {
				if (loadMoreTimer) clearTimeout(loadMoreTimer);
				loadMoreTimer = setTimeout(() => {
					fetchMoreHistoricalData();
				}, 100);
			}
		});

		// Data fetches are gracefully handled by createQuery on interval changes

		const handleResize = () => {
			if (chart && chartContainer) {
				chart.applyOptions({ width: chartContainer.clientWidth });
			}
			setIsMobile(window.innerWidth < 640);
		};

		handleResize();
		window.addEventListener("resize", handleResize);

		const handleMouseMove = (e: MouseEvent) => {
			const area = draggingArea();
			if (!area || !chartContainer) return;

			const rect = chartContainer.getBoundingClientRect();
			const relativeY = e.clientY - rect.top;
			const totalHeight = rect.height;
			const heights = indicatorHeights();

			const activeInds = untrack(() => Object.assign({}, indicators())); // Not needed for logic, just naming
			const oscillatorsActive = !!(activeInds.rsi || activeInds.fng);
			const atrActive = !!activeInds.atr;

			if (area === "top") {
				// Top-most active indicator handle
				const newTotalHeight = Math.max(50, Math.min(totalHeight * 0.7, totalHeight - relativeY));
				if (oscillatorsActive && atrActive) {
					// Adjust total indicator height, then distribute proportionally
					const currentTotal = heights.oscillators + heights.atr;
					if (currentTotal === 0) return; // Avoid division by zero
					const ratioOsc = heights.oscillators / currentTotal;
					const ratioAtr = heights.atr / currentTotal;
					setIndicatorHeights({
						oscillators: Math.max(30, newTotalHeight * ratioOsc),
						atr: Math.max(30, newTotalHeight * ratioAtr)
					});
				} else if (oscillatorsActive) {
					setIndicatorHeights({ ...heights, oscillators: newTotalHeight });
				} else if (atrActive) {
					setIndicatorHeights({ ...heights, atr: newTotalHeight });
				}
			} else if (area === "middle") {
				// Splitter between oscillators and ATR
				// relativeY is the mouse position from the top of the chart container
				// The top of the ATR pane is at (totalHeight - heights.atr)
				// The top of the Oscillators pane is at (totalHeight - heights.atr - heights.oscillators)
				
				// We want to adjust the split, so the sum of heights.oscillators + heights.atr remains constant
				// The mouse Y position should define the boundary between the two panes.
				// The bottom of the oscillators pane (and top of ATR pane) should be at relativeY.
				
				const currentTotalIndHeight = heights.oscillators + heights.atr;
				const newOscillatorsHeight = Math.max(30, totalHeight - relativeY - 20); // 20 is approx padding/margin
				const newAtrHeight = Math.max(30, currentTotalIndHeight - newOscillatorsHeight);

				if (newOscillatorsHeight + newAtrHeight > currentTotalIndHeight + 10 || newOscillatorsHeight + newAtrHeight < currentTotalIndHeight - 10) {
					// If the total height changes too much, it means the mouse is outside the expected range.
					// Re-calculate based on mouse position relative to the bottom of the chart.
					const newAtrHeightFromBottom = Math.max(30, totalHeight - relativeY);
					const newOscHeightFromBottom = Math.max(30, currentTotalIndHeight - newAtrHeightFromBottom);
					setIndicatorHeights({
						oscillators: newOscHeightFromBottom,
						atr: newAtrHeightFromBottom
					});
				} else {
					setIndicatorHeights({
						oscillators: newOscillatorsHeight,
						atr: newAtrHeight
					});
				}
			}

			syncAllIndicators();
		};

		const handleMouseUp = () => {
			setDraggingArea(null);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);

		onCleanup(() => {
			if (ws) ws.close();
			if (chart) {
				chart.remove();
				chart = undefined;
				candlestickSeries = undefined;
			}
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		});
	});

	// --- Layout & Indicator Effect (Optimized) ---
	createEffect(() => {
		// Track indicators changes only
		indicators();
		// Sync without tracking data updates
		syncAllIndicators();
	});



	return (
		<div class="directive-card overflow-hidden">
			{/* ===== MOBILE LAYOUT (Bitget-style) ===== */}
			<Show when={isMobile()}>
				<div class="relative z-50 bg-[#151921]">
					{/* Row 1: Symbol + Price + Connection */}
					<div class="flex items-center justify-between px-4 pt-3 pb-2">
						<div class="flex flex-col">
							{/* Symbol selector */}
							<div class="relative">
								<button
									type="button"
									onClick={() => setShowAssetMenu(!showAssetMenu())}
									class="flex items-center gap-1.5 text-sm font-black text-white"
								>
									<span class="text-white">{activeAsset().symbol}</span>
									<span class="text-slate-500 font-bold">/ USDT</span>
									<IconChevronDown />
								</button>
								<Show when={showAssetMenu()}>
									<div
										class="fixed inset-0 z-40"
										onClick={() => {
											setShowAssetMenu(false);
											setAssetSearchQuery("");
										}}
										onKeyDown={(e) => {
											if (e.key === "Escape") {
												setShowAssetMenu(false);
												setAssetSearchQuery("");
											}
										}}
										tabIndex={-1}
										role="button"
									/>
									<div class="absolute left-0 top-full mt-1 w-64 bg-[#151921] border border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col">
										<div class="p-2 border-b border-white/5 bg-white/2">
											<input
												type="text"
												placeholder="Search pair..."
												class="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
												value={assetSearchQuery()}
												onInput={(e) =>
													setAssetSearchQuery(e.currentTarget.value)
												}
												onClick={(e) => e.stopPropagation()}
												autofocus
											/>
										</div>
										<div class="max-h-80 overflow-y-auto no-scrollbar py-1">
											<div class="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">
												Spot Pairs
											</div>
											<For
												each={SUPPORTED_ASSETS.filter(
													(a) =>
														a.name
															.toLowerCase()
															.includes(assetSearchQuery().toLowerCase()) ||
														a.symbol
															.toLowerCase()
															.includes(assetSearchQuery().toLowerCase()),
												)}
											>
												{(asset) => (
													<button
														type="button"
														class={`w-full text-left px-3 py-2.5 text-[11px] font-bold hover:bg-white/5 flex items-center justify-between transition-colors border-l-2 ${activeAsset().symbol === asset.symbol ? "border-indigo-500 bg-white/5 text-white" : "border-transparent text-slate-400"}`}
														onClick={() => {
															setActiveAsset(asset);
															setShowAssetMenu(false);
															setAssetSearchQuery("");
														}}
													>
														<div class="flex items-center gap-2">
															<span class={activeAsset().symbol === asset.symbol ? "text-white" : "text-slate-200"}>
																{asset.symbol}
															</span>
															<span class="text-slate-500">/USDT</span>
														</div>
														<span class="font-mono text-[9px] opacity-40 shrink-0 uppercase">
															{asset.name}
														</span>
													</button>
												)}
											</For>
										</div>
									</div>
								</Show>
							</div>
							{/* Large price */}
							<div class="text-[22px] font-mono font-black text-emerald-400 leading-tight mt-0.5">
								{formatCryptoPrice(currentPrice(), activeCurrency().code)}
							</div>
						</div>
						{/* Connection indicator */}
						<div class="flex items-center">
							{wsConnected() ? <IconPulse /> : <IconWifiOff />}
						</div>
					</div>

					{/* Row 2: Interval pills (Bitget-style) */}
					<div class="flex items-center gap-1.5 px-4 pb-2 overflow-x-auto no-scrollbar">
						<For each={intervals}>
							{(opt) => (
								<button
									type="button"
									class={`px-3 py-1.5 text-[12px] font-bold rounded-md shrink-0 transition-all ${
										interval() === opt.value
											? "bg-indigo-600 text-white"
											: "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
									}`}
									onClick={() => setInterval(opt.value)}
								>
									{opt.label.toUpperCase()}
								</button>
							)}
						</For>
					</div>

					{/* Row 3: SELECT INDICATORS button (Bitget-style) */}
					<div class="px-4 pb-2">
						<div class="relative">
							<button
								type="button"
								onClick={() => setShowIndicatorMenu(!showIndicatorMenu())}
								class="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-md text-[11px] font-black text-slate-300 uppercase tracking-wider hover:bg-white/8 transition-colors w-full justify-center"
							>
								<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<title>Indicators</title>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16" />
								</svg>
								Select Indicators
								<IconChevronDown />
							</button>
							<Show when={showIndicatorMenu()}>
								<div
									class="fixed inset-0 z-40"
									onClick={() => setShowIndicatorMenu(false)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") setShowIndicatorMenu(false);
									}}
									tabIndex={-1}
									role="button"
								/>
								<div class="absolute left-0 right-0 top-full mt-1 bg-[#1a1e27] border border-white/10 shadow-2xl z-50 py-1 max-h-[50vh] overflow-y-auto no-scrollbar rounded-md">
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
												class={`w-full text-left px-4 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 hover:bg-white/5 ${indicators()[ind.key] ? ind.textColor : "text-slate-500"}`}
											>
												<div
													class={`w-2.5 h-2.5 rounded-sm shrink-0 ${ind.color} ${indicators()[ind.key] ? "opacity-100" : "opacity-20"}`}
												/>
												<span class="grow">{ind.label}</span>
												<Show when={indicators()[ind.key]}>
													<svg class="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<title>Active</title>
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
													</svg>
												</Show>
											</button>
										)}
									</For>
								</div>
							</Show>
						</div>
					</div>
				</div>
			</Show>

			{/* ===== DESKTOP LAYOUT (unchanged) ===== */}
			<Show when={!isMobile()}>
				<div class="relative z-50 flex flex-wrap items-center justify-between p-1 bg-[#151921] border-b border-white/5">
					<div class="flex items-center gap-px">
						{/* Symbol Info */}
						<div class="relative flex items-center gap-2 px-3 py-1.5 border-r border-white/5 mr-2">
							<button
								type="button"
								onClick={() => setShowAssetMenu(!showAssetMenu())}
								class="flex items-center gap-1.5 text-xs font-black text-white hover:text-indigo-400"
							>
								{activeAsset().symbol}/USDT <IconChevronDown />
							</button>
							<Show when={showAssetMenu()}>
								<div
									class="fixed inset-0 z-40"
									onClick={() => {
										setShowAssetMenu(false);
										setAssetSearchQuery("");
									}}
									onKeyDown={(e) => {
										if (e.key === "Escape") {
											setShowAssetMenu(false);
											setAssetSearchQuery("");
										}
									}}
									tabIndex={-1}
									role="button"
								/>
								<div class="absolute left-0 top-full mt-1 w-64 bg-[#151921] border border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col">
									<div class="p-2 border-b border-white/5 bg-white/2">
										<input
											type="text"
											placeholder="Search pair..."
											class="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
											value={assetSearchQuery()}
											onInput={(e) =>
												setAssetSearchQuery(e.currentTarget.value)
											}
											onClick={(e) => e.stopPropagation()}
											autofocus
										/>
									</div>
									<div class="max-h-80 overflow-y-auto no-scrollbar py-1">
										<div class="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">
											Spot Pairs
										</div>
										<For
											each={SUPPORTED_ASSETS.filter(
												(a) =>
													a.name
														.toLowerCase()
														.includes(assetSearchQuery().toLowerCase()) ||
													a.symbol
														.toLowerCase()
														.includes(assetSearchQuery().toLowerCase()),
											)}
										>
											{(asset) => (
												<button
													type="button"
													class={`w-full text-left px-3 py-2.5 text-[11px] font-bold hover:bg-white/5 flex items-center justify-between transition-colors border-l-2 ${activeAsset().symbol === asset.symbol ? "border-indigo-500 bg-white/5 text-white" : "border-transparent text-slate-400"}`}
													onClick={() => {
														setActiveAsset(asset);
														setShowAssetMenu(false);
														setAssetSearchQuery("");
													}}
												>
													<div class="flex items-center gap-2">
														<span
															class={
																activeAsset().symbol === asset.symbol
																	? "text-white"
																	: "text-slate-200"
															}
														>
															{asset.symbol}
														</span>
														<span class="text-slate-500">/USDT</span>
													</div>
													<span class="font-mono text-[9px] opacity-40 shrink-0 uppercase">
														{asset.name}
													</span>
												</button>
											)}
										</For>
									</div>
								</div>
							</Show>
							<div class="text-[14px] font-mono font-bold text-emerald-500 ml-2">
								{formatCryptoPrice(currentPrice(), activeCurrency().code)}
							</div>
						</div>

						{/* Time Intervals */}
						<div class="flex items-center gap-1 mr-4">
							<button type="button" class="p-1 px-2 text-[10px] text-slate-400 hover:text-white flex items-center gap-1">
								<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<title>Time</title>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								Time
							</button>
							<For each={intervals}>
								{(opt) => (
									<button
										type="button"
										class={`px-2 py-1 text-[11px] font-bold tracking-tight transition-all ${interval() === opt.value ? "text-indigo-500" : "text-slate-500 hover:text-slate-300"}`}
										onClick={() => setInterval(opt.value)}
									>
										{opt.label.toUpperCase()}
									</button>
								)}
							</For>
						</div>

						{/* Indicators Dropdown */}
						<div class="relative">
							<button
								type="button"
								onClick={() => setShowIndicatorMenu(!showIndicatorMenu())}
								class="p-1.5 text-slate-400 hover:text-white"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<title>Indicators</title>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16" />
								</svg>
							</button>
							<Show when={showIndicatorMenu()}>
								<div
									class="fixed inset-0 z-40"
									onClick={() => setShowIndicatorMenu(false)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") setShowIndicatorMenu(false);
									}}
									tabIndex={-1}
									role="button"
								/>
								<div class="absolute left-0 top-full mt-1 w-56 bg-[#1a1e27] border border-white/10 shadow-2xl z-50 py-1 max-h-[70vh] overflow-y-auto no-scrollbar">
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
												class={`w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 hover:bg-white/5 ${indicators()[ind.key] ? ind.textColor : "text-slate-500"}`}
											>
												<div
													class={`w-2 h-2 shrink-0 ${ind.color} ${indicators()[ind.key] ? "opacity-100" : "opacity-20"}`}
												/>
												<span class="grow">{ind.label}</span>
												<Show when={indicators()[ind.key]}>
													<div class="w-1 h-1 bg-indigo-500 rounded-full" />
												</Show>
											</button>
										)}
									</For>
								</div>
							</Show>
						</div>
					</div>

					<div class="flex items-center gap-2">
						{/* View Tabs */}
						<div class="flex bg-white/5 rounded p-0.5 mr-2">
							<button type="button" class="px-2 py-0.5 text-[10px] font-bold text-white bg-white/10 rounded-sm">Original</button>
							<button type="button" class="px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-300">TradingView</button>
							<button type="button" class="px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-300">Depth</button>
						</div>
						<div class="flex items-center gap-2 px-2 border-l border-white/5">
							<div class="flex items-center">
								{wsConnected() ? <IconPulse /> : <IconWifiOff />}
							</div>
						</div>
					</div>
				</div>
			</Show>

			{/* Chart Area */}
			<div class="relative h-[450px] md:h-[550px] w-full group cursor-crosshair touch-action-none bg-[#0b0e14]">
				<Show when={isLoading()}>
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0e14]/80 backdrop-blur-sm">
						<div class="flex flex-col items-center gap-4">
							<div class="w-10 h-10 border-2 border-white/5 border-t-indigo-500 animate-spin"></div>
							<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em] animate-pulse">
								Reconstructing Market State
							</span>
						</div>
					</div>
				</Show>

				<Show when={error()}>
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0e14]/90">
						<div class="badge-directive text-rose-500 border-rose-500/50 px-4 py-3 bg-rose-500/5">
							Critical Failure: {error()}
						</div>
					</div>
				</Show>

				<div ref={chartContainer} class="w-full h-full opacity-90" />

				{/* Indicator Resize Handles */}
				<Show when={Object.values(indicators()).some((v) => v) && (indicators().rsi || indicators().fng || indicators().atr)}>
					{/* Top Handle - Price/Indicator border */}
					<div
						role="separator"
						tabIndex={0}
						aria-label="Resize indicator area"
						aria-valuenow={indicatorHeights().oscillators + indicatorHeights().atr}
						class="absolute left-0 right-0 z-40 h-2 cursor-row-resize group/handle transition-colors outline-none focus:bg-indigo-500/20"
						style={{
							bottom: `${(indicators().rsi || indicators().fng ? indicatorHeights().oscillators : 0) + (indicators().atr ? indicatorHeights().atr : 0)}px`,
							"background-color": draggingArea() === "top" ? "rgba(99, 102, 241, 0.4)" : "transparent",
						}}
						onMouseDown={(e) => {
							e.preventDefault();
							setDraggingArea("top");
						}}
					>
						<div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/5 group-hover/handle:bg-indigo-500/50" />
					</div>

					{/* Middle Handle - Between Oscillators and ATR */}
					<Show when={(indicators().rsi || indicators().fng) && indicators().atr}>
						<div
							role="separator"
							tabIndex={0}
							aria-label="Resize between indicators"
							aria-valuenow={indicatorHeights().atr}
							class="absolute left-0 right-0 z-40 h-2 cursor-row-resize group/handle transition-colors outline-none focus:bg-indigo-500/20"
							style={{
								bottom: `${indicatorHeights().atr}px`,
								"background-color": draggingArea() === "middle" ? "rgba(99, 102, 241, 0.4)" : "transparent",
							}}
							onMouseDown={(e) => {
								e.preventDefault();
								setDraggingArea("middle");
							}}
						>
							<div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/5 group-hover/handle:bg-indigo-500/50" />
						</div>
					</Show>
				</Show>

				{/* Bitget-style Legend Overlay */}
				<div class="absolute top-1 left-2 z-30 pointer-events-none flex flex-col gap-0.5 select-none transition-all duration-200 overflow-hidden max-w-[calc(100%-20px)]">
					<Show when={legendData()}>
						{(t) => (
							<>
								{/* Asset Info & OHLC */}
								<Show when={isMobile()}>
									{/* Mobile: Bitget-style stacked layout */}
									<div class="text-[10px] font-bold leading-relaxed">
										<div class="text-slate-300">
											{activeAsset().symbol}/USDT perpetual last price · {interval().toUpperCase()}
										</div>
										{/* C uses live currentPrice() — never jumps on interval switch */}
										{(() => {
											const livePrice = currentPrice();
											const openVal = legendData()?.openRaw ?? 0;
											const liveChange = livePrice - openVal;
											const liveChangePct = openVal > 0 ? (liveChange / openVal) * 100 : 0;
											const liveColor = liveChange >= 0 ? "text-emerald-500" : "text-rose-500";
											const livePriceStr = formatCryptoPrice(livePrice, activeCurrency().code);
											const liveChangeStr = (liveChange >= 0 ? "+" : "") + formatCryptoPrice(liveChange, activeCurrency().code);
											const liveChangePctStr = (liveChangePct >= 0 ? "+" : "") + liveChangePct.toFixed(2) + "%";
											return (
												<div class="flex items-center gap-1">
													<span class={liveColor}>{livePriceStr}</span>
													<span class={liveColor}>{liveChangeStr}</span>
													<span class={liveColor}>({liveChangePctStr})</span>
												</div>
											);
										})()}
									</div>
								</Show>
								<Show when={!isMobile()}>
									{/* Desktop: compact horizontal layout */}
									<div class="bg-black/20 p-1.5 py-1 rounded w-fit flex flex-wrap items-center gap-x-2 text-[11px] leading-tight font-bold whitespace-nowrap">
										<span class="text-slate-200">
											{activeAsset().symbol}/USDT · {interval().toUpperCase()} · Bitget
										</span>
										{/* O/H/L: per-candle values (legitimately differ across intervals). */}
										{/* C: pinned to real-time currentPrice() — never jumps on interval switch. */}
										{(() => {
											const livePrice = currentPrice();
											const openVal = legendData()?.openRaw ?? 0;
											const liveChange = livePrice - openVal;
											const liveChangePct = openVal > 0 ? (liveChange / openVal) * 100 : 0;
											const liveColor = liveChange >= 0 ? "text-emerald-500" : "text-rose-500";
											const livePriceStr = formatCryptoPrice(livePrice, activeCurrency().code);
											const liveChangeStr = (liveChange >= 0 ? "+" : "") + formatCryptoPrice(liveChange, activeCurrency().code);
											const liveChangePctStr = (liveChangePct >= 0 ? "+" : "") + liveChangePct.toFixed(2) + "%";
											return (
												<div class="flex items-center gap-1.5 ml-1 scale-90 origin-left">
													<span class="text-slate-500 font-medium">O</span>
													<span class={t().changeColor}>{t().open}</span>
													<span class="text-slate-500 font-medium ml-1">H</span>
													<span class={t().changeColor}>{t().high}</span>
													<span class="text-slate-500 font-medium ml-1">L</span>
													<span class={t().changeColor}>{t().low}</span>
													<span class="text-slate-500 font-medium ml-1">C</span>
													<span class={liveColor}>{livePriceStr}</span>
													<span class={`${liveColor} ml-1`}>{liveChangeStr}</span>
													<span class={liveColor}>({liveChangePctStr})</span>
												</div>
											);
										})()}
									</div>
								</Show>

								{/* Indicators - stacked vertically on mobile, flex-wrap on desktop */}
								<Show when={Object.values(indicators()).some((v) => v)}>
									<div class={`bg-black/20 p-1.5 rounded w-fit ${isMobile() ? "flex flex-col gap-0.5" : "flex flex-wrap gap-x-3 gap-y-px"}`}>
										<Show
											when={indicators().ma20 && t().ma20 && t().ma20 !== "—"}
										>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-red-500">MA 20</span>
												<span class="text-red-500">{t().ma20}</span>
											</div>
										</Show>
										<Show
											when={indicators().ma60 && t().ma60 && t().ma60 !== "—"}
										>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-green-500">MA 60 close 0</span>
												<span class="text-green-500">{t().ma60}</span>
											</div>
										</Show>
										<Show
											when={
												indicators().ma120 && t().ma120 && t().ma120 !== "—"
											}
										>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-blue-600">MA 120 close 0</span>
												<span class="text-blue-600">{t().ma120}</span>
											</div>
										</Show>
										<Show
											when={
												indicators().ema20 && t().ema20 && t().ema20 !== "—"
											}
										>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-yellow-400">EMA 20 close 0</span>
												<span class="text-yellow-400">{t().ema20}</span>
											</div>
										</Show>
										<Show
											when={
												indicators().ema60 && t().ema60 && t().ema60 !== "—"
											}
										>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-purple-400">EMA 60 close 0</span>
												<span class="text-purple-400">{t().ema60}</span>
											</div>
										</Show>
										<Show
											when={
												indicators().ema120 && t().ema120 && t().ema120 !== "—"
											}
										>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-orange-400">EMA 120 close 0</span>
												<span class="text-orange-400">{t().ema120}</span>
											</div>
										</Show>
										<Show
											when={
												indicators().donchianHigh &&
												t().donchianHigh &&
												t().donchianHigh !== "—"
											}
										>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-rose-500">20D HIGH</span>
												<span class="text-rose-500">{t().donchianHigh}</span>
											</div>
										</Show>
										<Show
											when={
												indicators().prevHigh &&
												t().prevHigh &&
												t().prevHigh !== "—"
											}
										>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-orange-500">PREV HIGH</span>
												<span class="text-orange-500">{t().prevHigh}</span>
											</div>
										</Show>
										<Show when={indicators().rsi && t().rsi}>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-[#7E57C2]">RSI 14</span>
												<span class="text-[#7E57C2]">{t().rsi}</span>
											</div>
										</Show>
										<Show when={indicators().atr && t().atr && t().atr !== "—"}>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-slate-400">ATR 14</span>
												<span class="text-slate-400">{t().atr}</span>
											</div>
										</Show>
										<Show when={indicators().fng && t().fng}>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-[#F7931A]">Fear & Greed</span>
												<span class="text-[#F7931A]">{t().fng}</span>
											</div>
										</Show>
										<Show when={indicators().tdSeq && t().tdLabel}>
											<div class="flex items-center gap-1.5 text-[10px] leading-none font-bold opacity-90">
												<span class="text-emerald-500">TD Sequential</span>
												<span class="text-emerald-500">{t().tdLabel}</span>
											</div>
										</Show>
									</div>
								</Show>
							</>
						)}
					</Show>
				</div>

			</div>
		</div>
	);
}
