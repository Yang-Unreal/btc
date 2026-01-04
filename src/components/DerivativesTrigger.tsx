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

const IconAlert: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Alert</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
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
}

// --- Main Component ---
export default function DerivativesTrigger() {
	const [data, setData] = createSignal<DerivativesData | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal(false);
	const [lastUpdated, setLastUpdated] = createSignal<Date | null>(null);

	const fetchData = async () => {
		setLoading(true);
		setError(false);
		try {
			const res = await fetch("/api/derivatives");
			if (res.ok) {
				const json = await res.json();
				if (!json.error) {
					setData(json);
					setLastUpdated(new Date());
				} else {
					// Backend explicitly returned error
					setError(true);
					setData(null);
				}
			} else {
				// HTTP Error (503, 500, etc)
				setError(true);
				setData(null);
			}
		} catch (e) {
			console.error("Failed to fetch derivatives data:", e);
			setError(true);
			setData(null);
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
		const timer = setInterval(fetchData, 60000); // 1 min refresh
		onCleanup(() => clearInterval(timer));
	});

	// Funding gauge
	const fundingGaugePosition = () => {
		const d = data();
		if (!d) return 50;
		const rate = d.fundingRate.avg;
		return Math.min(100, Math.max(0, ((rate + 0.0002) / 0.0007) * 100));
	};

	return (
		<div class="my-8 md:my-12 w-full max-w-7xl mx-auto px-4">
			{/* Section Header */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 border-l-4 border-rose-500 pl-6 py-2">
				<div class="min-w-0">
					<div class="flex items-center gap-3 mb-3 flex-wrap">
						<span class="text-[10px] font-mono text-rose-500 px-2 py-1 border border-rose-500/30 bg-rose-500/5">
							Tactical_Level_04
						</span>
						<span class="font-mono text-[10px] text-slate-400 opacity-60 uppercase">
							Derivatives_Command
						</span>
					</div>
					<h2 class="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-tight">
						Derivatives & Sentiment
					</h2>
					<p class="text-slate-500 mt-3 max-w-2xl text-xs sm:text-sm font-bold leading-relaxed uppercase tracking-wide">
						Filtering <span class="text-white">Organic Movement</span> against{" "}
						<span class="text-white">Volatility-Driven Liquidation</span>.
						Systematic sentiment assessment via leverage metrics.
					</p>
				</div>
				<div class="flex items-center gap-3 self-start md:self-end">
					<button
						type="button"
						onClick={fetchData}
						class="flex items-center gap-3 px-5 py-2.5 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all active:scale-95 whitespace-nowrap"
					>
						<IconRefresh
							class={`w-3.5 h-3.5 ${loading() ? "animate-spin" : ""}`}
						/>
						{loading() ? "Syncing..." : "Sync_Data"}
					</button>
				</div>
			</div>

			{/* Main Content Area */}
			<Show
				when={!error()}
				fallback={
					/* Error State - Tactical "Feed Down" UI */
					<div class="w-full border border-rose-500/30 bg-rose-500/5 p-12 text-center">
						<div class="flex flex-col items-center justify-center gap-4">
							<div class="p-4 bg-rose-500/10 rounded-full animate-pulse">
								<IconAlert class="w-8 h-8 text-rose-500" />
							</div>
							<h3 class="text-xl font-black text-rose-500 uppercase tracking-widest">
								Connection_Failure
							</h3>
							<p class="text-xs font-mono text-rose-400/70 uppercase max-w-md mx-auto">
								Unable to establish secure uplink with derivatives relay [OKX].
								Upstream provider may be restricting access from this node.
							</p>
							<button
								type="button"
								onClick={fetchData}
								class="mt-4 px-6 py-2 border border-rose-500/50 text-rose-400 font-bold text-xs uppercase hover:bg-rose-500/10 transition-colors"
							>
								Retry_Connection
							</button>
						</div>
					</div>
				}
			>
				{/* Cards Grid */}
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* --- Open Interest Card --- */}
					<div class="flex flex-col border border-white/10 bg-[#0B1221]">
						<div class="p-6 md:p-8 flex-1">
							<div class="flex items-center gap-4 mb-8">
								<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
									<IconChart class="w-5 h-5 text-indigo-400" />
								</div>
								<div>
									<h3 class="font-black text-white uppercase tracking-tighter text-sm">
										Open Interest
									</h3>
									<p class="font-mono text-[10px] text-slate-500 uppercase">
										Total_Contracts (Est)
									</p>
								</div>
							</div>

							<Show
								when={!loading() && data()}
								fallback={
									<div class="space-y-4">
										<div class="h-10 bg-white/5 animate-pulse rounded" />
										<div class="h-12 bg-white/5 animate-pulse rounded" />
									</div>
								}
							>
								{(() => {
									const currentData = data() as DerivativesData;
									return (
										<>
											<div class="text-center py-6 bg-white/2 border border-white/5 mb-6">
												<div class="text-4xl text-white font-mono tracking-tight">
													${currentData.openInterest.total.toFixed(2)}B
												</div>
												<div class="flex items-center justify-center gap-2 mt-2">
													<span
														class={`font-mono text-[11px] font-bold ${currentData.openInterest.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}
													>
														{currentData.openInterest.change24h >= 0
															? "▲"
															: "▼"}
														{Math.abs(
															currentData.openInterest.change24h,
														).toFixed(2)}
														%
													</span>
													<span class="text-[9px] font-bold text-slate-600 uppercase tracking-wider">
														24H_Delta
													</span>
												</div>
											</div>

											<div class="flex justify-between items-center px-4 py-3 border border-white/5 mb-6">
												<span class="font-mono text-[10px] text-slate-500 uppercase">
													BTC_Equivalent
												</span>
												<span class="font-mono text-sm text-white">
													{(
														currentData.openInterest.btcEquivalent / 1000
													).toFixed(1)}
													K BTC
												</span>
											</div>

											<div
												class={`p-4 border ${
													currentData.priceOiDivergence === "Healthy"
														? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
														: currentData.priceOiDivergence === "Weak Rally"
															? "border-amber-500/20 bg-amber-500/5 text-amber-400"
															: "border-white/5 bg-white/2 text-slate-400"
												}`}
											>
												<div class="text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">
													Analysis_Report
												</div>
												<p class="text-[10px] font-bold uppercase tracking-tight leading-relaxed">
													{currentData.priceOiDivergence === "Healthy"
														? "Primary Move: Organic wealth inflow detected"
														: currentData.priceOiDivergence === "Weak Rally"
															? "Warning: Leverage-driven move. Short covering suspected."
															: currentData.priceOiDivergence === "Weak Dump"
																? "Capitulation: Longs are liquidating. Trend exhaustion possible."
																: "Stable market structure. No significant divergence."}
												</p>
											</div>
										</>
									);
								})()}
							</Show>
						</div>
					</div>

					{/* --- Funding Rates Card --- */}
					<div class="flex flex-col border border-white/10 bg-[#0B1221]">
						<div class="p-6 md:p-8 flex-1">
							<div class="flex items-center gap-4 mb-8">
								<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
									<IconFire class="w-5 h-5 text-rose-500" />
								</div>
								<div>
									<h3 class="font-black text-white uppercase tracking-tighter text-sm">
										Funding Rates
									</h3>
									<p class="font-mono text-[10px] text-slate-500 uppercase">
										Liquidity_Rent
									</p>
								</div>
							</div>

							<Show
								when={!loading() && data()}
								fallback={
									<div class="space-y-4">
										<div class="h-10 bg-white/5 animate-pulse rounded" />
										<div class="h-20 bg-white/5 animate-pulse rounded" />
									</div>
								}
							>
								{(() => {
									const currentData = data() as DerivativesData;
									return (
										<>
											<div class="text-center py-6 bg-white/2 border border-white/5 mb-6">
												<div
													class={`text-4xl font-mono tracking-tight ${
														currentData.fundingRate.avg > 0.0002
															? "text-rose-400"
															: currentData.fundingRate.avg < 0
																? "text-emerald-400"
																: "text-amber-400"
													}`}
												>
													{currentData.fundingRate.avg >= 0 ? "+" : ""}
													{(currentData.fundingRate.avg * 100).toFixed(4)}%
												</div>
												<div class="text-[9px] font-bold text-slate-600 uppercase mt-2 tracking-widest">
													AVG_8H_GLOBAL
												</div>
											</div>

											<div class="relative py-2 mb-6">
												<div class="h-2 flex w-full">
													<div class="w-[30%] bg-emerald-500/20 border-y border-l border-emerald-500/30"></div>
													<div class="w-[40%] bg-slate-500/10 border-y border-slate-500/20"></div>
													<div class="w-[30%] bg-rose-500/20 border-y border-r border-rose-500/30"></div>
												</div>

												<div
													class="absolute top-1 bottom-0 w-0.5 bg-white shadow-[0_0_10px_#fff] transition-all duration-700"
													style={{ left: `${fundingGaugePosition()}%` }}
												>
													<div class="absolute -top-1.5 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-[6px] border-t-white"></div>
												</div>

												<div class="flex justify-between mt-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">
													<span class="text-emerald-500">Short_Sq</span>
													<span>Neutral</span>
													<span class="text-rose-500">Long_Sq</span>
												</div>
											</div>

											<div class="space-y-3 pt-2 border-t border-white/5">
												<div class="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
													<span>OKX</span>
													<span class="font-mono text-white">
														{(currentData.fundingRate.okx * 100).toFixed(4)}%
													</span>
												</div>
												<div class="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
													<span>Binance</span>
													<span class="font-mono text-white">
														{(currentData.fundingRate.binance * 100).toFixed(4)}
														%
													</span>
												</div>
												<div class="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
													<span>Bybit</span>
													<span class="font-mono text-white">
														{(currentData.fundingRate.bybit * 100).toFixed(4)}%
													</span>
												</div>
											</div>
										</>
									);
								})()}
							</Show>
						</div>

						<Show when={data()}>
							<div class="px-6 md:px-8 py-4 border-t border-white/5 bg-white/1">
								<div class="flex justify-between items-center">
									<span class="font-mono text-[9px] uppercase text-slate-500">
										Protocol_Signal
									</span>
									<span
										class={`text-[10px] font-black px-2 py-0.5 border uppercase ${
											(data() as DerivativesData).signalColor === "rose"
												? "border-rose-500/40 text-rose-400 bg-rose-500/5"
												: (data() as DerivativesData).signalColor === "emerald"
													? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
													: "border-white/10 text-slate-400 bg-white/5"
										}`}
									>
										{(data() as DerivativesData).signal}
									</span>
								</div>
							</div>
						</Show>
					</div>

					{/* --- Long/Short Ratio Card --- */}
					<div class="flex flex-col border border-white/10 bg-[#0B1221]">
						<div class="p-6 md:p-8 flex-1">
							<div class="flex items-center gap-4 mb-8">
								<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
									<IconScale class="w-5 h-5 text-white" />
								</div>
								<div>
									<h3 class="font-black text-white uppercase tracking-tighter text-sm">
										Sentiment Ratio
									</h3>
									<p class="font-mono text-[10px] text-slate-500 uppercase">
										Positioning_Bias
									</p>
								</div>
							</div>

							<Show
								when={!loading() && data()}
								fallback={
									<div class="space-y-4">
										<div class="h-10 bg-white/5 animate-pulse rounded" />
										<div class="h-12 bg-white/5 animate-pulse rounded" />
									</div>
								}
							>
								{(() => {
									const currentData = data() as DerivativesData;
									return (
										<>
											<div class="text-center py-6 bg-white/2 border border-white/5 mb-8">
												<div class="text-4xl text-white font-mono tracking-tight">
													{currentData.longShortRatio.ratio.toFixed(3)}
												</div>
												<div class="text-[9px] font-bold text-slate-600 uppercase mt-2 tracking-widest">
													{currentData.longShortRatio.ratio > 1.1
														? "Long_Bias"
														: currentData.longShortRatio.ratio < 0.9
															? "Short_Bias"
															: "Neutral_Equilibrium"}
												</div>
											</div>

											<div class="space-y-3 mb-6">
												<div class="flex h-5 bg-white/5 border border-white/10 overflow-hidden relative">
													<div
														class="bg-emerald-500/80 transition-all duration-500 flex items-center justify-start px-2"
														style={{
															width: `${currentData.longShortRatio.longs}%`,
														}}
													>
														<span class="text-[9px] font-black text-black/50">
															L
														</span>
													</div>
													<div
														class="bg-rose-500/80 transition-all duration-500 flex items-center justify-end px-2"
														style={{
															width: `${currentData.longShortRatio.shorts}%`,
														}}
													>
														<span class="text-[9px] font-black text-black/50">
															S
														</span>
													</div>
													<div class="absolute left-1/2 top-0 bottom-0 w-px bg-white/20"></div>
												</div>
												<div class="flex justify-between text-[9px] font-black uppercase tracking-widest">
													<span class="text-emerald-500">
														Longs {currentData.longShortRatio.longs.toFixed(1)}%
													</span>
													<span class="text-rose-500">
														Shorts{" "}
														{currentData.longShortRatio.shorts.toFixed(1)}%
													</span>
												</div>
											</div>

											<div class="border-l-2 border-amber-500/50 pl-4 py-1">
												<p class="text-[10px] leading-relaxed uppercase tracking-wide text-slate-400">
													{currentData.longShortRatio.ratio > 1.2 ? (
														<span class="text-amber-400 block">
															<span class="font-black block mb-1">
																Warning: Crowded Longs
															</span>
															Mean reversion risk elevated. Squeeze potential
															high.
														</span>
													) : currentData.longShortRatio.ratio < 0.85 ? (
														<span class="text-emerald-400 block">
															<span class="font-black block mb-1">
																Short Squeeze Fuel
															</span>
															Extreme bearish sentiment detected. Reversal
															likely.
														</span>
													) : (
														<span>
															Standard Market Dynamics. No significant
															positioning imbalance.
														</span>
													)}
												</p>
											</div>
										</>
									);
								})()}
							</Show>
						</div>
					</div>
				</div>
			</Show>

			{/* Status Bar */}
			<div class="mt-8 flex justify-between items-center px-2">
				<div class="flex items-center gap-2">
					<div
						class={`w-1.5 h-1.5 animate-pulse rounded-full ${error() ? "bg-rose-500" : "bg-emerald-500"}`}
					></div>
					<span class="font-mono text-[9px] text-slate-500 opacity-60 uppercase">
						{error() ? "DERIVATIVES_LINK_OFFLINE" : "Derivatives_Link_Active"}
					</span>
				</div>
				<span class="font-mono text-[9px] text-slate-500 opacity-60 uppercase">
					Last_Sync:{" "}
					{lastUpdated()
						? lastUpdated()?.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
								second: "2-digit",
							})
						: "UNKNOWN"}
				</span>
			</div>
		</div>
	);
}
