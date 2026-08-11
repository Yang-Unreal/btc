import { createQuery } from "@tanstack/solid-query";
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
import {
	HL_INTERVAL_MAP,
	SUPPORTED_ASSETS,
} from "../lib/constants";
import { formatCryptoPrice } from "../lib/format";
import {
	calculateSMA,
} from "../lib/indicators";
import type {
	AssetConfig,
	Interval,
} from "../lib/types";

type BTCData = CandlestickData<UTCTimestamp> & {
	volume?: number;
};

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
	ma20?: string;
	ma60?: string;
	ma120?: string;
	tdLabel?: string;
	tdColor?: string;
	tdDescription?: string;
	snapY: number;
	currencySymbol: string;
	changeVal?: string;
	changePct?: string;
	/** Raw numeric open price — used to compute live change vs currentPrice() */
	openRaw?: number;
	/** Raw numeric close price — used to display the K-line's close price */
	closeRaw?: number;
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

export default function BTCChart() {
	let chartContainer: HTMLDivElement | undefined;
	let chart: IChartApi | undefined;
	let candlestickSeries: ISeriesApi<"Candlestick"> | undefined;
	let volumeSeries: ISeriesApi<"Histogram"> | undefined;
	let markersPrimitive: ISeriesMarkersPrimitive | undefined;
	let chartDisposed = false;

	// Indicator Series Refs
	let ma20Series: ISeriesApi<"Line"> | undefined;
	let ma60Series: ISeriesApi<"Line"> | undefined;
	let ma120Series: ISeriesApi<"Line"> | undefined;

	let ws: WebSocket | undefined;
	let wsPingInterval: number | undefined;
	let lastLoadedSymbol = "";
	let wsCurrentAssetSymbol = "";
	let wsCurrentInterval = "";
	let lastPriceUpdate = 0;

	const [isLoading, setIsLoading] = createSignal(true);
	const [isLoadingMore, setIsLoadingMore] = createSignal(false);
	const [wsConnected, setWsConnected] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	// Volume tracking for aggregated intervals
	const lastSubVols = new Map<number, number>();

	const [interval, setInterval] = createSignal<Interval>("4h");

	const [activeAsset, setActiveAsset] = createSignal<AssetConfig>(() => {
		try {
			const saved = localStorage.getItem("btc_active_asset");
			if (saved) {
				const parsed = JSON.parse(saved);
				const found = SUPPORTED_ASSETS.find(
					(a) => a.symbol === parsed.symbol,
				);
				if (found) return found;
			}
		} catch {
			// ignore
		}
		return SUPPORTED_ASSETS[0];
	});

	const [isMobile, setIsMobile] = createSignal(false);

	// Dropdown States

	const [showAssetMenu, setShowAssetMenu] = createSignal(false);
	const [assetSearchQuery, setAssetSearchQuery] = createSignal("");
	const [showIndicatorMenu, setShowIndicatorMenu] = createSignal(false);

	const [favoriteAssets, setFavoriteAssets] = createSignal<string[]>(() => {
		try {
			if (typeof localStorage !== "undefined") {
				const saved = localStorage.getItem("btc_favorite_assets");
				if (saved) {
					const parsed = JSON.parse(saved);
					if (Array.isArray(parsed)) return parsed;
				}
			}
		} catch {
			// ignore
		}
		return ["BTC", "ETH", "SOL"];
	});

	const getFavoriteAssets = (): string[] => {
		const raw = favoriteAssets();
		return Array.isArray(raw) ? raw : [];
	};

	const toggleFavorite = (symbol: string) => {
		setFavoriteAssets((prev) => {
			const list = Array.isArray(prev) ? prev : [];
			const next = list.includes(symbol)
				? list.filter((s) => s !== symbol)
				: [...list, symbol];
			try {
				if (typeof localStorage !== "undefined") {
					localStorage.setItem(
						"btc_favorite_assets",
						JSON.stringify(next),
					);
				}
			} catch {
				// ignore
			}
			return next;
		});
	};

	let favoriteSaveTimer: number | undefined;
	const saveFavoritesToDb = (symbols: string[]) => {
		try {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem(
					"btc_favorite_assets",
					JSON.stringify(symbols),
				);
			}
		} catch {
			// ignore
		}
		if (favoriteSaveTimer) window.clearTimeout(favoriteSaveTimer);
		favoriteSaveTimer = window.setTimeout(() => {
			fetch("/api/favorites", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ symbols }),
			}).catch((err) => console.error("Failed to save favorites", err));
		}, 300);
	};

	// const [tooltip, setTooltip] = createSignal<TooltipData | null>(null);
	const [currentPrice, setCurrentPrice] = createSignal<number>(0);
	const [chartReady, setChartReady] = createSignal(false);

	const [indicators, setIndicators] = createSignal<Record<string, boolean>>({
		ma20: false,
		ma60: false,
		ma120: false,
		tdSeq: false,
		volume: true,
	});

	// Track initial settings load to prevent layout shift
	const [settingsLoaded, setSettingsLoaded] = createSignal(false);

	// Favorite intervals
	const [favoriteIntervals, setFavoriteIntervals] = createSignal<Interval[]>([
		"4h",
	]);
	const [showIntervalDropdown, setShowIntervalDropdown] = createSignal(false);
	let intervalDropdownRef: HTMLDivElement | undefined;

	const IntervalDropdown = (props: { children: JSX.Element }) => {
		onMount(() => {
			const handler = (e: MouseEvent) => {
				if (
					intervalDropdownRef &&
					!intervalDropdownRef.contains(e.target as Node)
				) {
					setShowIntervalDropdown(false);
				}
			};
			document.addEventListener("mousedown", handler);
			onCleanup(() => {
				document.removeEventListener("mousedown", handler);
			});
		});
		return props.children;
	};

	// Persistence: Fetch initial indicators
	onMount(async () => {
		setSettingsLoaded(false);

		try {
			const [settingsRes, favoritesRes] = await Promise.all([
				fetch("/api/settings"),
				fetch("/api/favorites").catch(() => null),
			]);
			const settingsData = await settingsRes.json();

		if (settingsData.indicators) {
			setIndicators(settingsData.indicators);
		}
		if (settingsData.activeAsset) {
			const asset = SUPPORTED_ASSETS.find((a) => a.symbol === settingsData.activeAsset);
			if (asset) setActiveAsset(asset);
		}
		if (settingsData.interval) {
				const validInterval = intervals.find((i) => i.value === settingsData.interval);
				if (validInterval) setInterval(validInterval.value as Interval);
			}
			if (settingsData.favoriteIntervals && Array.isArray(settingsData.favoriteIntervals)) {
				setFavoriteIntervals(settingsData.favoriteIntervals as Interval[]);
			}

			if (favoritesRes && favoritesRes.ok) {
				const favData = await favoritesRes.json();
				if (Array.isArray(favData.favorites) && favData.favorites.length > 0) {
					setFavoriteAssets(favData.favorites);
				}
			}
			setSettingsLoaded(true);
		} catch (e) {
			console.error("Failed to load settings from DB", e);
			setSettingsLoaded(true);
		}
	});

		// Persistence: Save settings when changed (only after loading is complete)
	createEffect(() => {
		if (!settingsLoaded()) return;
		const currentIndicators = indicators();
		const currentInterval = interval();
		const currentAsset = activeAsset();

		fetch("/api/settings", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				indicators: currentIndicators,
				interval: currentInterval,
				activeAsset: currentAsset.symbol,
			}),
		}).catch((err) => console.error("Failed to save settings", err));
	});

	// Persistence: Save favorite intervals when changed
	createEffect(() => {
		if (!settingsLoaded()) return;
		const currentFavorites = favoriteIntervals();

		fetch("/api/settings", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				favoriteIntervals: currentFavorites,
			}),
		}).catch((err) => console.error("Failed to save favorite intervals", err));
	});

	// Persistence: Save favorite assets when changed
	createEffect(() => {
		const symbols = getFavoriteAssets();
		if (symbols.length === 0) return;
		saveFavoritesToDb(symbols);
	});

	const [btcData, setBtcData] = createSignal<BTCData[]>([]);
	const [tdMap, setTdMap] = createSignal<Map<number, TDState>>(new Map());

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
		{ label: "1M", value: "1M" },
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
			key: "tdSeq",
			label: "TD Sequential",
			color: "bg-emerald-600",
			textColor: "text-emerald-600",
			borderColor: "border-emerald-600",
		},
	];

	const INTERVAL_SECONDS: Record<Interval, number> = {
		"1m": 60,
		"3m": 180,
		"5m": 300,
		"15m": 900,
		"30m": 1800,
		"1h": 3600,
		"2h": 7200,
		"4h": 14400,
		"12h": 43200,
		"1d": 86400,
		"1w": 604800,
		"1M": 0,
		"3d": 0,
	};

	const isCandleClosed = (
		candleTime: number,
		intervalValue: Interval,
		now = Date.now(),
	) => {
		if (intervalValue === "1M") {
			const start = new Date(candleTime * 1000);
			const nextMonth = new Date(
				Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
			);
			return now >= nextMonth.getTime();
		}

		if (intervalValue === "1w") {
			const start = new Date(candleTime * 1000);
			const nextWeek = new Date(
				start.getTime() + INTERVAL_SECONDS["1w"] * 1000,
			);
			return now >= nextWeek.getTime();
		}

		const intervalSeconds = INTERVAL_SECONDS[intervalValue];
		if (!intervalSeconds) return true;
		return now >= (candleTime + intervalSeconds) * 1000;
	};

	const getStableChartData = (data: BTCData[]) => {
		if (data.length < 2) return data;

		const lastTime = data[data.length - 1].time as number;
		if (isCandleClosed(lastTime, interval())) return data;
		return data.slice(0, -1);
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

	const refreshAllMarkers = (data: BTCData[]) => {
		if (!markersPrimitive) return;
		const stableData = getStableChartData(data);
		const tdMarkers = calculateTDMarkers(stableData);

		const allMarkers = [...tdMarkers].sort(
			(a, b) => (a.time as number) - (b.time as number),
		);
		markersPrimitive.setMarkers(allMarkers);
	};

	// --- Modified Fetch History ---
	const fetchHistoricalData = async (
		activeInterval: Interval,
		currency: string,
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
				const ts = Math.floor(item[0]);
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

			const sortedData = mappedData.sort(
				(a: BTCData, b: BTCData) => (a.time as number) - (b.time as number),
			);

			return sortedData;
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
			"USD",
			activeAsset().hlSymbol || activeAsset().symbol,
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
							? "rgba(0, 243, 171, 0.5)"
							: "rgba(241, 45, 89, 0.5)",
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

	// --- Hyperliquid WebSocket Connection ---
	const connectWebSocket = (
		activeInterval: Interval,
		assetConfig: AssetConfig,
	) => {
		const coin = assetConfig.hlSymbol || assetConfig.symbol;
		const hlIntervalMapping = HL_INTERVAL_MAP[activeInterval] || "1h";
		const isAggregated = activeInterval === "1w" || activeInterval === "1M";
		const newInterval = isAggregated ? "1d" : hlIntervalMapping;

		// --- Interval swap: if WS is open and serving the same asset, only swap
		// the candle subscription — keep the trades channel alive for price continuity.
		if (
			ws &&
			ws.readyState === WebSocket.OPEN &&
			wsCurrentAssetSymbol === coin
		) {
			if (wsCurrentInterval !== newInterval) {
				// Unsubscribe old candle interval
				ws.send(
					JSON.stringify({
						method: "unsubscribe",
						subscription: { type: "candle", coin, interval: wsCurrentInterval },
					}),
				);
				// Subscribe new candle interval
				ws.send(
					JSON.stringify({
						method: "subscribe",
						subscription: { type: "candle", coin, interval: newInterval },
					}),
				);
				wsCurrentInterval = newInterval;
			}
			// Trades channel is untouched — no price jump!
			return;
		}

		// Full reconnect (new asset or WS not yet open)
		if (wsPingInterval !== undefined) {
			window.clearInterval(wsPingInterval);
			wsPingInterval = undefined;
		}
		if (ws) ws.close();
		ws = new WebSocket("wss://api.hyperliquid.xyz/ws");
		wsCurrentAssetSymbol = coin;
		wsCurrentInterval = newInterval;

		ws.onopen = () => {
			setWsConnected(true);
			// Subscribe to candle updates for the current interval
			ws?.send(
				JSON.stringify({
					method: "subscribe",
					subscription: { type: "candle", coin, interval: newInterval },
				}),
			);
			// Subscribe to trades for real-time last-price updates
			ws?.send(
				JSON.stringify({
					method: "subscribe",
					subscription: { type: "trades", coin },
				}),
			);
			// HL requires a ping every 30s to keep the connection alive
			wsPingInterval = window.setInterval(() => {
				if (ws?.readyState === WebSocket.OPEN)
					ws.send(JSON.stringify({ method: "ping" }));
			}, 30_000);
		};

		ws.onclose = () => {
			setWsConnected(false);
			if (wsPingInterval !== undefined) {
				window.clearInterval(wsPingInterval);
				wsPingInterval = undefined;
			}
		};
		ws.onerror = () => setWsConnected(false);

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);

				// Ignore pong / subscription ack
				if (
					!msg ||
					msg.channel === "subscriptionResponse" ||
					msg.channel === "pong"
				)
					return;

				// 1. Real-time trades → extract last price for top-left display (throttled)
				if (
					msg.channel === "trades" &&
					Array.isArray(msg.data) &&
					msg.data.length > 0
				) {
					const now = Date.now();
					if (now - lastPriceUpdate > 200) {
						const lastTrade = msg.data[msg.data.length - 1];
						if (lastTrade?.coin === coin && lastTrade?.px) {
							setCurrentPrice(parseFloat(lastTrade.px));
							lastPriceUpdate = now;
						}
					}
					return;
				}

				// 2. Candle updates → push to chart
				if (msg.channel === "candle" && msg.data && candlestickSeries) {
					// HL sends a single candle object (not an array) for live updates.
					// On subscription it sends an isSnapshot:true array — ignore that,
					// our REST history is authoritative.
					const candles = Array.isArray(msg.data) ? msg.data : [msg.data];
					if (candles[0]?.isSnapshot) return;

					const currentHistory = untrack(() => btcData());
					const lastKnownTs =
						currentHistory.length > 0
							? (currentHistory[currentHistory.length - 1].time as number)
							: 0;

					for (const candle of candles) {
						// Verify the candle is for our current subscription
						if (candle.s !== coin) continue;

						// HL candle: { t: openTimeMs, T: closeTimeMs, s, i, o, c, h, l, v, n }
						let ts = Math.floor(candle.t / 1000) as UTCTimestamp;

						// Aggregation logic for 1w/1M
						if (activeInterval === "1w") {
							const date = new Date(candle.t);
							const day = date.getUTCDay();
							const diff = day === 0 ? 6 : day - 1;
							const monday = new Date(candle.t - diff * 86400000);
							monday.setUTCHours(0, 0, 0, 0);
							ts = (monday.getTime() / 1000) as UTCTimestamp;
						} else if (activeInterval === "1M") {
							const date = new Date(candle.t);
							const first = new Date(
								Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
							);
							ts = (first.getTime() / 1000) as UTCTimestamp;
						}

						if (ts < lastKnownTs) continue;

						let newData: BTCData = {
							time: ts,
							open: parseFloat(candle.o),
							high: parseFloat(candle.h),
							low: parseFloat(candle.l),
							close: parseFloat(candle.c),
							volume: parseFloat(candle.v),
						};

						// Track sub-interval volume deltas to prevent double-counting on aggregated candles
						const subTs = Math.floor(candle.t / 1000);
						const prevSubVol = lastSubVols.get(subTs) || 0;
						const currentSubVol = newData.volume || 0;
						const subDelta = currentSubVol - prevSubVol;
						lastSubVols.set(subTs, currentSubVol);

						// For aggregated candles, we must merge with the existing candle if the timestamp matches
						const isAggregated =
							activeInterval === "1w" || activeInterval === "1M";
						if (
							isAggregated &&
							ts === lastKnownTs &&
							currentHistory.length > 0
						) {
							const lastCandle = currentHistory[currentHistory.length - 1];
							newData = {
								time: ts,
								open: lastCandle.open, // Keep original open
								high: Math.max(lastCandle.high, newData.high),
								low: Math.min(lastCandle.low, newData.low),
								close: newData.close,
								volume:
									(lastCandle.volume || 0) + (prevSubVol === 0 ? 0 : subDelta),
							};
							// Note: If prevSubVol is 0, it's the first time we see this sub-interval (day)
							// in this session. We don't add the whole volume because the week's history
							// likely already included it. We only add subsequent deltas.
						}

						candlestickSeries.update(newData);
						if (volumeSeries && newData.volume !== undefined) {
							volumeSeries.update({
								time: newData.time,
								value: newData.volume,
								color:
									newData.close >= newData.open
										? "rgba(0, 243, 171, 0.5)"
										: "rgba(241, 45, 89, 0.5)",
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

		if (currentInd.ma20) updateSeries(ma20Series, calculateSMA, 20);
		if (currentInd.ma60) updateSeries(ma60Series, calculateSMA, 60);
		if (currentInd.ma120) updateSeries(ma120Series, calculateSMA, 120);

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
			return formatCryptoPrice(val, "USD");
		};

		const volumeVal = lastCandle.volume;
		const formattedVolume =
			volumeVal !== undefined
				? volumeVal.toLocaleString(undefined, {
						minimumFractionDigits: 0,
						maximumFractionDigits: volumeVal < 1 ? 4 : 2,
					})
				: "—";

		// Calculate values for latest candle
		const closes = data.map((d) => d.close);
		const highs = data.map((d) => d.high);

		const ma20 = calculateSMA(closes, 20);
		const ma60 = calculateSMA(closes, 60);
		const ma120 = calculateSMA(closes, 120);

		const change = lastCandle.close - lastCandle.open;
		const changePct = (change / lastCandle.open) * 100;

		setLegendData({
			time: dateStr,
			open: formatValue(lastCandle.open),
			high: formatValue(lastCandle.high),
			low: formatValue(lastCandle.low),
			close: formatValue(lastCandle.close),
			changeVal: `${change >= 0 ? "+" : ""}${formatValue(change)}`,
			changePct: `${change >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
			volume: formattedVolume,
			currencySymbol: "$",
			changeColor:
				lastCandle.close >= lastCandle.open
					? "text-emerald-500"
					: "text-rose-500",
			ma20: formatValue(ma20[ma20.length - 1]),
			ma60: formatValue(ma60[ma60.length - 1]),
			ma120: formatValue(ma120[ma120.length - 1]),

		tdLabel: tdMap().get(lastCandle.time as number)?.label,
		// Raw open value used by JSX to compute live change vs currentPrice()
			openRaw: lastCandle.open,
			closeRaw: lastCandle.close,
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
		ma20Series?.applyOptions({ visible: !!currentInd.ma20 });
		ma60Series?.applyOptions({ visible: !!currentInd.ma60 });
		ma120Series?.applyOptions({ visible: !!currentInd.ma120 });

		volumeSeries?.applyOptions({ visible: !!currentInd.volume });

		const totalHeight = chartContainer?.clientHeight || 450;

		chart.priceScale("right").applyOptions({
			scaleMargins: { top: 0.1, bottom: 0.1 },
		});

		untrack(() => refreshAllMarkers(currentData));

		if (!currentData.length) return;
		const closes = currentData.map((d) => d.close);

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
	};

	// --- History Query ---
	const historyQuery = createQuery(() => ({
		queryKey: [
			"history",
			interval(),
			activeAsset().symbol,
		],
		queryFn: async () => {
			return await fetchHistoricalData(
				interval(),
				"USD",
				activeAsset().hlSymbol || activeAsset().symbol,
			);
		},
		staleTime: 60 * 1000 * 5, // Cache for 5 minutes for instant interval switching
	}));

	createEffect(() => {
		if (candlestickSeries) {
			candlestickSeries.applyOptions({
				priceFormat: {
					type: "custom",
					formatter: (price: number) =>
						formatCryptoPrice(price, "USD"),
				},
			});
		}
	});

	createEffect(() => {
		const historyData = historyQuery.data;
		const isFetching = historyQuery.isFetching;
		const fetchError = historyQuery.error;
		const ready = chartReady();

		untrack(() => {
			if (!historyData) {
				if (isFetching) {
					setIsLoading(true);
				}
				return;
			}

			if (!ready || !candlestickSeries) return;

			setIsLoading(false);
			setError(
				fetchError ? "A serious error occurred while loading data" : null,
			);

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
								? "rgba(0, 243, 171, 0.5)"
								: "rgba(241, 45, 89, 0.5)",
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
				// Reset sub-volume tracking when changing interval/asset
				lastSubVols.clear();
			}
		});
	});

	onMount(() => {
		if (!chartContainer) return;

		const handler = (e: ErrorEvent) => {
			if (
				e instanceof ErrorEvent &&
				e.message === "Object is disposed"
			) {
				e.preventDefault();
				e.stopPropagation();
			}
		};
		window.addEventListener("error", handler);

		chart = createChart(chartContainer, {
			layout: {
				background: { color: "#0b0a1a" },
				textColor: "#a0a0b8",
			},
			grid: {
				vertLines: { color: "#1c1b33" },
				horzLines: { color: "#1c1b33" },
			},
			width: chartContainer.clientWidth,
			height: chartContainer.clientHeight,
			crosshair: {
				mode: 0,
				vertLine: {
					width: 1,
					color: "#882ff2",
					style: 3,
					labelBackgroundColor: "#882ff2",
				},
				horzLine: { color: "#882ff2", labelBackgroundColor: "#882ff2" },
			},
			timeScale: {
				timeVisible: true,
				secondsVisible: false,
				borderColor: "#25244a",
			},
			rightPriceScale: {
				borderColor: "#25244a",
				scaleMargins: { top: 0.1, bottom: 0.2 },
			},
			handleScale: { axisPressedMouseMove: true },
			handleScroll: { vertTouchDrag: false },
		});

		candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: "#00f3ab",
			downColor: "#f12d59",
			borderVisible: true,
			wickUpColor: "#00f3ab",
			wickDownColor: "#f12d59",
			priceFormat: {
				type: "custom",
				formatter: (price: number) =>
					formatCryptoPrice(price, "USD"),
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

		ma20Series = createLineSeries("#EF4444"); // red-500
		ma60Series = createLineSeries("#22C55E"); // green-500
		ma120Series = createLineSeries("#2563EB"); // blue-600

	const oscillatorOptions = {
		crosshairMarkerVisible: false,
		lineWidth: 1 as const,
		priceLineVisible: false,
		lastValueVisible: true,
	};

		let lastTooltipTime: number | null = null;
		let cachedTooltipData: Omit<TooltipData, "x" | "y" | "snapY"> | null = null;
		let crosshairRafId: number | null = null;

		const scheduleLegendUpdate = () => {
			if (crosshairRafId !== null) return;
			crosshairRafId = requestAnimationFrame(() => {
				crosshairRafId = null;
				const data = untrack(() => btcData());
				if (data.length > 0) updateLegendToLatest(data);
			});
		};

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
				scheduleLegendUpdate();
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
				return formatCryptoPrice(val, "USD"); // Includes symbol
			};

			const volumeVal = volumeSeries
				? (param.seriesData.get(volumeSeries) as HistogramData)
				: undefined;
			const formattedVolume = volumeVal
				? (Math.round(volumeVal.value * 100) / 100).toLocaleString()
				: "—";

			const snapY = candlestickSeries.priceToCoordinate(candle.close);

			const tdStatus = tdMap().get(Number(param.time));
			let tdColor = "";
			if (tdStatus) {
				if (tdStatus.type === "buy")
					tdColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
				else tdColor = "bg-rose-50 text-rose-700 border-rose-100";
				if (tdStatus.stage === "countdown")
					tdColor = "bg-amber-50 text-amber-700 border-amber-100";
			}

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
				openRaw: candle.open,
				closeRaw: candle.close,
				changeVal: `${candle.close - candle.open >= 0 ? "+" : ""}${formatTooltipPrice(candle.close - candle.open)}`,
				changePct: `${((candle.close - candle.open) / candle.open) * 100 >= 0 ? "+" : ""}${(((candle.close - candle.open) / candle.open) * 100).toFixed(2)}%`,
				volume: formattedVolume,
			currencySymbol: "$",
				changeColor:
					candle.close >= candle.open ? "text-emerald-600" : "text-rose-500",
			ma20: formatTooltipPrice(ma20Val?.value),
				ma60: formatTooltipPrice(ma60Val?.value),
			ma120: formatTooltipPrice(ma120Val?.value),

			tdLabel: tdStatus?.label,
			tdColor: tdColor,
			tdDescription: tdStatus?.description,
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
				chart.applyOptions({
					width: chartContainer.clientWidth,
					height: chartContainer.clientHeight,
				});
			}
			setIsMobile(window.innerWidth < 640);
		};

		handleResize();
		let resizeObserver: ResizeObserver | undefined;
		if (typeof ResizeObserver !== "undefined" && chartContainer) {
			resizeObserver = new ResizeObserver(() => {
				if (chart && chartContainer && chartContainer.clientWidth > 0 && chartContainer.clientHeight > 0) {
					chart.applyOptions({
						width: chartContainer.clientWidth,
						height: chartContainer.clientHeight,
					});
				}
			});
			resizeObserver.observe(chartContainer);
		}
		window.addEventListener("resize", handleResize);

		const handleMouseMove = (e: MouseEvent) => {
			syncAllIndicators();
		};

		onCleanup(() => {
			chartDisposed = true;
			if (ws) ws.close();
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("error", handler);
			if (resizeObserver) resizeObserver.disconnect();
			if (loadMoreTimer) clearTimeout(loadMoreTimer);
			if (wsPingInterval !== undefined) window.clearInterval(wsPingInterval);
			if (favoriteSaveTimer) window.clearTimeout(favoriteSaveTimer);
			if (chart) {
				try {
					chart.remove();
				} catch (e) {
					if (
						e instanceof Error &&
						e.message === "Object is disposed"
					) {
						return;
					}
					throw e;
				}
				chart = undefined;
				candlestickSeries = undefined;
			}
		});

		setChartReady(true);
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
				<div class="relative z-50 bg-[#05051a]">
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
									<span class="text-slate-500 font-bold">/ USDC</span>
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
															<span
																class={
																	activeAsset().symbol === asset.symbol
																		? "text-white"
																		: "text-slate-200"
																}
															>
																{asset.symbol}
															</span>
															<span class="text-slate-500">/USDC</span>
														</div>
														<div
															onClick={(e) => {
																e.stopPropagation();
																toggleFavorite(asset.symbol);
															}}
															class="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
															role="button"
															tabIndex={0}
														>
															<svg class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
																<title>Remove from favorites</title>
																<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
															</svg>
														</div>
													</button>
												)}
											</For>
										</div>
									</div>
								</Show>
							</div>
						{/* Large price */}
						<div class="text-[22px] font-mono font-black text-emerald-400 leading-tight mt-0.5">
							{formatCryptoPrice(currentPrice(), "USD")}
						</div>
						</div>
					{/* Connection indicator */}
					<div class="flex items-center">
						{wsConnected() ? <IconPulse /> : <IconWifiOff />}
					</div>
					</div>

					{/* Row 2: Favorite intervals + dropdown with all intervals */}
					<div class="flex items-center gap-1.5 px-4 pb-2 overflow-x-auto no-scrollbar">
						{/* Show favorite intervals directly (no star - favorites managed in dropdown) */}
						<For each={favoriteIntervals()}>
							{(fav) => {
								const opt = intervals.find((i) => i.value === fav);
								return opt ? (
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
								) : null;
							}}
						</For>
						{/* Dropdown with all intervals */}
						<div class="relative shrink-0" ref={intervalDropdownRef}>
							<button
								type="button"
								class="flex items-center gap-1 px-3 py-1.5 text-[12px] font-bold rounded-md bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all"
								onClick={() => setShowIntervalDropdown(!showIntervalDropdown())}
							>
								<svg
									class="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<title>More options</title>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
									/>
								</svg>
								<svg
									class="w-3 h-3"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<title>Expand dropdown</title>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</button>
						<Show when={showIntervalDropdown()}>
							<IntervalDropdown>
								<div class="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-md shadow-lg py-1 min-w-35">
									<For each={intervals}>
										{(opt) => (
											<div
												class="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
												onClick={() => {
													setInterval(opt.value);
													setShowIntervalDropdown(false);
												}}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														setInterval(opt.value);
														setShowIntervalDropdown(false);
													}
												}}
												role="option"
												tabIndex={0}
											>
												<button
													type="button"
													class="p-0.5"
													onClick={(e) => {
														e.stopPropagation();
														const current = favoriteIntervals();
														if (current.includes(opt.value)) {
															setFavoriteIntervals(
																current.filter((i) => i !== opt.value),
															);
														} else {
															setFavoriteIntervals([...current, opt.value]);
														}
													}}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.stopPropagation();
															const current = favoriteIntervals();
															if (current.includes(opt.value)) {
																setFavoriteIntervals(
																	current.filter((i) => i !== opt.value),
																);
															} else {
																setFavoriteIntervals([...current, opt.value]);
															}
														}
													}}
													aria-label={
														favoriteIntervals().includes(opt.value)
															? "Remove from favorites"
															: "Add to favorites"
													}
												>
													<svg
														class={`w-3 h-3 ${favoriteIntervals().includes(opt.value) ? "text-yellow-400" : "text-slate-600"}`}
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<title>
															{favoriteIntervals().includes(opt.value)
																? "Remove from favorites"
																: "Add to favorites"}
														</title>
														<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
													</svg>
												</button>
													<span>{opt.label.toUpperCase()}</span>
												</div>
											)}
										</For>
									</div>
								</IntervalDropdown>
							</Show>
						</div>
					</div>

					{/* Row 3: SELECT INDICATORS button (Bitget-style) */}
					<div class="px-4 pb-2">
						<div class="relative">
							<button
								type="button"
								onClick={() => setShowIndicatorMenu(!showIndicatorMenu())}
								class="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-md text-[11px] font-black text-slate-300 uppercase tracking-wider hover:bg-white/8 transition-colors w-full justify-center"
							>
								<svg
									class="w-3.5 h-3.5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<title>Indicators</title>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16"
									/>
								</svg>
								Select Indicators
								<IconChevronDown />
							</button>
							<Show when={showIndicatorMenu()}>
								<div
									class="fixed inset-0 z-40"
									onClick={() => setShowIndicatorMenu(false)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ")
											setShowIndicatorMenu(false);
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
													<svg
														class="w-3.5 h-3.5 text-indigo-400"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<title>Active</title>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="3"
															d="M5 13l4 4L19 7"
														/>
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
								{activeAsset().symbol}/USDC <IconChevronDown />
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
										<Show when={!assetSearchQuery() && getFavoriteAssets().length > 0}>
											<div class="px-3 py-1.5 text-[9px] font-bold text-amber-400 uppercase tracking-widest border-b border-white/5 mb-1 flex items-center gap-1">
												<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
													<title>Favorites</title>
													<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
												</svg>
												Favorites
											</div>
											<For each={SUPPORTED_ASSETS.filter((a) => getFavoriteAssets().includes(a.symbol) && (a.name.toLowerCase().includes(assetSearchQuery().toLowerCase()) || a.symbol.toLowerCase().includes(assetSearchQuery().toLowerCase())))}>
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
														<span class="text-slate-500">/USDC</span>
													</div>
													<div
														onClick={(e) => {
															e.stopPropagation();
															toggleFavorite(asset.symbol);
														}}
														class="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
														role="button"
														tabIndex={0}
													>
														<svg class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
															<title>Remove from favorites</title>
															<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
														</svg>
													</div>
												</button>
												)}
											</For>
										</Show>
										<div class="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1 flex items-center gap-1">
											<svg class="w-3 h-3" fill="none" viewBox="0 0 20 20" stroke="currentColor">
												<title>All assets</title>
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											All Assets
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
														<span class="text-slate-500">/USDC</span>
													</div>
												<div class="flex items-center gap-1">
													<span class="font-mono text-[9px] opacity-40 shrink-0 uppercase">
														{asset.name}
													</span>
													<div
														onClick={(e) => {
															e.stopPropagation();
															toggleFavorite(asset.symbol);
														}}
														class="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
														role="button"
														tabIndex={0}
													>
<svg class={`w-3.5 h-3.5 ${getFavoriteAssets().includes(asset.symbol) ? "text-amber-400" : "text-slate-600 hover:text-slate-400"}`} fill="currentColor" viewBox="0 0 20 20">
    <title>{getFavoriteAssets().includes(asset.symbol) ? "Remove from favorites" : "Add to favorites"}</title>
															<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
														</svg>
													</div>
												</div>
											</button>
											)}
										</For>
									</div>
								</div>
							</Show>
							<div class="text-[14px] font-mono font-bold text-emerald-500 ml-2">
								{formatCryptoPrice(currentPrice(), "USD")}
							</div>
						</div>

						{/* Time Intervals - favorites shown directly + dropdown */}
						<div class="flex items-center gap-1 mr-4">
							{/* Favorite intervals shown directly (no star - favorites managed in dropdown) */}
							<For each={favoriteIntervals()}>
								{(fav) => {
									const opt = intervals.find((i) => i.value === fav);
									return opt ? (
										<button
											type="button"
											class={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
												interval() === opt.value
													? "bg-indigo-600 text-white"
													: "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
											}`}
											onClick={() => setInterval(opt.value)}
										>
											{opt.label.toUpperCase()}
										</button>
									) : null;
								}}
							</For>
							{/* Dropdown with all intervals */}
							<div class="relative" ref={intervalDropdownRef}>
								<button
									type="button"
									class="p-1 text-slate-500 hover:text-white"
									onClick={() =>
										setShowIntervalDropdown(!showIntervalDropdown())
									}
								>
									<svg
										class="w-4 h-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<title>More options</title>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
										/>
									</svg>
								</button>
							<Show when={showIntervalDropdown()}>
								<IntervalDropdown>
									<div class="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-md shadow-lg py-1 min-w-35">
										<For each={intervals}>
											{(opt) => (
												<div
													class="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
													onClick={() => {
														setInterval(opt.value);
														setShowIntervalDropdown(false);
													}}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															setInterval(opt.value);
															setShowIntervalDropdown(false);
														}
													}}
													role="option"
													tabIndex={0}
												>
													<button
														type="button"
														class="p-0.5"
														onClick={(e) => {
															e.stopPropagation();
															const current = favoriteIntervals();
															if (current.includes(opt.value)) {
																setFavoriteIntervals(
																	current.filter((i) => i !== opt.value),
																);
															} else {
																setFavoriteIntervals([...current, opt.value]);
															}
														}}
														onKeyDown={(e) => {
															if (e.key === "Enter" || e.key === " ") {
																e.stopPropagation();
																const current = favoriteIntervals();
																if (current.includes(opt.value)) {
																	setFavoriteIntervals(
																		current.filter((i) => i !== opt.value),
																	);
																} else {
																	setFavoriteIntervals([...current, opt.value]);
																}
															}
														}}
														aria-label={
															favoriteIntervals().includes(opt.value)
																? "Remove from favorites"
																: "Add to favorites"
														}
													>
														<svg
															class={`w-3 h-3 ${favoriteIntervals().includes(opt.value) ? "text-yellow-400" : "text-slate-600"}`}
															fill="currentColor"
															viewBox="0 0 20 20"
														>
															<title>
																{favoriteIntervals().includes(opt.value)
																	? "Remove from favorites"
																	: "Add to favorites"}
															</title>
															<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
														</svg>
													</button>
													<span>{opt.label.toUpperCase()}</span>
												</div>
											)}
										</For>
									</div>
								</IntervalDropdown>
							</Show>
						</div>
						</div>

						<div class="relative">
							<button
								type="button"
								onClick={() => setShowIndicatorMenu(!showIndicatorMenu())}
								class="p-1.5 text-slate-400 hover:text-white"
							>
								<svg
									class="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<title>Indicators</title>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16"
									/>
								</svg>
							</button>
							<Show when={showIndicatorMenu()}>
								<div
									class="fixed inset-0 z-40"
									onClick={() => setShowIndicatorMenu(false)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ")
											setShowIndicatorMenu(false);
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
					<div class="flex items-center gap-2 px-2 border-l border-white/5">
						<div class="flex items-center">
							{wsConnected() ? <IconPulse /> : <IconWifiOff />}
						</div>
					</div>
				</div>
				</div>
			</Show>
			<div class="relative w-full h-[calc(100vh-10rem)] group cursor-crosshair touch-action-none bg-[#0b0e14]">
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
											{activeAsset().symbol}/USDC perpetual last price ·
											Hyperliquid · {interval().toUpperCase()}
										</div>
										{/* C: show the candle's close price when hovering, otherwise use last candle */}
										{(() => {
											const hasHoverData =
												legendData()?.closeRaw !== undefined &&
												legendData()?.closeRaw !== 0;
											const data = legendData();
											const closePrice = hasHoverData
												? (data?.closeRaw ?? 0)
												: (data?.closeRaw ?? data?.openRaw ?? 0);
											const openVal = data?.openRaw ?? 0;
											const liveChange = closePrice - openVal;
											const liveChangePct =
												openVal > 0 ? (liveChange / openVal) * 100 : 0;
											const liveColor =
												liveChange >= 0 ? "text-emerald-500" : "text-rose-500";
											const closePriceStr = formatCryptoPrice(
												closePrice,
												"USD",
											);
											const liveChangeStr = `${liveChange >= 0 ? "+" : ""}${formatCryptoPrice(liveChange, "USD")}`;
											const liveChangePctStr = `${liveChangePct >= 0 ? "+" : ""}${liveChangePct.toFixed(2)}%`;
											return (
												<div class="flex items-center gap-1">
													<span class={liveColor}>{closePriceStr}</span>
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
											{activeAsset().symbol}/USDC · {interval().toUpperCase()} ·
											Hyperliquid
										</span>
										{/* O/H/L: per-candle values (legitimately differ across intervals). */}
										{/* C: show the candle's close price when hovering, otherwise use last candle */}
										{(() => {
											const hasHoverData =
												legendData()?.closeRaw !== undefined &&
												legendData()?.closeRaw !== 0;
											const data = legendData();
											const closePrice = hasHoverData
												? (data?.closeRaw ?? 0)
												: (data?.closeRaw ?? data?.openRaw ?? 0);
											const openVal = data?.openRaw ?? 0;
											const liveChange = closePrice - openVal;
											const liveChangePct =
												openVal > 0 ? (liveChange / openVal) * 100 : 0;
											const liveColor =
												liveChange >= 0 ? "text-emerald-500" : "text-rose-500";
											const closePriceStr = formatCryptoPrice(
												closePrice,
												"USD",
											);
											const liveChangeStr = `${liveChange >= 0 ? "+" : ""}${formatCryptoPrice(liveChange, "USD")}`;
											const liveChangePctStr = `${liveChangePct >= 0 ? "+" : ""}${liveChangePct.toFixed(2)}%`;
											return (
												<div class="flex items-center gap-1.5 ml-1 scale-90 origin-left">
													<span class="text-slate-500 font-medium">O</span>
													<span class={t().changeColor}>{t().open}</span>
													<span class="text-slate-500 font-medium ml-1">H</span>
													<span class={t().changeColor}>{t().high}</span>
													<span class="text-slate-500 font-medium ml-1">L</span>
													<span class={t().changeColor}>{t().low}</span>
													<span class="text-slate-500 font-medium ml-1">C</span>
													<span class={liveColor}>{closePriceStr}</span>
													<span class={`${liveColor} ml-1`}>
														{liveChangeStr}
													</span>
													<span class={liveColor}>({liveChangePctStr})</span>
												</div>
											);
										})()}
									</div>
								</Show>

								{/* Indicators - stacked vertically on mobile, flex-wrap on desktop */}
								<Show when={Object.values(indicators()).some((v) => v)}>
									<div
										class={`bg-black/20 p-1.5 rounded w-fit ${isMobile() ? "flex flex-col gap-0.5" : "flex flex-wrap gap-x-3 gap-y-px"}`}
									>
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
