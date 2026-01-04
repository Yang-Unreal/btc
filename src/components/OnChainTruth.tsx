import {
	type Component,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";

// --- Icons ---
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

const IconDatabase: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Database</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
		/>
	</svg>
);

const IconDiamond: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Diamond</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M12 3l8 6-8 12-8-12 8-6z"
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
interface OnChainData {
	mvrv: {
		zScore: number;
		rawValue: number;
		signal: "Overheated" | "Neutral" | "Undervalued";
		signalColor: "rose" | "slate" | "emerald";
	};
	exchangeBalance: {
		btc: number;
		change7d: number;
		change30d: number;
		signal: "Supply Shock" | "Neutral" | "Dump Risk";
		signalColor: "emerald" | "slate" | "rose";
	};
	realizedPrice: {
		sth: number;
		lth: number;
		current: number;
		sthRatio: number;
		lthRatio: number;
		trendBroken: boolean;
	};
	isDemo: boolean;
}

// --- Helper ---
const formatNumber = (val: number) => {
	if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
	if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
	return val.toFixed(0);
};

const formatCurrency = (val: number) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(val);
};

// --- Main Component ---
export default function OnChainTruth() {
	const [data, setData] = createSignal<OnChainData | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [lastUpdated, setLastUpdated] = createSignal<Date | null>(null);

	const fetchData = async () => {
		setLoading(true);
		try {
			// In production, point to the actual endpoint
			const res = await fetch("/api/onchain");
			if (res.ok) {
				const json = await res.json();
				if (!json.error) {
					setData(json);
					setLastUpdated(new Date());
				}
			}
		} catch (e) {
			console.error("Failed to fetch on-chain data:", e);
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
		// Refresh every 60 seconds to capture live price moves relative to realized price
		const timer = setInterval(fetchData, 60000);
		onCleanup(() => clearInterval(timer));
	});

	// MVRV Gauge position (0 to 100)
	const mvrvGaugePosition = () => {
		if (!data()) return 50;
		const zScore = data()?.mvrv?.zScore;
		if (zScore === undefined) return 50;
		// Map -1 to 4 range to 0-100
		return Math.min(100, Math.max(0, ((zScore + 1) / 5) * 100));
	};

	return (
		<div class="my-8 md:my-12 w-full max-w-7xl mx-auto px-4">
			{/* Section Header */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 border-l-4 border-cyan-500 pl-6 py-2">
				<div class="min-w-0">
					<div class="flex items-center gap-3 mb-3 flex-wrap">
						<span class="text-[10px] font-mono text-cyan-500 px-2 py-1 border border-cyan-500/30 bg-cyan-500/5">
							Tactical_Level_03
						</span>
						<span class="font-mono text-[10px] text-slate-400 opacity-60 uppercase">
							OnChain_Truth_Feed
						</span>
					</div>
					<h2 class="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-tight">
						On-Chain Valuation
					</h2>
					<p class="text-slate-500 mt-3 max-w-2xl text-xs sm:text-sm font-bold leading-relaxed uppercase tracking-wide">
						Institutional-grade value assessment. Identifying{" "}
						<span class="text-white">Holder Conviction</span> and{" "}
						<span class="text-white">Supply Dynamics</span> through immutable
						ledger analysis.
					</p>
				</div>
				<div class="flex items-center gap-3 self-start md:self-end">
					<Show when={data()?.isDemo}>
						<span class="text-[10px] font-mono text-amber-500 px-2 py-1 border border-amber-500/30 bg-amber-500/5">
							Demo_Protocol
						</span>
					</Show>
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

			{/* Three Column Layout */}
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* --- MVRV Z-Score Card --- */}
				<div class="flex flex-col border border-white/10 bg-[#0B1221]">
					<div class="p-6 md:p-8 flex-1">
						<div class="flex items-center gap-4 mb-8">
							<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
								<IconScale class="w-5 h-5 text-indigo-400" />
							</div>
							<div>
								<h3 class="font-black text-white uppercase tracking-tighter text-sm">
									MVRV Z-Score
								</h3>
								<p class="font-mono text-[10px] text-slate-500 uppercase">
									Fair_Value_Delta
								</p>
							</div>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-4">
									<div class="h-10 bg-white/5 animate-pulse rounded" />
									<div class="h-6 bg-white/5 animate-pulse rounded" />
								</div>
							}
						>
							<div class="text-center py-6 bg-white/2 border border-white/5 mb-8">
								<div
									class={`text-5xl font-mono tracking-tighter ${
										data()?.mvrv?.signalColor === "rose"
											? "text-rose-400"
											: data()?.mvrv?.signalColor === "emerald"
												? "text-emerald-400"
												: "text-white"
									}`}
								>
									{data()?.mvrv?.zScore?.toFixed(3) ?? "0.000"}
								</div>
								<div class="text-[9px] font-bold text-slate-600 uppercase mt-2 tracking-widest">
									Current_Z_Factor
								</div>
							</div>

							<div class="relative mb-8 pt-5 pb-2">
								<div class="absolute top-0 left-[20%] -translate-x-1/2 text-[8px] font-mono text-slate-500 font-bold">
									0.0
								</div>
								<div class="absolute top-0 left-[80%] -translate-x-1/2 text-[8px] font-mono text-slate-500 font-bold">
									3.0
								</div>

								{/* Segmented Track */}
								<div class="h-3 flex w-full mt-1">
									<div class="w-[20%] bg-emerald-500/20 border-y border-l border-emerald-500/30 relative">
										<div class="absolute right-0 top-0 bottom-0 w-px bg-emerald-500/50"></div>
									</div>
									<div class="w-[60%] bg-slate-500/10 border-y border-slate-500/20 relative"></div>
									<div class="w-[20%] bg-rose-500/20 border-y border-r border-rose-500/30 relative">
										<div class="absolute left-0 top-0 bottom-0 w-px bg-rose-500/50"></div>
									</div>
								</div>

								{/* Needle Cursor */}
								<div
									class="absolute top-[22px] bottom-2 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,1)] z-10 transition-all duration-700 ease-out"
									style={{ left: `${mvrvGaugePosition()}%` }}
								>
									<div class="absolute -top-1.5 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-[6px] border-t-white"></div>
								</div>

								{/* Labels */}
								<div class="relative w-full h-4 mt-2 text-[9px] font-black uppercase tracking-wider">
									<div class="absolute left-0 top-0 text-emerald-500">
										Undervalued
									</div>
									<div class="absolute left-1/2 -translate-x-1/2 top-0 text-slate-500">
										Neutral
									</div>
									<div class="absolute right-0 top-0 text-rose-500">
										Overheated
									</div>
								</div>
							</div>

							<div class="space-y-2 border-t border-white/5 pt-4">
								<div class="flex justify-between items-center text-[10px]">
									<div class="flex items-center gap-2">
										<div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
										<span class="text-slate-400 font-bold uppercase">
											Accumulation
										</span>
									</div>
									<span class="font-mono text-emerald-400">&lt; 0.0</span>
								</div>
								<div class="flex justify-between items-center text-[10px]">
									<div class="flex items-center gap-2">
										<div class="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
										<span class="text-slate-400 font-bold uppercase">
											Fair Value
										</span>
									</div>
									<span class="font-mono text-slate-400">0.0 - 3.0</span>
								</div>
								<div class="flex justify-between items-center text-[10px]">
									<div class="flex items-center gap-2">
										<div class="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
										<span class="text-slate-400 font-bold uppercase">
											Distribution
										</span>
									</div>
									<span class="font-mono text-rose-400">&gt; 3.0</span>
								</div>
							</div>
						</Show>
					</div>

					<Show when={data()}>
						<div class="px-6 md:px-8 py-4 border-t border-white/5 bg-white/1">
							<div class="flex justify-between items-center">
								<span class="font-mono text-[9px] uppercase text-slate-500">
									Market_Phase
								</span>
								<span
									class={`text-[10px] font-black px-2 py-0.5 border uppercase ${
										data()?.mvrv.signalColor === "rose"
											? "border-rose-500/40 text-rose-400 bg-rose-500/5"
											: data()?.mvrv.signalColor === "emerald"
												? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
												: "border-white/10 text-slate-400 bg-white/5"
									}`}
								>
									{data()?.mvrv.signal}
								</span>
							</div>
						</div>
					</Show>
				</div>

				{/* --- Exchange Balance Card --- */}
				<div class="flex flex-col border border-white/10 bg-[#0B1221]">
					<div class="p-6 md:p-8 flex-1">
						<div class="flex items-center gap-4 mb-8">
							<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
								<IconDatabase class="w-5 h-5 text-cyan-400" />
							</div>
							<div>
								<h3 class="font-black text-white uppercase tracking-tighter text-sm">
									Exchange Flow
								</h3>
								<p class="font-mono text-[10px] text-slate-500 uppercase">
									Supply_Liquidity
								</p>
							</div>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-4">
									<div class="h-10 bg-white/5 animate-pulse rounded" />
									<div class="h-16 bg-white/5 animate-pulse rounded" />
								</div>
							}
						>
							<div class="text-center py-6 bg-white/2 border border-white/5 mb-8">
								<div class="text-4xl text-white font-mono tracking-tight">
									{formatNumber(data()?.exchangeBalance?.btc ?? 0)}
								</div>
								<div class="text-[9px] font-bold text-slate-600 uppercase mt-2 tracking-widest">
									BTC_ON_EXCHANGES (EST)
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4 mb-8">
								<div class="p-3 border border-white/5 text-center">
									<div class="text-[9px] font-bold text-slate-500 uppercase mb-2 tracking-widest">
										7D_Delta
									</div>
									<div
										class={`text-lg font-mono ${
											(data()?.exchangeBalance?.change7d ?? 0) <= 0
												? "text-emerald-400"
												: "text-rose-400"
										}`}
									>
										{(data()?.exchangeBalance?.change7d ?? 0) > 0 ? "+" : ""}
										{data()?.exchangeBalance?.change7d?.toFixed(2) ?? "0.00"}%
									</div>
								</div>
								<div class="p-3 border border-white/5 text-center">
									<div class="text-[9px] font-bold text-slate-500 uppercase mb-2 tracking-widest">
										30D_Delta
									</div>
									<div
										class={`text-lg font-mono ${
											(data()?.exchangeBalance?.change30d ?? 0) <= 0
												? "text-emerald-400"
												: "text-rose-400"
										}`}
									>
										{(data()?.exchangeBalance?.change30d ?? 0) > 0 ? "+" : ""}
										{data()?.exchangeBalance?.change30d?.toFixed(2) ?? "0.00"}%
									</div>
								</div>
							</div>

							<div class="border-l-2 border-indigo-500/50 pl-4 py-1">
								<p class="text-[10px] leading-relaxed uppercase tracking-wide text-slate-400">
									{(data()?.exchangeBalance?.change7d ?? 0) < 0 ? (
										<span>
											<span class="text-emerald-400 font-black block mb-1">
												Supply Squeeze Active
											</span>
											Outflows detected. Bullish accumulation trend confirmed.
										</span>
									) : (data()?.exchangeBalance?.change7d ?? 0) > 1 ? (
										<span>
											<span class="text-rose-400 font-black block mb-1">
												Exchange Inflow Surge
											</span>
											Elevated liquidation risk. Monitor for distribution.
										</span>
									) : (
										<span>
											Exchange flows neutral. Standard liquidity maintenance.
										</span>
									)}
								</p>
							</div>
						</Show>
					</div>

					<Show when={data()}>
						<div class="px-6 md:px-8 py-4 border-t border-white/5 bg-white/1">
							<div class="flex justify-between items-center">
								<span class="font-mono text-[9px] uppercase text-slate-500">
									Supply_Shock_Status
								</span>
								<span
									class={`text-[10px] font-black px-2 py-0.5 border uppercase ${
										data()?.exchangeBalance.signalColor === "emerald"
											? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
											: data()?.exchangeBalance.signalColor === "rose"
												? "border-rose-500/40 text-rose-400 bg-rose-500/5"
												: "border-white/10 text-slate-400 bg-white/5"
									}`}
								>
									{data()?.exchangeBalance.signal}
								</span>
							</div>
						</div>
					</Show>
				</div>

				{/* --- Realized Price Card --- */}
				<div class="flex flex-col border border-white/10 bg-[#0B1221]">
					<div class="p-6 md:p-8 flex-1">
						<div class="flex items-center gap-4 mb-8">
							<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
								<IconDiamond class="w-5 h-5 text-emerald-400" />
							</div>
							<div>
								<h3 class="font-black text-white uppercase tracking-tighter text-sm">
									Realized Basis
								</h3>
								<p class="font-mono text-[10px] text-slate-500 uppercase">
									Holding_Costs
								</p>
							</div>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-4">
									<div class="h-10 bg-white/5 animate-pulse rounded" />
									<div class="h-24 bg-white/5 animate-pulse rounded" />
								</div>
							}
						>
							<div class="text-center py-6 bg-white/2 border border-white/5 mb-8">
								<div class="text-4xl text-white font-mono tracking-tight">
									{formatCurrency(data()?.realizedPrice?.current ?? 0)}
								</div>
								<div class="text-[9px] font-bold text-slate-600 uppercase mt-2 tracking-widest">
									TERMINAL_REALIZED_PRICE
								</div>
							</div>

							<div class="space-y-4 mb-6">
								<div class="group">
									<div class="flex justify-between items-end mb-1">
										<span class="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">
											STH_Realized
										</span>
										<span class="font-mono text-[9px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">
											{data()?.realizedPrice?.sthRatio?.toFixed(2) ?? "0.00"}X
										</span>
									</div>
									<div class="p-4 border border-white/10 relative overflow-hidden">
										<div class="text-2xl font-mono text-slate-300 relative z-10">
											{formatCurrency(data()?.realizedPrice?.sth ?? 0)}
										</div>
										<p class="text-[8px] font-bold text-slate-600 uppercase mt-1 relative z-10">
											Speculator Cost Basis
										</p>
										<div class="absolute bottom-0 left-0 h-0.5 bg-slate-700 w-full opacity-30"></div>
									</div>
								</div>

								<div class="group">
									<div class="flex justify-between items-end mb-1">
										<span class="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">
											LTH_Realized
										</span>
										<span class="font-mono text-[9px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">
											{data()?.realizedPrice?.lthRatio?.toFixed(2) ?? "0.00"}X
										</span>
									</div>
									<div class="p-4 border border-white/10 relative overflow-hidden">
										<div class="text-2xl font-mono text-slate-400 relative z-10">
											{formatCurrency(data()?.realizedPrice?.lth ?? 0)}
										</div>
										<p class="text-[8px] font-bold text-slate-600 uppercase mt-1 relative z-10">
											Strategic Cost Basis
										</p>
										<div class="absolute bottom-0 left-0 h-0.5 bg-slate-800 w-full opacity-30"></div>
									</div>
								</div>
							</div>
						</Show>
					</div>

					<Show when={data()}>
						<div class="px-6 md:px-8 py-4 border-t border-white/5 bg-white/1">
							<div class="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-2 sm:gap-0">
								<span class="font-mono text-[9px] uppercase text-slate-500">
									Bull_Regime_Integrity
								</span>
								<span
									class={`text-[10px] font-black px-2 py-0.5 border uppercase ${
										data()?.realizedPrice.trendBroken
											? "border-rose-500/40 text-rose-400 bg-rose-500/5"
											: "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
									}`}
								>
									{data()?.realizedPrice.trendBroken
										? "⚠️ Compromised"
										: "✓ Primary Trend Intact"}
								</span>
							</div>
						</div>
					</Show>
				</div>
			</div>

			{/* Status Bar */}
			<div class="mt-8 flex justify-between items-center px-2">
				<div class="flex items-center gap-2">
					<div class="w-1.5 h-1.5 bg-cyan-500 animate-pulse rounded-full"></div>
					<span class="font-mono text-[9px] text-slate-500 opacity-60 uppercase">
						Ledger_Sync_Active
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
						: "UNKNOWN"}{" "}
					| Audit_ID: OSC_
					{Math.floor(Date.now() / 1000)
						.toString(16)
						.toUpperCase()}
				</span>
			</div>
		</div>
	);
}
