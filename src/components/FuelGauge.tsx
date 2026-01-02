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
				bg: "bg-emerald-500/10",
				text: "text-emerald-400",
				border: "border-emerald-500/20",
			};
		case "Bearish":
			return {
				bg: "bg-rose-500/10",
				text: "text-rose-400",
				border: "border-rose-500/20",
			};
		default:
			return {
				bg: "bg-white/5",
				text: "text-slate-400",
				border: "border-white/10",
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
		<div class="h-full flex flex-col">
			{/* Section Header */}
			<div class="flex flex-col md:flex-row md:items-start justify-between mb-10 gap-6 border-l-4 border-emerald-500 pl-6 py-2">
				<div>
					<div class="flex items-center gap-3 mb-2">
						<span class="badge-directive text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
							Tactical_Level_02
						</span>
						<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">
							Inflow_Verification_Engine
						</span>
					</div>
					<h2 class="text-3xl font-black text-white tracking-tighter uppercase">
						Liquidity Inflow
					</h2>
					<p class="text-slate-400 mt-2 max-w-xl text-[11px] font-bold uppercase tracking-tight leading-relaxed">
						Dry powder monitoring and institutional commitment validation.{" "}
						<span class="text-white">Positive delta</span> confirms structural
						price floor support.
					</p>
				</div>
				<button
					type="button"
					onClick={fetchData}
					class="flex items-center gap-3 px-5 py-3 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 hover:text-white transition-all active:scale-95 whitespace-nowrap"
				>
					<IconRefresh
						class={`w-3.5 h-3.5 ${loading() ? "animate-spin" : ""}`}
					/>
					{loading() ? "Syncing..." : "Manual_Sync"}
				</button>
			</div>

			{/* Two Column Layout */}
			<div class="grow grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 border border-white/5">
				{/* Stablecoin Supply Card */}
				<div class="bg-white/2 flex flex-col">
					<div class="p-8 grow">
						<div class="flex items-center gap-4 mb-8">
							<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
								<IconCoin class="w-5 h-5 text-indigo-400" />
							</div>
							<div>
								<h3 class="font-black text-white uppercase text-sm tracking-tighter">
									Stablecoin Supply
								</h3>
								<p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
									Aggregate_Liquidity_Pool
								</p>
							</div>
						</div>

						<Show
							when={!loading() && stableData()}
							fallback={
								<div class="space-y-4">
									<div class="h-10 bg-white/5 animate-pulse" />
									<div class="h-6 bg-white/5 animate-pulse w-2/3" />
								</div>
							}
						>
							{(() => {
								const data = stableData() as StablecoinData;
								return (
									<>
										<div class="mb-8">
											<div class="text-5xl font-mono font-black text-white tracking-tighter leading-none mb-3">
												{formatBillions(data.total.supply)}
											</div>
											<div class="flex items-center gap-4">
												<div class="flex flex-col">
													<p class="text-[8px] font-bold text-slate-600 uppercase mb-1">
														Weekly_Delta
													</p>
													<span
														class={`text-xs font-mono font-black ${data.total.change7d >= 0 ? "text-emerald-400" : "text-rose-400"}`}
													>
														{data.total.change7d >= 0 ? "+" : ""}
														{data.total.change7d.toFixed(2)}%
													</span>
												</div>
												<div class="w-px h-6 bg-white/10"></div>
												<div class="flex flex-col">
													<p class="text-[8px] font-bold text-slate-600 uppercase mb-1">
														Monthly_Delta
													</p>
													<span
														class={`text-xs font-mono font-black ${data.total.change30d >= 0 ? "text-emerald-400" : "text-rose-400"}`}
													>
														{data.total.change30d >= 0 ? "+" : ""}
														{data.total.change30d.toFixed(2)}%
													</span>
												</div>
											</div>
										</div>

										{/* Breakdown */}
										<div class="grid grid-cols-2 gap-px bg-white/5 mb-8">
											<div class="p-4 bg-white/2">
												<div class="text-[9px] font-bold text-slate-500 uppercase mb-2">
													USDT_CORE
												</div>
												<div class="text-xl font-mono font-black text-white">
													{formatBillions(data.usdt.supply)}
												</div>
											</div>
											<div class="p-4 bg-white/2">
												<div class="text-[9px] font-bold text-slate-500 uppercase mb-2">
													USDC_FED
												</div>
												<div class="text-xl font-mono font-black text-white">
													{formatBillions(data.usdc.supply)}
												</div>
											</div>
										</div>

										{/* Gauge Visual */}
										<div class="mb-4">
											<div class="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2">
												<span>Redemption_Phase</span>
												<span>Issuance_Expansion</span>
											</div>
											<div class="h-1 bg-white/5 overflow-hidden">
												<div
													class={`h-full transition-all duration-1000 ${data.signal === "Bullish" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : data.signal === "Bearish" ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-slate-500"}`}
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
								<div class={`p-6 ${colors.bg} border-t ${colors.border}`}>
									<div class="flex justify-between items-center">
										<span class="text-[10px] font-black uppercase tracking-[0.2em] text-white">
											{data.signalLabel}
										</span>
										<div
											class={`px-3 py-1 border font-black text-[9px] uppercase tracking-widest ${colors.text} ${colors.border}`}
										>
											{data.signal}
										</div>
									</div>
								</div>
							);
						})()}
					</Show>
				</div>

				{/* ETF Flows Card */}
				<div class="bg-white/2 flex flex-col">
					<div class="p-8 grow">
						<div class="flex items-center justify-between mb-8">
							<div class="flex items-center gap-4">
								<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
									<IconBuilding class="w-5 h-5 text-indigo-400" />
								</div>
								<div>
									<h3 class="font-black text-white uppercase text-sm tracking-tighter">
										Institutional Flows
									</h3>
									<p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
										Spot_ETF_Accumulation
									</p>
								</div>
							</div>
							<Show when={etfData()?.isDemo}>
								<span class="label-mono text-[9px] text-amber-500 border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 whitespace-nowrap">
									DEMO_MODE
								</span>
							</Show>
						</div>

						<Show
							when={!loading() && etfData()}
							fallback={
								<div class="space-y-4">
									<div class="h-10 bg-white/5 animate-pulse" />
									<div class="h-16 bg-white/5 animate-pulse" />
								</div>
							}
						>
							{(() => {
								const data = etfData() as ETFFlowData;
								return (
									<>
										<div class="mb-8">
											<div class="text-5xl font-mono font-black text-white tracking-tighter leading-none mb-3">
												{data.weeklyFlow >= 0 ? "+" : ""}
												{formatMillions(data.weeklyFlow * 1e6)}
											</div>
											<div class="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
												7-Day_Net_Allocation
											</div>
										</div>

										{/* Flow Bars */}
										<div class="mb-8 p-4 bg-black/20 border border-white/5">
											<div class="flex items-end gap-1.5 h-20">
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
																	class={`w-full transition-all duration-500 ${day.flow >= 0 ? "bg-emerald-500 group-hover:bg-emerald-400" : "bg-rose-500 group-hover:bg-rose-400"}`}
																	style={{ height: `${Math.max(height, 8)}%` }}
																/>
																{/* Tooltip */}
																<div class="absolute bottom-full mb-2 hidden group-hover:block z-10 pointer-events-none">
																	<div class="bg-slate-900 border border-white/10 text-white text-[9px] font-black py-1.5 px-3 whitespace-nowrap uppercase tracking-widest">
																		{day.date}: {day.flow >= 0 ? "+" : ""}
																		{formatMillions(day.flow * 1e6)}
																	</div>
																</div>
															</div>
														);
													}}
												</For>
											</div>
											<div class="flex justify-between mt-3 text-[8px] font-black text-slate-600 uppercase tracking-widest">
												<span>{data.flows[0]?.date} (T0)</span>
												<span>NOW</span>
											</div>
										</div>

										{/* Stats Row */}
										<div class="grid grid-cols-2 gap-px bg-white/5">
											<div class="p-4 bg-white/2">
												<div class="text-[9px] font-bold text-slate-500 uppercase mb-2">
													Daily_Flow
												</div>
												<div
													class={`text-xl font-mono font-black ${data.todayFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}
												>
													{data.todayFlow >= 0 ? "+" : ""}
													{formatMillions(data.todayFlow * 1e6)}
												</div>
											</div>
											<div class="p-4 bg-white/2">
												<div class="text-[9px] font-bold text-slate-500 uppercase mb-2">
													Avg_Flow_24H
												</div>
												<div
													class={`text-xl font-mono font-black ${data.avgDailyFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}
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
								<div class={`p-6 ${colors.bg} border-t ${colors.border}`}>
									<div class="flex justify-between items-center">
										<span class="text-[10px] font-black uppercase tracking-[0.2em] text-white">
											{data.signalLabel}
										</span>
										<div
											class={`px-3 py-1 border font-black text-[9px] uppercase tracking-widest ${colors.text} ${colors.border}`}
										>
											{data.signal}
										</div>
									</div>
								</div>
							);
						})()}
					</Show>
				</div>
			</div>

			{/* Insight Note */}
			<div class="mt-8 p-6 bg-white/2 border border-white/5">
				<div class="flex items-start gap-4 text-xs font-bold leading-relaxed text-slate-400 uppercase tracking-tight">
					<span class="text-xl shrink-0 grayscale group-hover:grayscale-0 transition-all">
						⛽
					</span>
					<div>
						<p class="text-white font-black mb-1">
							Daily Liquidity Assessment Protocols:
						</p>
						<p>
							Validate aggregate delta before primary cycle execution.{" "}
							<strong>Stablecoin Issuance</strong> combined with institutional{" "}
							<strong>ETF Net Positive</strong> flows constitutes a primary
							bullish catalyst. Extreme bearish delta should trigger mandatory
							risk mitigation.
						</p>
					</div>
				</div>
			</div>

			{/* Timestamp */}
			<div class="mt-6 flex justify-end">
				<span class="label-mono text-[9px] opacity-30">
					Last_Kernel_Sync:{" "}
					{lastUpdated() ? lastUpdated()?.toLocaleTimeString() : "--:--"} {"//"}{" "}
					LIVE_FEED
				</span>
			</div>
		</div>
	);
}
