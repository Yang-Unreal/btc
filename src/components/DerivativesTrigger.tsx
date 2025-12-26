import {
	type Component,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";

// --- Icons ---
const IconChart: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Chart</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
		/>
	</svg>
);

const IconFire: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Fire</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
		/>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
		/>
	</svg>
);

const IconScale: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Scale</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
		/>
	</svg>
);

const IconRefresh: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Refresh</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
		/>
	</svg>
);

// --- Types ---
interface DerivativesData {
	openInterest: {
		total: number;
		change24h: number;
		btcEquivalent: number;
	};
	fundingRate: {
		avg: number;
		binance: number;
		bybit: number;
		okx: number;
	};
	longShortRatio: {
		ratio: number;
		longs: number;
		shorts: number;
	};
	signal: "Long Squeeze Risk" | "Short Squeeze Opportunity" | "Neutral";
	signalColor: "rose" | "emerald" | "slate";
	priceOiDivergence: string;
	isDemo: boolean;
}

// --- Main Component ---
export default function DerivativesTrigger() {
	const [data, setData] = createSignal<DerivativesData | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [lastUpdated, setLastUpdated] = createSignal<Date | null>(null);

	const fetchData = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/derivatives");
			if (res.ok) {
				const json = await res.json();
				if (!json.error) {
					setData(json);
					setLastUpdated(new Date());
				}
			}
		} catch (e) {
			console.error("Failed to fetch derivatives data:", e);
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
		const timer = setInterval(fetchData, 60000); // 1 min refresh
		onCleanup(() => clearInterval(timer));
	});

	// Funding rate gauge (maps -0.1% to 0.15% -> 0-100)
	const fundingGaugePosition = () => {
		const d = data();
		if (!d) return 50;
		const rate = d.fundingRate.avg;
		return Math.min(100, Math.max(0, ((rate + 0.05) / 0.15) * 100));
	};

	const fundingColor = () => {
		const d = data();
		if (!d) return "text-slate-700";
		const rate = d.fundingRate.avg;
		if (rate > 0.05) return "text-rose-500";
		if (rate < 0) return "text-emerald-500";
		return "text-amber-500";
	};

	return (
		<div class="mb-10">
			{/* Section Header */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
				<div>
					<div class="flex items-center gap-2 mb-2">
						<span class="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-700 rounded-full">
							Level 4
						</span>
						<span class="text-xs text-slate-400 font-medium">The Trigger</span>
					</div>
					<h2 class="text-2xl font-bold text-slate-900 tracking-tight">
						Derivatives & Sentiment
					</h2>
					<p class="text-slate-500 mt-1 max-w-2xl text-sm">
						Tells you if a move is organic or a "Fakeout". Derivatives set the
						noise (volatility).
					</p>
				</div>
				<div class="flex items-center gap-2">
					<Show when={data()?.isDemo}>
						<span class="px-2 py-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-600 rounded">
							Demo Data
						</span>
					</Show>
					<button
						type="button"
						onClick={fetchData}
						class="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-600 hover:text-rose-600 hover:border-rose-100 transition-all active:scale-95"
					>
						<IconRefresh class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} />
						{loading() ? "Updating..." : "Refresh"}
					</button>
				</div>
			</div>

			{/* Cards Grid */}
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Open Interest Card */}
				<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
					<div class="p-6">
						<div class="flex items-center gap-3 mb-5">
							<div class="w-11 h-11 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-sm flex items-center justify-center">
								<IconChart class="w-5 h-5 text-white" />
							</div>
							<div>
								<h3 class="font-bold text-slate-800">Open Interest</h3>
								<p class="text-xs text-slate-400">
									Total Futures Contracts Value
								</p>
							</div>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-3">
									<div class="h-12 bg-slate-100 animate-pulse rounded" />
									<div class="h-16 bg-slate-100 animate-pulse rounded" />
								</div>
							}
						>
							{(() => {
								const currentData = data() as DerivativesData;
								return (
									<>
										{/* OI Value */}
										<div class="text-center mb-4">
											<div class="text-4xl font-extrabold text-slate-900 tracking-tight">
												${currentData.openInterest.total.toFixed(1)}B
											</div>
											<div class="flex items-center justify-center gap-2 mt-2">
												<span
													class={`text-sm font-bold ${currentData.openInterest.change24h >= 0 ? "text-emerald-600" : "text-rose-600"}`}
												>
													{currentData.openInterest.change24h >= 0 ? "+" : ""}
													{currentData.openInterest.change24h.toFixed(1)}%
												</span>
												<span class="text-xs text-slate-400">(24h)</span>
											</div>
										</div>

										{/* OI Info */}
										<div class="p-3 bg-slate-50 rounded-lg mb-3">
											<div class="flex justify-between items-center">
												<span class="text-xs text-slate-500">
													BTC Equivalent
												</span>
												<span class="text-sm font-bold text-slate-700">
													{(
														currentData.openInterest.btcEquivalent / 1000
													).toFixed(1)}
													K BTC
												</span>
											</div>
										</div>

										{/* Price-OI Divergence */}
										<div
											class={`p-3 rounded-lg ${
												currentData.priceOiDivergence === "Healthy"
													? "bg-emerald-50 border border-emerald-200"
													: currentData.priceOiDivergence === "Weak Rally"
														? "bg-amber-50 border border-amber-200"
														: "bg-slate-50 border border-slate-200"
											}`}
										>
											<div class="text-xs font-bold mb-1 text-slate-600">
												Price-OI Analysis
											</div>
											<div
												class={`text-sm font-medium ${
													currentData.priceOiDivergence === "Healthy"
														? "text-emerald-600"
														: currentData.priceOiDivergence === "Weak Rally"
															? "text-amber-600"
															: "text-slate-600"
												}`}
											>
												{currentData.priceOiDivergence === "Healthy"
													? "✓ Price Up + OI Up = Real buying"
													: currentData.priceOiDivergence === "Weak Rally"
														? "⚠ Price Up + OI Down = Short covering"
														: "→ Monitoring trend..."}
											</div>
										</div>
									</>
								);
							})()}
						</Show>
					</div>
				</div>

				{/* Funding Rates Card */}
				<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
					<div class="p-6">
						<div class="flex items-center gap-3 mb-5">
							<div class="w-11 h-11 rounded-xl bg-linear-to-br from-orange-500 to-rose-500 shadow-sm flex items-center justify-center">
								<IconFire class="w-5 h-5 text-white" />
							</div>
							<div>
								<h3 class="font-bold text-slate-800">Funding Rate</h3>
								<p class="text-xs text-slate-400">Cost to hold positions</p>
							</div>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-3">
									<div class="h-12 bg-slate-100 animate-pulse rounded" />
									<div class="h-6 bg-slate-100 animate-pulse rounded-full" />
								</div>
							}
						>
							{(() => {
								const currentData = data() as DerivativesData;
								return (
									<>
										{/* Funding Value */}
										<div class="text-center mb-4">
											<div
												class={`text-4xl font-black tracking-tight ${fundingColor()}`}
											>
												{currentData.fundingRate.avg >= 0 ? "+" : ""}
												{(currentData.fundingRate.avg * 100).toFixed(3)}%
											</div>
											<div class="text-sm text-slate-400 mt-1">
												Average (8h)
											</div>
										</div>

										{/* Heat Gauge */}
										<div class="relative mb-4">
											<div class="h-4 rounded-full bg-linear-to-r from-emerald-400 via-amber-300 to-rose-500 overflow-hidden shadow-inner">
												{/* Pointer */}
												<div
													class="absolute top-0 w-1.5 h-4 bg-slate-900 rounded shadow-md transition-all duration-500"
													style={{ left: `${fundingGaugePosition()}%` }}
												/>
											</div>
											<div class="flex justify-between mt-1 text-[10px] text-slate-400 font-medium">
												<span>Short Squeeze</span>
												<span>Neutral</span>
												<span>Long Squeeze</span>
											</div>
										</div>

										{/* Exchange Breakdown */}
										<div class="space-y-2">
											<div class="flex justify-between items-center text-sm">
												<span class="text-slate-500">Binance</span>
												<span
													class={`font-mono font-medium ${currentData.fundingRate.binance > 0.03 ? "text-rose-500" : currentData.fundingRate.binance < 0 ? "text-emerald-500" : "text-slate-700"}`}
												>
													{(currentData.fundingRate.binance * 100).toFixed(3)}%
												</span>
											</div>
											<div class="flex justify-between items-center text-sm">
												<span class="text-slate-500">Bybit</span>
												<span
													class={`font-mono font-medium ${currentData.fundingRate.bybit > 0.03 ? "text-rose-500" : currentData.fundingRate.bybit < 0 ? "text-emerald-500" : "text-slate-700"}`}
												>
													{(currentData.fundingRate.bybit * 100).toFixed(3)}%
												</span>
											</div>
											<div class="flex justify-between items-center text-sm">
												<span class="text-slate-500">OKX</span>
												<span
													class={`font-mono font-medium ${currentData.fundingRate.okx > 0.03 ? "text-rose-500" : currentData.fundingRate.okx < 0 ? "text-emerald-500" : "text-slate-700"}`}
												>
													{(currentData.fundingRate.okx * 100).toFixed(3)}%
												</span>
											</div>
										</div>
									</>
								);
							})()}
						</Show>
					</div>

					{/* Signal Footer */}
					<Show when={data()}>
						{(() => {
							const currentData = data() as DerivativesData;
							return (
								<div
									class={`p-4 border-t ${
										currentData.signalColor === "rose"
											? "bg-rose-50 border-rose-200"
											: currentData.signalColor === "emerald"
												? "bg-emerald-50 border-emerald-200"
												: "bg-slate-50 border-slate-200"
									}`}
								>
									<div class="flex justify-between items-center">
										<span class="text-sm font-medium text-slate-600">
											Sentiment
										</span>
										<span
											class={`text-xs font-bold px-2.5 py-1 rounded-full ${
												currentData.signalColor === "rose"
													? "bg-rose-100 text-rose-600 border border-rose-200"
													: currentData.signalColor === "emerald"
														? "bg-emerald-100 text-emerald-600 border border-emerald-200"
														: "bg-slate-100 text-slate-600 border border-slate-200"
											}`}
										>
											{currentData.signal}
										</span>
									</div>
								</div>
							);
						})()}
					</Show>
				</div>

				{/* Long/Short Ratio Card */}
				<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
					<div class="p-6">
						<div class="flex items-center gap-3 mb-5">
							<div class="w-11 h-11 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 shadow-sm flex items-center justify-center">
								<IconScale class="w-5 h-5 text-white" />
							</div>
							<div>
								<h3 class="font-bold text-slate-800">Long/Short Ratio</h3>
								<p class="text-xs text-slate-400">Trader positioning</p>
							</div>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-3">
									<div class="h-12 bg-slate-100 animate-pulse rounded" />
									<div class="h-20 bg-slate-100 animate-pulse rounded" />
								</div>
							}
						>
							{(() => {
								const currentData = data() as DerivativesData;
								return (
									<>
										{/* Ratio Value */}
										<div class="text-center mb-5">
											<div class="text-4xl font-extrabold text-slate-900 tracking-tight">
												{currentData.longShortRatio.ratio.toFixed(2)}
											</div>
											<div class="text-sm text-slate-400 mt-1">
												{currentData.longShortRatio.ratio > 1.1
													? "More Longs"
													: currentData.longShortRatio.ratio < 0.9
														? "More Shorts"
														: "Balanced"}
											</div>
										</div>

										{/* Visual Bar */}
										<div class="mb-4">
											<div class="flex h-6 rounded-full overflow-hidden shadow-inner">
												<div
													class="bg-emerald-500 flex items-center justify-end pr-2 transition-all"
													style={{
														width: `${currentData.longShortRatio.longs}%`,
													}}
												>
													<span class="text-[10px] font-bold text-white">
														{currentData.longShortRatio.longs.toFixed(0)}%
													</span>
												</div>
												<div
													class="bg-rose-500 flex items-center justify-start pl-2 transition-all"
													style={{
														width: `${currentData.longShortRatio.shorts}%`,
													}}
												>
													<span class="text-[10px] font-bold text-white">
														{currentData.longShortRatio.shorts.toFixed(0)}%
													</span>
												</div>
											</div>
											<div class="flex justify-between mt-1 text-xs">
												<span class="text-emerald-600 font-medium">Longs</span>
												<span class="text-rose-600 font-medium">Shorts</span>
											</div>
										</div>

										{/* Explanation */}
										<p class="text-xs text-slate-500 leading-relaxed">
											{currentData.longShortRatio.ratio > 1.2 ? (
												<span class="text-amber-600 font-medium">
													⚠️ Crowded long trade. Correction risk elevated.
												</span>
											) : currentData.longShortRatio.ratio < 0.85 ? (
												<span class="text-emerald-600 font-medium">
													💡 Shorts crowded. Short squeeze potential.
												</span>
											) : (
												<span>Market positioning is balanced.</span>
											)}
										</p>
									</>
								);
							})()}
						</Show>
					</div>
				</div>
			</div>

			{/* Warning Note */}
			<div class="mt-5 p-4 bg-linear-to-r from-rose-50 to-orange-50 border border-rose-100 rounded-xl">
				<div class="flex items-start gap-3">
					<span class="text-2xl">🎯</span>
					<div>
						<p class="text-sm font-semibold text-rose-800 mb-1">
							Check the Temperature
						</p>
						<p class="text-sm text-rose-700">
							<strong>
								High positive funding = Everyone is long → Crash risk.
							</strong>{" "}
							Negative funding = Everyone is short → Pump potential.
						</p>
					</div>
				</div>
			</div>

			{/* Timestamp */}
			<div class="mt-4 flex justify-end">
				<span class="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
					Updated:{" "}
					{lastUpdated() ? lastUpdated()?.toLocaleTimeString() : "--:--"}
				</span>
			</div>
		</div>
	);
}
