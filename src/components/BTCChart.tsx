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
import { formatCryptoPrice } from "../lib/format";

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
	{ symbol: "SUI", name: "Sui", krakenId: "SUI" },
	{ symbol: "PEPE", name: "Pepe", krakenId: "PEPE" },
	{ symbol: "VIRTUAL", name: "Virtuals Protocol", krakenId: "VIRTUAL" },
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

const IconTrendUp = (props: { class?: string }) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Trend Up</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
		/>
	</svg>
);

const IconTrendDown = (props: { class?: string }) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Trend Down</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"
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
				type: "custom",
				formatter: (price: number) =>
					formatCryptoPrice(price, activeCurrency().symbol),
				minMove: 0.00000001,
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
			const dateStr = new Date(Number(param.time) * 1000).toLocaleString(
				"en-US",
				{ month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
			);

			const formatTooltipPrice = (val: number | undefined) => {
				if (val === undefined || val === null || Number.isNaN(val)) return "—";
				return formatCryptoPrice(val, ""); // No symbol here, we add it in JSX if needed, or pass it
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
				open: formatTooltipPrice(candle.open),
				high: formatTooltipPrice(candle.high),
				low: formatTooltipPrice(candle.low),
				close: formatTooltipPrice(candle.close),
				volume: formattedVolume,
				currencySymbol: activeCurrency().symbol,
				changeColor:
					candle.close >= candle.open ? "text-emerald-600" : "text-rose-500",
				ema20: formatTooltipPrice(
					(ema20Series &&
					param.seriesData.get(ema20Series) &&
					"value" in (param.seriesData.get(ema20Series) as any)
						? (param.seriesData.get(ema20Series) as any).value
						: undefined) as any,
				),
				ema60: formatTooltipPrice(
					(ema60Series &&
					param.seriesData.get(ema60Series) &&
					"value" in (param.seriesData.get(ema60Series) as any)
						? (param.seriesData.get(ema60Series) as any).value
						: undefined) as any,
				),
				rsi:
					rsiVal && typeof rsiVal.value === "number"
						? rsiVal.value.toFixed(1)
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
		if (candlestickSeries) {
			candlestickSeries.applyOptions({
				priceFormat: {
					type: "custom",
					formatter: (price: number) =>
						formatCryptoPrice(price, activeCurrency().symbol),
				},
			});
			loadData(interval(), activeCurrency(), activeAsset());
		}
	});

	return (
		<div class="my-4 md:my-8 directive-card overflow-hidden">
			{/* Top Bar - High Density */}
			<div class="flex flex-col lg:flex-row justify-between items-stretch lg:items-center p-3 sm:p-4 border-b border-white/5 bg-white/2">
				<div class="flex items-center gap-3 mb-4 lg:mb-0 justify-between lg:justify-start">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 bg-white/5 border border-white/10 flex items-center justify-center text-white font-mono font-bold text-xs">
							{activeAsset().symbol.substring(0, 1)}
						</div>
						<div class="flex flex-col">
							<div class="flex items-center gap-2 relative">
								{/* Asset Dropdown */}
								<div class="relative">
									<button
										type="button"
										onClick={() => setShowAssetMenu(!showAssetMenu())}
										class="flex items-center gap-1 text-sm font-black text-white uppercase tracking-tighter hover:text-indigo-400 transition-colors"
									>
										{activeAsset().name}
										<IconChevronDown />
									</button>
									<Show when={showAssetMenu()}>
										<div
											class="fixed inset-0 z-40"
											onClick={() => setShowAssetMenu(false)}
											onKeyDown={(e) => {
												if (e.key === "Escape") setShowAssetMenu(false);
											}}
											tabIndex={-1}
											role="button"
										/>
										<div class="absolute left-0 top-full mt-1 w-48 bg-[#151921] border border-white/10 shadow-2xl z-50 py-1 max-h-64 overflow-y-auto no-scrollbar">
											<For each={SUPPORTED_ASSETS}>
												{(asset) => (
													<button
														type="button"
														class={`w-full text-left px-3 py-2 text-[11px] font-bold hover:bg-white/5 flex items-center justify-between ${activeAsset().symbol === asset.symbol ? "text-indigo-400 bg-white/5" : "text-slate-400"}`}
														onClick={() => {
															setActiveAsset(asset);
															setShowAssetMenu(false);
														}}
													>
														<span>{asset.name}</span>
														<span class="font-mono text-[9px] opacity-50">
															{asset.symbol}
														</span>
													</button>
												)}
											</For>
										</div>
									</Show>
								</div>

								<span class="text-white/20 font-light -translate-y-px">|</span>

								{/* Currency Selector */}
								<div class="relative">
									<button
										type="button"
										onClick={() => setShowCurrencyMenu(!showCurrencyMenu())}
										class="flex items-center gap-1 text-slate-500 font-bold hover:text-white transition-colors text-[10px] uppercase tracking-widest"
									>
										{activeCurrency().code}
										<IconChevronDown />
									</button>

									<Show when={showCurrencyMenu()}>
										<div
											class="fixed inset-0 z-40"
											onClick={() => setShowCurrencyMenu(false)}
											onKeyDown={(e) => {
												if (e.key === "Escape") setShowCurrencyMenu(false);
											}}
											tabIndex={-1}
											role="button"
										/>
										<div class="absolute left-0 top-full mt-1 w-24 bg-[#151921] border border-white/10 shadow-2xl z-50 py-1">
											<For each={CURRENCIES}>
												{(c) => (
													<button
														type="button"
														class={`w-full text-left px-3 py-2 text-[10px] font-black hover:bg-white/5 uppercase tracking-widest ${activeCurrency().code === c.code ? "text-indigo-400 bg-white/5" : "text-slate-400"}`}
														onClick={() => {
															setActiveCurrency(c);
															setShowCurrencyMenu(false);
														}}
													>
														{c.code}
													</button>
												)}
											</For>
										</div>
									</Show>
								</div>

								{/* Connection Status */}
								<div class="flex items-center px-2 py-0.5 bg-white/5 border border-white/10 ml-2">
									{wsConnected() ? <IconPulse /> : <IconWifiOff />}
									<span class="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] hidden sm:inline">
										{wsConnected() ? "Live_Ops" : "Dormant"}
									</span>
								</div>
							</div>

							{/* Price Display */}
							<div
								class={`text-xl font-mono font-black tracking-tighter tabular-nums leading-none mt-1 transition-colors duration-200 ${priceColor()}`}
							>
								{formatCryptoPrice(currentPrice(), activeCurrency().symbol)}
							</div>
						</div>
					</div>
				</div>

				{/* Interval Selection - Darker tabs */}
				<div class="flex bg-white/5 border border-white/10 p-1 self-start lg:self-auto overflow-x-auto no-scrollbar max-w-full">
					<For each={intervals}>
						{(opt) => (
							<button
								type="button"
								class={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all ${interval() === opt.value ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
								onClick={() => setInterval(opt.value)}
							>
								{opt.label}
							</button>
						)}
					</For>
				</div>
			</div>

			{/* Secondary Bar: Indicators - Compressed */}
			<div class="px-4 py-3 border-b border-white/5 bg-white/1 backdrop-blur-sm">
				<div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
					<span class="text-[9px] font-bold text-slate-600 uppercase tracking-[0.3em] mr-4 shrink-0">
						Data_Layers
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
								class={`flex items-center gap-2 px-2.5 py-1 border text-[9px] font-black uppercase tracking-widest transition-all shrink-0 select-none ${indicators()[ind.key] ? `bg-white/5 ${ind.textColor} border-indigo-500/40` : "bg-transparent text-slate-600 border-white/5 hover:border-white/10 hover:text-slate-400"}`}
							>
								<span
									class={`w-1.5 h-1.5 ${ind.color} ${indicators()[ind.key] ? "opacity-100" : "opacity-20"}`}
								></span>
								{ind.label}
							</button>
						)}
					</For>
				</div>
			</div>

			{/* Chart Area */}
			<div class="relative h-[450px] md:h-[550px] w-full group cursor-crosshair touch-action-none bg-[#0b0e14]">
				<Show when={isLoading()}>
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0e14]/80 backdrop-blur-sm">
						<div class="flex flex-col items-center gap-4">
							<div class="w-10 h-10 border-2 border-white/5 border-t-indigo-500 animate-spin"></div>
							<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em] animate-pulse">
								Reconstructing_Market_State
							</span>
						</div>
					</div>
				</Show>

				<Show when={error()}>
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0e14]/90">
						<div class="badge-directive text-rose-500 border-rose-500/50 px-4 py-3 bg-rose-500/5">
							CRITICAL_FAILURE: {error()}
						</div>
					</div>
				</Show>

				<div ref={chartContainer} class="w-full h-full opacity-90" />

				{/* Institutional Floating Tooltip */}
				<Show when={tooltip()} keyed>
					{(t) => (
						<>
							{/* Reticle Dot */}
							<div
								class="hidden md:block absolute w-2 h-2 bg-white border border-black shadow-[0_0_10px_rgba(255,255,255,0.5)] pointer-events-none z-10"
								style={{
									top: "0",
									left: "0",
									transform: `translate(${t.x - 4}px, ${t.snapY - 4}px)`,
								}}
							/>
							{/* Data Panel */}
							<div
								class={`absolute z-30 pointer-events-none bg-[#151921]/95 backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-75 ease-out flex flex-col ${isMobile() ? "top-2 left-2 right-2 border-t-2 border-t-indigo-500" : "w-64"}`}
								style={
									!isMobile()
										? {
												top: "0",
												left: "0",
												transform: `translate(${Math.min(Math.max(12, t.x + 20), (chartContainer?.clientWidth ?? 800) - 270)}px, ${Math.max(12, t.snapY - 340)}px)`,
											}
										: {}
								}
							>
								{/* Tooltip Header */}
								<div class="px-3 py-2 border-b border-white/5 flex justify-between items-center bg-white/2">
									<span class="text-[10px] font-mono font-black text-white p-0">
										{t.time}
									</span>
									<div class="flex items-center gap-1.5">
										<Show when={t.changeColor.includes("emerald")}>
											<IconTrendUp class="w-2.5 h-2.5 text-emerald-400" />
										</Show>
										<Show when={t.changeColor.includes("rose")}>
											<IconTrendDown class="w-2.5 h-2.5 text-rose-400" />
										</Show>
										<span
											class={`text-[9px] font-black uppercase tracking-widest ${t.changeColor}`}
										>
											{t.changeColor.includes("emerald")
												? "DELTA_POS"
												: "DELTA_NEG"}
										</span>
									</div>
								</div>

								{/* Tooltip Body */}
								<div class="p-4 space-y-5">
									<div class="grid grid-cols-2 gap-x-6 gap-y-4">
										<div class="space-y-3">
											<div class="flex flex-col">
												<span class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
													OPEN
												</span>
												<span class="text-[11px] font-mono font-bold text-slate-300">
													{t.currencySymbol}
													{t.open}
												</span>
											</div>
											<div class="flex flex-col">
												<span class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
													LOW
												</span>
												<span class="text-[11px] font-mono font-bold text-slate-300">
													{t.currencySymbol}
													{t.low}
												</span>
											</div>
										</div>
										<div class="space-y-3">
											<div class="flex flex-col">
												<span class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
													HIGH
												</span>
												<span class="text-[11px] font-mono font-bold text-slate-300">
													{t.currencySymbol}
													{t.high}
												</span>
											</div>
											<div class="flex flex-col border-l border-indigo-500/20 pl-3">
												<span class="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
													TERMINAL
												</span>
												<div class="flex items-center gap-2">
													<Show when={t.changeColor.includes("emerald")}>
														<IconTrendUp class="w-2.5 h-2.5 text-emerald-400" />
													</Show>
													<Show when={t.changeColor.includes("rose")}>
														<IconTrendDown class="w-2.5 h-2.5 text-rose-400" />
													</Show>
													<span
														class={`text-xs font-mono font-black ${t.changeColor}`}
													>
														{t.currencySymbol}
														{t.close}
													</span>
												</div>
											</div>
										</div>
										<div class="col-span-2 pt-2 border-t border-white/5 flex justify-between items-center">
											<span class="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
												VOL_TOTAL
											</span>
											<span class="text-[10px] font-mono font-bold text-slate-400">
												{t.volume}
											</span>
										</div>
									</div>

									{/* Indicators Section */}
									<Show
										when={
											t.ema20 ||
											t.ema60 ||
											t.ema120 ||
											t.ema150 ||
											t.ema200 ||
											t.rsi ||
											t.fng ||
											t.tdLabel
										}
									>
										<div class="space-y-3 pt-3 border-t border-white/5">
											{/* Technical Overlay */}
											<div class="grid grid-cols-2 gap-2">
												<Show
													when={
														t.ema20 ||
														t.ema60 ||
														t.ema120 ||
														t.ema150 ||
														t.ema200
													}
												>
													<div class="flex flex-col gap-0.5">
														<span class="text-[7px] font-bold text-slate-500 uppercase">
															EMA_AVG
														</span>
														<div class="flex flex-wrap gap-x-2 gap-y-1">
															<Show when={t.ema20}>
																<span class="text-[9px] font-mono text-blue-400">
																	{t.ema20}
																</span>
															</Show>
															<Show when={t.ema60}>
																<span class="text-[9px] font-mono text-emerald-400">
																	{t.ema60}
																</span>
															</Show>
															<Show when={t.ema120}>
																<span class="text-[9px] font-mono text-orange-400">
																	{t.ema120}
																</span>
															</Show>
															<Show when={t.ema150}>
																<span class="text-[9px] font-mono text-pink-400">
																	{t.ema150}
																</span>
															</Show>
															<Show when={t.ema200}>
																<span class="text-[9px] font-mono text-purple-400">
																	{t.ema200}
																</span>
															</Show>
														</div>
													</div>
												</Show>
												<div class="flex flex-col gap-2">
													<Show when={t.rsi}>
														<div class="flex flex-col gap-0.5">
															<span class="text-[7px] font-bold text-slate-500 uppercase">
																RSI_14
															</span>
															<span class="text-[9px] font-mono text-indigo-400">
																{t.rsi}
															</span>
														</div>
													</Show>
													<Show when={t.fng}>
														<div class="flex flex-col gap-0.5">
															<span class="text-[7px] font-bold text-slate-500 uppercase">
																FEAR_GREED
															</span>
															<span
																class={`text-[9px] font-mono ${t.fngClass}`}
															>
																{t.fng}
															</span>
														</div>
													</Show>
												</div>
											</div>

											{/* Signals */}
											<Show when={t.tdLabel}>
												<div class="bg-indigo-500/5 border border-indigo-500/10 p-2">
													<div class="flex items-center gap-2 mb-1">
														<span class="w-1.5 h-1.5 bg-indigo-500 animate-pulse"></span>
														<span class="text-[9px] font-black text-white uppercase tracking-tighter">
															{t.tdLabel}
														</span>
													</div>
													<p class="text-[8px] text-slate-400 leading-tight uppercase font-bold tracking-tight">
														{t.tdDescription}
													</p>
												</div>
											</Show>
										</div>
									</Show>
								</div>

								{/* Tooltip Footer */}
								<div class="px-3 py-1.5 border-t border-white/5 bg-white/2 flex justify-between items-center">
									<span class="text-[7px] font-black text-slate-600 uppercase tracking-widest">
										MOD_TER_ALPHA_V3
									</span>
									<span class="text-[7px] font-mono text-indigo-500/50">
										SECURED_FEED
									</span>
								</div>
							</div>
						</>
					)}
				</Show>
			</div>
		</div>
	);
}
