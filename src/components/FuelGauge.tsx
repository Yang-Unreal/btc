import {
	type Component,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";

// --- Icons ---
const IconCoin: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Coin</title>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 6v12m-4-6h8" />
	</svg>
);

const IconBuilding: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Building</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
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
interface StablecoinData {
	usdt: { supply: number; change1d: number };
	usdc: { supply: number; change1d: number };
	total: {
		supply: number;
		change1d: number;
		change7d: number;
		change30d: number;
	};
	signal: "Bullish" | "Bearish" | "Neutral";
	signalLabel: string;
}

interface ETFFlowData {
	flows: Array<{ date: string; flow: number; cumulative: number }>;
	todayFlow: number;
	weeklyFlow: number;
	avgDailyFlow: number;
	totalFlow: number;
	signal: "Bullish" | "Bearish" | "Neutral";
	signalLabel: string;
	isDemo: boolean;
}

// --- Helper Functions ---
const formatBillions = (val: number) => {
	if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
	if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
	if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
	return `$${val.toFixed(0)}`;
};

const formatMillions = (val: number) => {
	if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
	if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
	return `$${val.toFixed(0)}`;
};

const getSignalColors = (signal: "Bullish" | "Bearish" | "Neutral") => {
	switch (signal) {
		case "Bullish":
			return {
				bg: "bg-emerald-50",
				text: "text-emerald-600",
				border: "border-emerald-200",
			};
		case "Bearish":
			return {
				bg: "bg-rose-50",
				text: "text-rose-600",
				border: "border-rose-200",
			};
		default:
			return {
				bg: "bg-slate-50",
				text: "text-slate-600",
				border: "border-slate-200",
			};
	}
};

