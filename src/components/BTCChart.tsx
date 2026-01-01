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
} from "solid-js";

type BTCData = CandlestickData<UTCTimestamp> & { volume?: number };
type RawKlineData = [number, number, number, number, number, number];
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

type CurrencyCode = "USD" | "EUR" | "GBP";

interface CurrencyConfig {
	code: CurrencyCode;
	symbol: string;
	wsPair: string; // Kraken WS uses "XBT/USD", "XBT/EUR"
	locale: string;
}

// Configuration for supported currencies
const CURRENCIES: CurrencyConfig[] = [
	{ code: "USD", symbol: "$", wsPair: "XBT/USD", locale: "en-US" },
	{ code: "EUR", symbol: "€", wsPair: "XBT/EUR", locale: "de-DE" },
	{ code: "GBP", symbol: "£", wsPair: "XBT/GBP", locale: "en-GB" },
];

interface AssetConfig {
	symbol: string;
	name: string;
	krakenId: string; // Used for WS pair construction
}

const SUPPORTED_ASSETS: AssetConfig[] = [
	{ symbol: "BTC", name: "Bitcoin", krakenId: "XBT" },
	{ symbol: "ETH", name: "Ethereum", krakenId: "ETH" },
	{ symbol: "SOL", name: "Solana", krakenId: "SOL" },
	{ symbol: "DOGE", name: "Dogecoin", krakenId: "XDG" },
	{ symbol: "LINK", name: "Chainlink", krakenId: "LINK" },
	{ symbol: "TIA", name: "Celestia", krakenId: "TIA" },
	{ symbol: "ONDO", name: "Ondo", krakenId: "ONDO" },
	{ symbol: "PENDLE", name: "Pendle", krakenId: "PENDLE" },
	{ symbol: "TAO", name: "Bittensor", krakenId: "TAO" },
	{ symbol: "AERO", name: "Aerodrome", krakenId: "AERO" },
	{ symbol: "RENDER", name: "Render", krakenId: "RENDER" },
	{ symbol: "AKT", name: "Akash Network", krakenId: "AKT" },
	{ symbol: "EWT", name: "Energy Web Token", krakenId: "EWT" },
	{ symbol: "AAVE", name: "Aave", krakenId: "AAVE" },
	{ symbol: "TON", name: "Toncoin", krakenId: "TON" },
	{ symbol: "HNT", name: "Helium", krakenId: "HNT" },
	{ symbol: "KAS", name: "Kaspa", krakenId: "KAS" },
	{ symbol: "NIGHT", name: "Midnight", krakenId: "NIGHT" },
];

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
	ema150?: string;
	ema200?: string;
	rsi?: string;
	rsiDivergence?: string;
	fng?: string;
	fngClass?: string;
	tdLabel?: string;
	tdColor?: string;
	tdDescription?: string;
	snapY: number;
	currencySymbol: string;
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

