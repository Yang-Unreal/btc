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

	const fetchData = async () => {
		setLoading(true);
		setError(false);
		try {
			const res = await fetch("/api/derivatives");
			if (res.ok) {
				const json = await res.json();
				if (!json.error) {
					setData(json);
				} else {
					setError(true);
					setData(null);
				}
			} else {
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
		const timer = setInterval(fetchData, 60000);
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
		<div class="space-y-6">
			{/* Controls */}
			<div class="flex justify-between items-center mb-4">
				<div class="flex items-center gap-3">
					<div class="h-px w-8 bg-rose-500/50"></div>
					<span class="label-mono text-rose-500 text-[10px]">
						Derivatives & Sentiment
					</span>
				</div>
				<button
					type="button"
					onClick={fetchData}
					class="p-1.5 text-slate-500 hover:text-white transition-colors"
					title="Sync Data"
				>
					<IconRefresh class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} />
				</button>
			</div>

			<Show
				when={!error()}
				fallback={
					<div class="w-full border border-rose-500/20 bg-rose-500/5 p-8 text-center rounded-lg">
						<div class="flex flex-col items-center justify-center gap-3">
							<IconAlert class="w-6 h-6 text-rose-500" />
							<p class="text-xs font-medium text-rose-400">
								Derivatives feed unavailable
							</p>
							<button
								type="button"
								onClick={fetchData}
								class="px-4 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] uppercase font-bold rounded transition-colors"
							>
								Retry
							</button>
						</div>
					</div>
				}
			>
				{/* Cards Grid */}
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-1 bg-white/5 border border-white/5 rounded-xl overflow-hidden">
					{/* --- Open Interest Card --- */}
					<div class="bg-[#0B1221] p-6 flex flex-col relative group hover:bg-[#0f1525] transition-colors">
						<div class="flex items-center gap-3 mb-6 opacity-80">
							<IconChart class="w-4 h-4 text-slate-400" />
							<span class="text-xs font-bold text-slate-300 uppercase tracking-wide">
								Open Interest
							</span>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-4 animate-pulse">
									<div class="h-8 w-24 bg-white/5 rounded" />
									<div class="h-2 w-full bg-white/5 rounded" />
								</div>
							}
						>
							{(() => {
								const currentData = data() as DerivativesData;
								return (
									<div class="flex flex-col h-full">
										<div class="mb-4">
											<div class="text-3xl font-mono tracking-tight font-medium text-white">
												${currentData.openInterest.total.toFixed(2)}B
											</div>
											<div class="flex items-center gap-2 mt-1">
												<span
													class={`font-mono text-xs font-bold ${currentData.openInterest.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}
												>
													{currentData.openInterest.change24h >= 0 ? "▲" : "▼"}
													{Math.abs(currentData.openInterest.change24h).toFixed(
														2,
													)}
													%
												</span>
												<span class="text-[10px] text-slate-500 uppercase">
													24h
												</span>
											</div>
										</div>

										<div class="space-y-3 mb-6">
											<div class="flex justify-between items-center px-3 py-2 bg-white/2 rounded">
												<span class="font-mono text-[10px] text-slate-500">
													BTC Equiv
												</span>
												<span class="font-mono text-xs text-white">
													{(
														currentData.openInterest.btcEquivalent / 1000
													).toFixed(1)}
													K BTC
												</span>
											</div>

											<div class="flex justify-between items-start gap-2">
												<span class="font-mono text-[10px] text-slate-500 whitespace-nowrap">
													Context
												</span>
												<span class="text-[10px] text-right font-medium text-slate-300 leading-tight">
													{currentData.priceOiDivergence}
												</span>
											</div>
										</div>
									</div>
								);
							})()}
						</Show>
					</div>

					{/* --- Funding Rates Card --- */}
					<div class="bg-[#0B1221] p-6 flex flex-col relative group hover:bg-[#0f1525] transition-colors border-t lg:border-t-0 lg:border-l border-white/5">
						<div class="flex items-center gap-3 mb-6 opacity-80">
							<IconFire class="w-4 h-4 text-slate-400" />
							<span class="text-xs font-bold text-slate-300 uppercase tracking-wide">
								Funding Rates
							</span>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-4 animate-pulse">
									<div class="h-8 w-24 bg-white/5 rounded" />
									<div class="h-2 w-full bg-white/5 rounded" />
								</div>
							}
						>
							{(() => {
								const currentData = data() as DerivativesData;
								return (
									<div class="flex flex-col h-full">
										<div class="mb-4">
											<div
												class={`text-3xl font-mono tracking-tight font-medium ${
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
											<div class="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wide">
												Global Avg (8h)
											</div>
										</div>

										{/* Gauge */}
										<div class="relative h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
											<div class="absolute inset-0 flex w-full opacity-30">
												<div class="w-[30%] bg-emerald-500"></div>
												<div class="w-[40%] bg-slate-500"></div>
												<div class="w-[30%] bg-rose-500"></div>
											</div>
											<div
												class="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_white] transition-all duration-700 ease-out"
												style={{ left: `${fundingGaugePosition()}%` }}
											/>
										</div>

										<div class="space-y-2 mt-auto">
											<div class="flex justify-between items-center text-[10px] text-slate-500">
												<span>OKX</span>
												<span class="font-mono text-slate-300">
													{(currentData.fundingRate.okx * 100).toFixed(4)}%
												</span>
											</div>
											<div class="flex justify-between items-center text-[10px] text-slate-500">
												<span>Binance</span>
												<span class="font-mono text-slate-300">
													{(currentData.fundingRate.binance * 100).toFixed(4)}%
												</span>
											</div>
										</div>
									</div>
								);
							})()}
						</Show>
					</div>

					{/* --- Long/Short Ratio Card --- */}
					<div class="bg-[#0B1221] p-6 flex flex-col relative group hover:bg-[#0f1525] transition-colors border-t lg:border-t-0 lg:border-l border-white/5">
						<div class="flex items-center gap-3 mb-6 opacity-80">
							<IconScale class="w-4 h-4 text-slate-400" />
							<span class="text-xs font-bold text-slate-300 uppercase tracking-wide">
								L/S Ratio
							</span>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-4 animate-pulse">
									<div class="h-8 w-24 bg-white/5 rounded" />
									<div class="h-2 w-full bg-white/5 rounded" />
								</div>
							}
						>
							{(() => {
								const currentData = data() as DerivativesData;
								return (
									<div class="flex flex-col h-full">
										<div class="mb-4">
											<div class="text-3xl font-mono tracking-tight font-medium text-white">
												{currentData.longShortRatio.ratio.toFixed(2)}
											</div>
											<div class="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wide">
												{currentData.longShortRatio.ratio > 1.1
													? "Targeting Longs"
													: currentData.longShortRatio.ratio < 0.9
														? "Targeting Shorts"
														: "Neutral"}
											</div>
										</div>

										<div class="mb-6">
											<div class="flex h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
												<div
													class="bg-emerald-500/60"
													style={{
														width: `${currentData.longShortRatio.longs}%`,
													}}
												/>
												<div
													class="bg-rose-500/60"
													style={{
														width: `${currentData.longShortRatio.shorts}%`,
													}}
												/>
											</div>
											<div class="flex justify-between text-[9px] font-bold text-slate-500 uppercase">
												<span>
													Longs {currentData.longShortRatio.longs.toFixed(0)}%
												</span>
												<span>
													Shorts {currentData.longShortRatio.shorts.toFixed(0)}%
												</span>
											</div>
										</div>

										<div class="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
											<span class="label-mono text-slate-500">
												Squeeze Risk
											</span>
											<span
												class={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
													currentData.signalColor === "rose"
														? "bg-rose-500/10 text-rose-400"
														: currentData.signalColor === "emerald"
															? "bg-emerald-500/10 text-emerald-400"
															: "bg-slate-500/10 text-slate-400"
												}`}
											>
												{currentData.signal === "Long Squeeze Risk"
													? "High (Longs)"
													: currentData.signal === "Short Squeeze Opportunity"
														? "High (Shorts)"
														: "Low"}
											</span>
										</div>
									</div>
								);
							})()}
						</Show>
					</div>
				</div>
			</Show>
		</div>
	);
}