// --- Main Component ---
export default function FuelGauge() {
	const [stableData, setStableData] = createSignal<StablecoinData | null>(null);
	const [etfData, setEtfData] = createSignal<ETFFlowData | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [lastUpdated, setLastUpdated] = createSignal<Date | null>(null);

	const fetchData = async () => {
		setLoading(true);
		try {
			const [stableRes, etfRes] = await Promise.all([
				fetch("/api/stablecoins"),
				fetch("/api/etf-flows"),
			]);

			if (stableRes.ok) {
				const data = await stableRes.json();
				if (!data.error) setStableData(data);
			}

			if (etfRes.ok) {
				const data = await etfRes.json();
				if (!data.error) setEtfData(data);
			}

			setLastUpdated(new Date());
		} catch (e) {
			console.error("Failed to fetch fuel data:", e);
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
		const timer = setInterval(fetchData, 120000); // 2 min refresh
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="">
			{/* Section Header */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-5 gap-4">
				<div>
					<div class="flex items-center gap-2 mb-2">
						<span class="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 rounded-full">
							Level 2
						</span>
						<span class="text-xs text-slate-400 font-medium">The Fuel</span>
					</div>
					<h2 class="text-2xl font-bold text-slate-900 tracking-tight">
						New Money Inflow
					</h2>
					<p class="text-slate-500 mt-1 max-w-2xl text-sm">
						Price goes up when new money enters. Track stablecoin "dry powder"
						and institutional ETF flows.
					</p>
				</div>
				<button
					type="button"
					onClick={fetchData}
					class="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-600 hover:text-emerald-600 hover:border-emerald-100 transition-all active:scale-95"
				>
					<IconRefresh class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} />
					{loading() ? "Updating..." : "Refresh"}
				</button>
			</div>

			{/* Two Column Layout */}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
				{/* Stablecoin Supply Card */}
				<div class="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 overflow-hidden">
					<div class="p-6">
						<div class="flex items-center gap-3 mb-4">
							<div class="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 shadow-sm flex items-center justify-center">
								<IconCoin class="w-6 h-6 text-white" />
							</div>
							<div>
								<h3 class="font-bold text-slate-800">Stablecoin Supply</h3>
								<p class="text-xs text-slate-400">USDT + USDC - "Dry Powder"</p>
							</div>
						</div>

						<Show
							when={!loading() && stableData()}
							fallback={
								<div class="space-y-3">
									<div class="h-12 bg-slate-100 animate-pulse rounded" />
									<div class="h-8 bg-slate-100 animate-pulse rounded w-2/3" />
								</div>
							}
						>
							{(() => {
								const data = stableData() as StablecoinData;
								return (
									<>
										<div class="mb-4">
											<div class="text-4xl font-extrabold text-slate-900 tracking-tight">
												{formatBillions(data.total.supply)}
											</div>
											<div class="flex items-center gap-3 mt-2">
												<span
													class={`text-sm font-bold ${data.total.change7d >= 0 ? "text-emerald-600" : "text-rose-600"}`}
												>
													{data.total.change7d >= 0 ? "+" : ""}
													{data.total.change7d.toFixed(2)}% (7d)
												</span>
												<span class="text-xs text-slate-400">|</span>
												<span
													class={`text-sm ${data.total.change30d >= 0 ? "text-emerald-600" : "text-rose-600"}`}
												>
													{data.total.change30d >= 0 ? "+" : ""}
													{data.total.change30d.toFixed(2)}% (30d)
												</span>
											</div>
										</div>

										{/* Breakdown */}
										<div class="grid grid-cols-2 gap-3 mb-4">
											<div class="p-3 bg-slate-50 rounded-lg">
												<div class="text-xs text-slate-400 font-medium mb-1">
													USDT
												</div>
												<div class="text-lg font-bold text-slate-800">
													{formatBillions(data.usdt.supply)}
												</div>
											</div>
											<div class="p-3 bg-slate-50 rounded-lg">
												<div class="text-xs text-slate-400 font-medium mb-1">
													USDC
												</div>
												<div class="text-lg font-bold text-slate-800">
													{formatBillions(data.usdc.supply)}
												</div>
											</div>
										</div>

										{/* Gauge Visual */}
										<div class="mb-3">
											<div class="flex justify-between text-xs text-slate-400 mb-1">
												<span>Redeeming</span>
												<span>Minting</span>
											</div>
											<div class="h-2 bg-slate-200 rounded-full overflow-hidden">
												<div
													class={`h-full transition-all duration-500 ${data.signal === "Bullish" ? "bg-emerald-500" : data.signal === "Bearish" ? "bg-rose-500" : "bg-slate-400"}`}
													style={{
														width: `${Math.min(100, Math.max(0, 50 + data.total.change7d * 10))}%`,
													}}
												/>
											</div>
										</div>
									</>
								);
							})()}
						</Show>
					</div>

					{/* Signal Footer */}
					<Show when={stableData()}>
						{(() => {
							const data = stableData() as StablecoinData;
							const colors = getSignalColors(data.signal);
							return (
								<div class={`p-4 ${colors.bg} border-t ${colors.border}`}>
									<div class="flex justify-between items-center">
										<span class="text-sm font-medium text-slate-600">
											{data.signalLabel}
										</span>
										<span
											class={`text-xs font-bold px-2.5 py-1 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}
										>
											{data.signal}
										</span>
									</div>
								</div>
							);
						})()}
					</Show>
				</div>

				{/* ETF Flows Card */}
				<div class="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 overflow-hidden">
					<div class="p-6">
						<div class="flex items-center justify-between mb-4">
							<div class="flex items-center gap-3">
								<div class="w-12 h-12 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 shadow-sm flex items-center justify-center">
									<IconBuilding class="w-6 h-6 text-white" />
								</div>
								<div>
									<h3 class="font-bold text-slate-800">ETF Net Flows</h3>
									<p class="text-xs text-slate-400">
										Institutional Buy/Sell Activity
									</p>
								</div>
							</div>
							<Show when={etfData()?.isDemo}>
								<span class="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-100 text-amber-600 rounded">
									Demo
								</span>
							</Show>
						</div>

						<Show
							when={!loading() && etfData()}
							fallback={
								<div class="space-y-3">
									<div class="h-12 bg-slate-100 animate-pulse rounded" />
									<div class="h-24 bg-slate-100 animate-pulse rounded" />
								</div>
							}
						>
							{(() => {
								const data = etfData() as ETFFlowData;
								return (
									<>
										<div class="mb-4">
											<div class="text-4xl font-extrabold text-slate-900 tracking-tight">
												{data.weeklyFlow >= 0 ? "+" : ""}
												{formatMillions(data.weeklyFlow * 1e6)}
											</div>
											<div class="text-sm text-slate-400 mt-1">
												7-Day Net Flow
											</div>
										</div>

										{/* Flow Bars */}
										<div class="mb-4">
											<div class="flex items-end gap-1 h-20">
												<For each={data.flows}>
													{(day) => {
														const maxFlow = Math.max(
															...data.flows.map((f) => Math.abs(f.flow)),
														);
														const height =
															maxFlow > 0
																? (Math.abs(day.flow) / maxFlow) * 100
																: 0;
														return (
															<div class="flex-1 flex flex-col items-center justify-end h-full group relative">
																<div
																	class={`w-full rounded-t transition-all ${day.flow >= 0 ? "bg-emerald-400 hover:bg-emerald-500" : "bg-rose-400 hover:bg-rose-500"}`}
																	style={{ height: `${Math.max(height, 5)}%` }}
																/>
																{/* Tooltip */}
																<div class="absolute bottom-full mb-2 hidden group-hover:block z-10">
																	<div class="bg-slate-800 text-white text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap">
																		{day.date}: {day.flow >= 0 ? "+" : ""}
																		{formatMillions(day.flow * 1e6)}
																	</div>
																</div>
															</div>
														);
													}}
												</For>
											</div>
											<div class="flex justify-between mt-1 text-[10px] text-slate-400">
												<span>{data.flows[0]?.date.slice(5)}</span>
												<span>
													{data.flows[data.flows.length - 1]?.date.slice(5)}
												</span>
											</div>
										</div>

										{/* Stats Row */}
										<div class="grid grid-cols-2 gap-3">
											<div class="p-3 bg-slate-50 rounded-lg">
												<div class="text-xs text-slate-400 font-medium mb-1">
													Today
												</div>
												<div
													class={`text-lg font-bold ${data.todayFlow >= 0 ? "text-emerald-600" : "text-rose-600"}`}
												>
													{data.todayFlow >= 0 ? "+" : ""}
													{formatMillions(data.todayFlow * 1e6)}
												</div>
											</div>
											<div class="p-3 bg-slate-50 rounded-lg">
												<div class="text-xs text-slate-400 font-medium mb-1">
													Avg Daily
												</div>
												<div
													class={`text-lg font-bold ${data.avgDailyFlow >= 0 ? "text-emerald-600" : "text-rose-600"}`}
												>
													{data.avgDailyFlow >= 0 ? "+" : ""}
													{formatMillions(data.avgDailyFlow * 1e6)}
												</div>
											</div>
										</div>
									</>
								);
							})()}
						</Show>
					</div>

					{/* Signal Footer */}
					<Show when={etfData()}>
						{(() => {
							const data = etfData() as ETFFlowData;
							const colors = getSignalColors(data.signal);
							return (
								<div class={`p-4 ${colors.bg} border-t ${colors.border}`}>
									<div class="flex justify-between items-center">
										<span class="text-sm font-medium text-slate-600">
											{data.signalLabel}
										</span>
										<span
											class={`text-xs font-bold px-2.5 py-1 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}
										>
											{data.signal}
										</span>
									</div>
								</div>
							);
						})()}
					</Show>
				</div>
			</div>

			{/* Insight Note */}
			<div class="mt-5 p-4 bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl">
				<div class="flex items-start gap-3">
					<span class="text-2xl">⛽</span>
					<div>
						<p class="text-sm font-semibold text-emerald-800 mb-1">
							Check the Fuel Every Morning
						</p>
						<p class="text-sm text-emerald-700">
							<strong>
								Stablecoin rising + ETF inflows = New money entering.
							</strong>{" "}
							This is the rocket fuel for price.
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