const IconLayers = () => (
	<svg
		class="w-4 h-4 mr-2"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<title>Indicators</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
		/>
	</svg>
);

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
	let ema150Series: ISeriesApi<"Line"> | undefined;
	let ema200Series: ISeriesApi<"Line"> | undefined;
	let rsiSeries: ISeriesApi<"Line"> | undefined;
	let fngSeries: ISeriesApi<"Line"> | undefined;

	let ws: WebSocket | undefined;

	const [isLoading, setIsLoading] = createSignal(true);
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
	const [showIntervalMenu, setShowIntervalMenu] = createSignal(false);
	const [showIndicatorMenu, setShowIndicatorMenu] = createSignal(false);
	const [showCurrencyMenu, setShowCurrencyMenu] = createSignal(false);
	const [showAssetMenu, setShowAssetMenu] = createSignal(false);

	const [tooltip, setTooltip] = createSignal<TooltipData | null>(null);
	const [currentPrice, setCurrentPrice] = createSignal<number>(0);
	const [priceColor, setPriceColor] = createSignal("text-gray-900");

	const [indicators, setIndicators] = createSignal<Record<string, boolean>>({
		ema20: false,
		ema60: true,
		ema120: false,
		ema150: false,
		ema200: true,
		rsi: false,
		fng: false,
		tdSeq: true,
	});

	const [btcData, setBtcData] = createSignal<BTCData[]>([]);
	const [fngCache, setFngCache] = createSignal<Map<number, number>>(new Map());
	const [tdMap, setTdMap] = createSignal<Map<number, TDState>>(new Map());
	const [divMap, setDivMap] = createSignal<Map<number, DivergenceState>>(
		new Map(),
	);

	// EMA Cache signals
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

	// Indicator Config (omitted for brevity, same as original)
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
			color: "bg-[#10B981]",
			textColor: "text-[#10B981]",
			borderColor: "border-[#10B981]",
		},
		{
			key: "ema120",
			label: "EMA 120",
			color: "bg-[#F59E0B]",
			textColor: "text-[#F59E0B]",
			borderColor: "border-[#F59E0B]",
		},
		{
			key: "ema150",
			label: "EMA 150",
			color: "bg-[#EC4899]",
			textColor: "text-[#EC4899]",
			borderColor: "border-[#EC4899]",
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

	// --- Helper Functions (EMA, RSI, TDSeq) match original file ---
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
	): Promise<BTCData[]> => {
		try {
			// Pass currency and symbol to API
			const url = `/api/history?interval=${activeInterval}&currency=${currency}&symbol=${assetSymbol}`;
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
				volume: item[5],
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

	// --- Modified WebSocket Connection ---
	const connectWebSocket = (
		activeInterval: Interval,
		currencyConfig: CurrencyConfig,
		assetConfig: AssetConfig,
	) => {
		if (ws) ws.close();
		ws = new WebSocket("wss://ws.kraken.com");

		const wsPair = `${assetConfig.krakenId}/${currencyConfig.code}`;

		ws.onopen = () => {
			setWsConnected(true);
			const krakenInterval = mapIntervalToKrakenWS(activeInterval);
			ws?.send(
				JSON.stringify({
					event: "subscribe",
					pair: [wsPair], // Dynamic Pair
					subscription: { name: "ohlc", interval: krakenInterval },
				}),
			);
		};

		ws.onclose = () => setWsConnected(false);
		ws.onerror = () => setWsConnected(false);

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				// Check if array and has valid structure (API sometimes sends heartbeat/status objects)
				if (Array.isArray(data) && data[1] && candlestickSeries) {
					// Ensure we are processing the correct pair (last element usually string pair name)
					const pairName = data[data.length - 1];
					const currentWsPair = `${assetConfig.krakenId}/${currencyConfig.code}`;
					if (pairName !== currentWsPair) return;

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
						volume: parseFloat(kline[7]),
					};

					const price = newData.close;
					const prev = currentPrice();
					if (price > prev) setPriceColor("text-emerald-500");
					else if (price < prev) setPriceColor("text-rose-500");
					setCurrentPrice(price);

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

	// --- Update Realtime Indicators (Same as original) ---
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
		refreshAllMarkers(currentData);
	};

	// --- Load Data ---
	const loadData = async (
		activeInterval: Interval,
		currencyConfig: CurrencyConfig,
		assetConfig: AssetConfig,
	) => {
		if (!candlestickSeries) return;
		setIsLoading(true);
		setError(null);

		setBtcData([]);
		candlestickSeries.setData([]);
		if (volumeSeries) volumeSeries.setData([]);
		setTdMap(new Map());

		// Reset indicators
		if (markersPrimitive) {
			try {
				markersPrimitive.setMarkers([]);
			} catch {
				/* ignore */
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
			if (s) s.setData([]);
		});

		const history = await fetchHistoricalData(
			activeInterval,
			currencyConfig.code,
			assetConfig.symbol,
		);

		if (history.length > 0) {
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
			setCurrentPrice(history[history.length - 1].close);
			chart?.timeScale().fitContent();
			refreshAllMarkers(history);
		}

		connectWebSocket(activeInterval, currencyConfig, assetConfig);
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
				type: "price",
				precision: 5,
				minMove: 0.00001,
			},
		});

		volumeSeries = chart.addSeries(HistogramSeries, {
			color: "#26a69a",
			priceFormat: {
				type: "volume",
			},
			priceScaleId: "volume",
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
				lineWidth: 2,
				crosshairMarkerVisible: false,
			});

		ema20Series = createLineSeries("#2196F3");
		ema60Series = createLineSeries("#10B981");
		ema120Series = createLineSeries("#F59E0B");
		ema150Series = createLineSeries("#EC4899");
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
			const safeFixed = (
				val: number | null | undefined,
				digits: number = 6,
			) => {
				if (val === null || val === undefined || Number.isNaN(val)) return "—";
				return val.toFixed(digits);
			};

			const getVal = (series: ISeriesApi<"Line"> | undefined) => {
				const val = series ? param.seriesData.get(series) : undefined;
				if (
					val &&
					"value" in val &&
					typeof (val as LineData).value === "number"
				) {
					return safeFixed((val as LineData).value);
				}
				return undefined;
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
			const snapY = candlestickSeries.priceToCoordinate(candle.close);
			const dateStr = new Date(Number(param.time) * 1000).toLocaleString(
				"en-US",
				{ month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
			);

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

			setTooltip({
				x: param.point.x,
				y: param.point.y,
				time: dateStr,
				open: safeFixed(candle.open),
				high: safeFixed(candle.high),
				low: safeFixed(candle.low),
				close: safeFixed(candle.close),
				volume: formattedVolume,
				changeColor:
					candle.close >= candle.open ? "text-emerald-600" : "text-rose-500",
				ema20: indicators().ema20 ? getVal(ema20Series) : undefined,
				ema60: indicators().ema60 ? getVal(ema60Series) : undefined,
				ema120: indicators().ema120 ? getVal(ema120Series) : undefined,
				ema150: indicators().ema150 ? getVal(ema150Series) : undefined,
				ema200: indicators().ema200 ? getVal(ema200Series) : undefined,
				rsi:
					rsiVal && typeof rsiVal.value === "number"
						? safeFixed(rsiVal.value, 1)
						: undefined,
				fng: fngNum?.toString(),
				fngClass,
				snapY: snapY ?? param.point.y,
				tdLabel: tdStatus?.label,
				tdColor: tdColor,
				tdDescription: tdStatus?.description,
				rsiDivergence: divStatus
					? `${divStatus.type === "bullish" ? "Bull" : "Bear"} Div: ${divStatus.priceAction} / RSI ${divStatus.rsiAction}`
					: undefined,
				currencySymbol: activeCurrency().symbol, // Use active currency symbol
			});
		});

		// Initial Load
		loadData(interval(), activeCurrency(), activeAsset());

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
			}
			window.removeEventListener("resize", handleResize);
		});
	});

	// --- Layout & Indicator Effect (Simplified, Same as original logic) ---
	createEffect(() => {
		const currentData = btcData();
		const currentInd = indicators();

		if (!chart || !candlestickSeries) return;

		if (currentInd.rsi || currentInd.fng) {
			chart
				.priceScale("right")
				.applyOptions({ scaleMargins: { top: 0.1, bottom: 0.3 } });
			chart.priceScale("oscillators").applyOptions({
				visible: true,
				scaleMargins: { top: 0.75, bottom: 0.05 },
			});
		} else {
			chart
				.priceScale("right")
				.applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
			chart.priceScale("oscillators").applyOptions({ visible: false });
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
			setLast: (n: number | null) => void,
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
				setLast(null);
			}
		};
		processEMA(currentInd.ema20, ema20Series, 20, setLastEMA20);
		processEMA(currentInd.ema60, ema60Series, 60, setLastEMA60);
		processEMA(currentInd.ema120, ema120Series, 120, setLastEMA120);
		processEMA(currentInd.ema150, ema150Series, 150, setLastEMA150);
		processEMA(currentInd.ema200, ema200Series, 200, setLastEMA200);

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

	// --- React to Interval OR Currency Change ---
	createEffect(() => {
		// Dependencies: interval(), activeCurrency(), activeAsset()
		if (candlestickSeries)
			loadData(interval(), activeCurrency(), activeAsset());
	});

	return (
		<div class="my-4 md:my-8 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden font-sans ring-1 ring-slate-100">
			{/* Top Bar */}
			<div class="flex flex-col lg:flex-row justify-between items-stretch lg:items-center p-3 sm:p-5 border-b border-slate-100 bg-white">
				<div class="flex items-center gap-3 sm:gap-4 mb-4 lg:mb-0 justify-between lg:justify-start">
					<div class="flex items-center gap-3 sm:gap-4">
						<div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-sm sm:text-base">
							{activeAsset().symbol[0]}
						</div>
						<div>
							<div class="flex items-center gap-2 relative">
								{/* Asset Dropdown */}
								<div class="relative">
									<button
										type="button"
										onClick={() => setShowAssetMenu(!showAssetMenu())}
										class="flex items-center gap-1 text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-none hover:text-indigo-600 transition-colors"
									>
										<span class="hidden sm:inline">{activeAsset().name}</span>
										<span class="sm:hidden">{activeAsset().symbol}</span>
										<IconChevronDown />
									</button>
									<Show when={showAssetMenu()}>
										<div
											class="fixed inset-0 z-40 cursor-default"
											onClick={() => setShowAssetMenu(false)}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													setShowAssetMenu(false);
													e.preventDefault();
												}
											}}
											role="button"
											aria-label="Close asset menu"
											tabIndex={0}
										/>
										<div class="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 py-1 max-h-64 overflow-y-auto">
											<For each={SUPPORTED_ASSETS}>
												{(asset) => (
													<button
														type="button"
														class={`w-full text-left px-3 py-2 text-sm font-bold hover:bg-slate-50 flex items-center justify-between ${activeAsset().symbol === asset.symbol ? "text-indigo-600 bg-slate-50" : "text-slate-600"}`}
														onClick={() => {
															setActiveAsset(asset);
															setShowAssetMenu(false);
														}}
													>
														<span>{asset.name}</span>
														<span class="text-xs text-slate-400">
															{asset.symbol}
														</span>
													</button>
												)}
											</For>
										</div>
									</Show>
								</div>

								<span class="text-slate-400 font-normal hidden sm:inline">
									/
								</span>

								{/* Currency Selector */}
								<div class="relative">
									<button
										type="button"
										onClick={() => setShowCurrencyMenu(!showCurrencyMenu())}
										class="flex items-center gap-1 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs sm:text-sm"
									>
										{activeCurrency().code}
										<IconChevronDown />
									</button>

									<Show when={showCurrencyMenu()}>
										<div
											class="fixed inset-0 z-40 cursor-default"
											onClick={() => setShowCurrencyMenu(false)}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													setShowCurrencyMenu(false);
													e.preventDefault();
												}
											}}
											role="button"
											aria-label="Close currency menu"
											tabIndex={0}
										/>
										<div class="absolute left-0 top-full mt-1 w-24 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 py-1">
											<For each={CURRENCIES}>
												{(c) => (
													<button
														type="button"
														class={`w-full text-left px-3 py-2 text-sm font-bold hover:bg-slate-50 ${activeCurrency().code === c.code ? "text-indigo-600 bg-slate-50" : "text-slate-600"}`}
														onClick={() => {
															setActiveCurrency(c);
															setShowCurrencyMenu(false);
														}}
													>
														{c.code} ({c.symbol})
													</button>
												)}
											</For>
										</div>
									</Show>
								</div>

								{/* Connection Status */}
								<div class="flex items-center px-1.5 py-0.5 sm:px-2 rounded-full bg-slate-100 border border-slate-200 ml-1 sm:ml-2">
									{wsConnected() ? <IconPulse /> : <IconWifiOff />}
									<span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
										{wsConnected() ? "Live" : "Offline"}
									</span>
								</div>
							</div>

							{/* Price Display */}
							<div
								class={`text-xl sm:text-2xl font-mono font-bold tracking-tight leading-tight transition-colors duration-300 ${priceColor()}`}
							>
								{`${activeCurrency().symbol}${currentPrice().toFixed(6)}`}
							</div>
						</div>
					</div>

					<Show when={isMobile()}>
						<div class="relative z-30">
							<button
								type="button"
								onClick={() => {
									setShowIntervalMenu(!showIntervalMenu());
									setShowAssetMenu(false);
									setShowCurrencyMenu(false);
									setShowIndicatorMenu(false);
								}}
								class="flex items-center justify-between gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
							>
								{intervals.find((i) => i.value === interval())?.label}
								<IconChevronDown />
							</button>

							<Show when={showIntervalMenu()}>
								<div
									class="fixed inset-0 z-40"
									onClick={() => setShowIntervalMenu(false)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											setShowIntervalMenu(false);
											e.preventDefault();
										}
									}}
									role="button"
									aria-label="Close interval menu"
									tabIndex={0}
								/>
								<div class="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 py-2">
									<For each={intervals}>
										{(opt) => (
											<button
												type="button"
												class={`w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors ${interval() === opt.value ? "text-indigo-600 bg-indigo-50/50" : "text-slate-600"}`}
												onClick={() => {
													setInterval(opt.value);
													setShowIntervalMenu(false);
												}}
											>
												{opt.label}
											</button>
										)}
									</For>
								</div>
							</Show>
						</div>
					</Show>
				</div>

				<Show when={!isMobile()}>
					<div class="flex bg-slate-50 border border-slate-100 p-1 rounded-xl self-start lg:self-auto overflow-x-auto max-w-full shadow-xs">
						<For each={intervals}>
							{(opt) => (
								<button
									type="button"
									class={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap ${interval() === opt.value ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"}`}
									onClick={() => setInterval(opt.value)}
								>
									{opt.label}
								</button>
							)}
						</For>
					</div>
				</Show>
			</div>

			{/* Secondary Bar: Indicators */}
			<div class="px-6 py-4 border-b border-slate-100 bg-slate-50/30 backdrop-blur-sm">
				<Show when={!isMobile()}>
					<div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
						<span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-3 shrink-0">
							Overlay Indicators
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
									class={`group flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all duration-200 shrink-0 select-none ${indicators()[ind.key] ? `bg-white ${ind.textColor} border-indigo-200 shadow-xs ring-1 ring-indigo-50` : "bg-white/50 text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"}`}
								>
									<span
										class={`w-2 h-2 rounded-full ${ind.color} ${indicators()[ind.key] ? "opacity-100 shadow-xs" : "opacity-30 group-hover:opacity-60"}`}
									></span>
									{ind.label}
								</button>
							)}
						</For>
					</div>
				</Show>

				<Show when={isMobile()}>
					<div class="relative z-20">
						<button
							type="button"
							onClick={() => {
								setShowIndicatorMenu(!showIndicatorMenu());
								setShowAssetMenu(false);
								setShowCurrencyMenu(false);
								setShowIntervalMenu(false);
							}}
							class="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-3 py-2 rounded-lg border border-slate-200"
						>
							<IconLayers />
							<span>Customize Indicators</span>
							<span class="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1">
								{Object.values(indicators()).filter(Boolean).length}
							</span>
							<IconChevronDown />
						</button>
						<Show when={showIndicatorMenu()}>
							<div
								class="fixed inset-0 z-40"
								onClick={() => setShowIndicatorMenu(false)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										setShowIndicatorMenu(false);
										e.preventDefault();
									}
								}}
								role="button"
								aria-label="Close indicator menu"
								tabIndex={0}
							/>
							<div class="absolute left-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 p-2 space-y-1">
								<div class="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">
									Active Chart Overlays
								</div>
								<For each={indicatorConfig}>
									{(ind) => (
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												setIndicators((prev) => ({
													...prev,
													[ind.key]: !prev[ind.key],
												}));
											}}
											class={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${indicators()[ind.key] ? "bg-indigo-50/40" : "hover:bg-slate-50"}`}
										>
											<div class="flex items-center gap-3">
												<span
													class={`w-2.5 h-2.5 rounded-full ${ind.color} ${indicators()[ind.key] ? "shadow-xs" : "opacity-40"}`}
												></span>
												<span
													class={`font-bold ${indicators()[ind.key] ? "text-slate-900" : "text-slate-500"}`}
												>
													{ind.label}
												</span>
											</div>
											<div
												class={`w-8 h-4 rounded-full transition-colors relative ${indicators()[ind.key] ? "bg-indigo-500" : "bg-slate-200"}`}
											>
												<div
													class={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${indicators()[ind.key] ? "left-4.5" : "left-0.5"}`}
												/>
											</div>
										</button>
									)}
								</For>
							</div>
						</Show>
					</div>
				</Show>
			</div>

			{/* Chart Area */}
			<div class="relative h-[400px] md:h-[500px] w-full group cursor-crosshair touch-action-none bg-white">
				<Show when={isLoading()}>
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-xs transition-all">
						<div class="flex flex-col items-center gap-4">
							<div class="w-12 h-12 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin shadow-xs"></div>
							<span class="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
								Syncing Market...
							</span>
						</div>
					</div>
				</Show>
				<Show when={error()}>
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-white/90">
						<div class="flex items-center gap-3 text-rose-600 font-bold bg-rose-50 px-5 py-4 rounded-2xl border border-rose-100 shadow-sm">
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
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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
								class="hidden md:block absolute w-3.5 h-3.5 bg-indigo-600 rounded-full border-3 border-white shadow-md pointer-events-none z-10 transition-transform duration-75 ease-out"
								style={{
									top: "0",
									left: "0",
									transform: `translate(${t().x - 7}px, ${t().snapY - 7}px)`,
								}}
							/>
							<div
								class={`absolute z-30 pointer-events-none bg-white/98 backdrop-blur-md border border-slate-200/60 shadow-xl p-4 transition-all duration-100 ease-out flex flex-col gap-4 ${isMobile() ? "top-4 left-4 right-4 rounded-2xl border-l-4 border-l-indigo-500" : "rounded-2xl w-72"}`}
								style={
									!isMobile()
										? {
												top: "0",
												left: "0",
												transform: `translate(${Math.min(Math.max(16, t().x + 24), (chartContainer?.clientWidth ?? 800) - 312)}px, ${Math.min(Math.max(16, t().y - 64), (chartContainer?.clientHeight ?? 500) - 300)}px)`,
											}
										: {}
								}
							>
								<div class="flex justify-between items-center pb-3 border-b border-slate-50">
									<div class="text-slate-400 font-black uppercase tracking-widest text-[10px]">
										{t().time}
									</div>
									<div
										class={`px-2 py-0.5 rounded text-[10px] font-black ${t().changeColor === "text-emerald-600" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
									>
										{t().changeColor === "text-emerald-600" ? "BULL" : "BEAR"}
									</div>
								</div>

								<Show when={t().tdLabel}>
									<div
										class={`px-3 py-2.5 rounded-xl border flex flex-col gap-1 ${t().tdColor?.replace("bg-", "bg-opacity-50 bg-") || ""}`}
									>
										<span class="font-black text-[11px] flex items-center gap-2">
											<span class="w-2 h-2 rounded-full bg-current animate-pulse shadow-xs"></span>
											{t().tdLabel}
										</span>
										<span class="text-[10px] font-semibold opacity-80 leading-relaxed">
											{t().tdDescription}
										</span>
									</div>
								</Show>

								<div class="grid grid-cols-2 gap-x-6 gap-y-3">
									<div class="flex flex-col gap-0.5">
										<span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
											Open
										</span>
										<span class="font-mono text-slate-700 font-bold text-sm">
											{t().currencySymbol}
											{t().open}
										</span>
									</div>
									<div class="flex flex-col gap-0.5">
										<span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
											High
										</span>
										<span class="font-mono text-slate-700 font-bold text-sm">
											{t().currencySymbol}
											{t().high}
										</span>
									</div>
									<div class="flex flex-col gap-0.5">
										<span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
											Low
										</span>
										<span class="font-mono text-slate-700 font-bold text-sm">
											{t().currencySymbol}
											{t().low}
										</span>
									</div>
									<div class="flex flex-col gap-0.5">
										<span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
											Close
										</span>
										<span
											class={`font-mono font-black text-sm ${t().changeColor}`}
										>
											{t().currencySymbol}
											{t().close}
										</span>
									</div>
									<div class="flex flex-col gap-0.5 col-span-2 mt-1 pt-1 border-t border-slate-50">
										<span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
											Volume
										</span>
										<span class="font-mono text-slate-700 font-bold text-xs">
											{t().volume}
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
									<div class="border-t border-slate-50 pt-3 space-y-2">
										<div class="flex flex-wrap gap-x-4 gap-y-2">
											<Show when={t().ema20}>
												<div class="flex items-center gap-1.5 text-[10px]">
													<span class="w-2 h-2 rounded-full bg-[#2196F3] shadow-xs"></span>
													<span class="text-slate-400 font-bold">E20</span>
													<span class="font-mono text-slate-700 font-bold">
														{t().ema20}
													</span>
												</div>
											</Show>
											<Show when={t().ema60}>
												<div class="flex items-center gap-1.5 text-[10px]">
													<span class="w-2 h-2 rounded-full bg-[#10B981] shadow-xs"></span>
													<span class="text-slate-400 font-bold">E60</span>
													<span class="font-mono text-slate-700 font-bold">
														{t().ema60}
													</span>
												</div>
											</Show>
											<Show when={t().ema120}>
												<div class="flex items-center gap-1.5 text-[10px]">
													<span class="w-2 h-2 rounded-full bg-[#F59E0B] shadow-xs"></span>
													<span class="text-slate-400 font-bold">E120</span>
													<span class="font-mono text-slate-700 font-bold">
														{t().ema120}
													</span>
												</div>
											</Show>
											<Show when={t().ema150}>
												<div class="flex items-center gap-1.5 text-[10px]">
													<span class="w-2 h-2 rounded-full bg-[#EC4899] shadow-xs"></span>
													<span class="text-slate-400 font-bold">E150</span>
													<span class="font-mono text-slate-700 font-bold">
														{t().ema150}
													</span>
												</div>
											</Show>
											<Show when={t().ema200}>
												<div class="flex items-center gap-1.5 text-[10px]">
													<span class="w-2 h-2 rounded-full bg-[#9C27B0] shadow-xs"></span>
													<span class="text-slate-400 font-bold">E200</span>
													<span class="font-mono text-slate-700 font-bold">
														{t().ema200}
													</span>
												</div>
											</Show>
											<Show when={t().rsi}>
												<div class="flex flex-col gap-1">
													<div class="flex items-center gap-1.5 text-[10px]">
														<span class="w-2 h-2 rounded-full bg-[#7E57C2] shadow-xs"></span>
														<span class="text-slate-400 font-bold">RSI</span>
														<span class="font-mono text-slate-700 font-bold">
															{t().rsi}
														</span>
													</div>
													<Show when={t().rsiDivergence}>
														<div class="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 italic">
															{t().rsiDivergence}
														</div>
													</Show>
												</div>
											</Show>
											<Show when={t().fng}>
												<div class="flex items-center gap-1.5 text-[10px]">
													<span class="w-2 h-2 rounded-full bg-[#F7931A] shadow-xs"></span>
													<span class="text-slate-400 font-bold">F&G</span>
													<span class={`font-black ${t().fngClass}`}>
														{t().fng}
													</span>
												</div>
											</Show>
										</div>
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
