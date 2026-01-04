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
		const timer = setInterval(fetchData, 180000); // 3 min refresh
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
		<div class="my-8 md:my-12">
			{/* Section Header - Institutional Style */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6 border-l-4 border-cyan-500 pl-6 py-2">
				<div class="min-w-0">
					<div class="flex items-center gap-3 mb-3 flex-wrap">
						<span class="badge-directive text-cyan-500 border-cyan-500/30 bg-cyan-500/5">
							Tactical_Level_03
						</span>
						<span class="label-mono opacity-40">OnChain_Truth_Feed</span>
					</div>
					<h2 class="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-tight">
						On-Chain Valuation
					</h2>
					<p class="text-slate-500 mt-3 max-w-2xl text-[13px] font-bold leading-relaxed uppercase tracking-tight">
						Institutional-grade value assessment. Identifying{" "}
						<span class="text-white">Holder Conviction</span> and{" "}
						<span class="text-white">Supply Dynamics</span> through immutable
						ledger analysis.
					</p>
				</div>
				<div class="flex items-center gap-3">
					<Show when={data()?.isDemo}>
						<span class="badge-directive text-amber-500 border-amber-500/30 bg-amber-500/5">
							Demo_Protocol
						</span>
					</Show>
					<button
						type="button"
						onClick={fetchData}
						class="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all active:scale-95"
					>
						<IconRefresh
							class={`w-3.5 h-3.5 ${loading() ? "animate-spin" : ""}`}
						/>
						{loading() ? "Syncing..." : "Sync_Data"}
					</button>
				</div>
			</div>

			{/* Three Column Layout - Directive Style */}
			<div class="grid grid-cols-1 md:grid-cols-3 gap-1">
				{/* MVRV Z-Score Card */}
				<div class="directive-card border-r-0 md:border-r">
					<div class="p-6">
						<div class="flex items-center gap-3 mb-8">
							<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
								<IconScale class="w-5 h-5 text-indigo-400" />
							</div>
							<div>
								<h3 class="font-black text-white uppercase tracking-tighter text-sm">
									MVRV Z-Score
								</h3>
								<p class="label-mono opacity-50">Fair_Value_Delta</p>
							</div>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-4">
									<div class="h-10 bg-white/5 animate-pulse" />
									<div class="h-6 bg-white/5 animate-pulse" />
								</div>
							}
						>
							{/* Z-Score Value */}
							<div class="text-center py-4 bg-white/2 border border-white/5 mb-6">
								<div
									class={`data-value text-4xl sm:text-5xl ${
										data()?.mvrv?.signalColor === "rose"
											? "text-rose-400"
											: data()?.mvrv?.signalColor === "emerald"
												? "text-emerald-400"
												: "text-white"
									}`}
								>
									{data()?.mvrv?.zScore?.toFixed(3) ?? "0.000"}
								</div>
								<div class="text-[9px] font-bold text-slate-600 uppercase mt-2">
									Current_Z_Factor
								</div>
							</div>

							{/* Gauge Bar */}
							<div class="relative py-2 mb-6">
								<div class="h-1.5 bg-white/5 border border-white/10 overflow-hidden">
									<div
										class="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-white shadow-[0_0_10px_#fff] transition-all duration-700"
										style={{ left: `${mvrvGaugePosition()}%` }}
									/>
								</div>
								<div class="flex justify-between mt-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
									<span class="text-emerald-500">Undervalued</span>
									<span>Neutral</span>
									<span class="text-rose-500">Overheated</span>
								</div>
							</div>

							{/* Zones Legend */}
							<div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
								<div class="p-3 bg-emerald-500/5 border border-emerald-500/10">
									<div class="text-[10px] font-mono font-black text-emerald-400">
										&lt; 0.0
									</div>
									<div class="text-[8px] font-bold text-slate-600 uppercase mt-1">
										Accumulate
									</div>
								</div>
								<div class="p-3 bg-white/2 border border-white/5 text-center">
									<div class="text-[10px] font-mono font-black text-slate-400">
										0 - 3
									</div>
									<div class="text-[8px] font-bold text-slate-600 uppercase mt-1">
										Normal
									</div>
								</div>
								<div class="p-3 bg-rose-500/5 border border-rose-500/10 text-right sm:text-right">
									<div class="text-[10px] font-mono font-black text-rose-400">
										&gt; 3.0
									</div>
									<div class="text-[8px] font-bold text-slate-600 uppercase mt-1">
										Distribute
									</div>
								</div>
							</div>
						</Show>
					</div>

					<Show when={data()}>
						<div
							class={`px-6 py-4 border-t border-white/5 ${
								data()?.mvrv.signalColor === "rose"
									? "bg-rose-500/5"
									: data()?.mvrv.signalColor === "emerald"
										? "bg-emerald-500/5"
										: "bg-white/2"
							}`}
						>
							<div class="flex justify-between items-center">
								<span class="label-mono uppercase opacity-50">
									Market_Phase
								</span>
								<span
									class={`text-[10px] font-black px-2 py-0.5 border uppercase ${
										data()?.mvrv.signalColor === "rose"
											? "border-rose-500/40 text-rose-400"
											: data()?.mvrv.signalColor === "emerald"
												? "border-emerald-500/40 text-emerald-400"
												: "border-white/10 text-slate-400"
									}`}
								>
									{data()?.mvrv.signal}
								</span>
							</div>
						</div>
					</Show>
				</div>

				{/* Exchange Balance Card */}
				<div class="directive-card border-r-0 md:border-r">
					<div class="p-6">
						<div class="flex items-center gap-3 mb-8">
							<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
								<IconDatabase class="w-5 h-5 text-cyan-400" />
							</div>
							<div>
								<h3 class="font-black text-white uppercase tracking-tighter text-sm">
									Exchange Flow
								</h3>
								<p class="label-mono opacity-50">Supply_Liquidity</p>
							</div>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-4">
									<div class="h-10 bg-white/5 animate-pulse" />
									<div class="h-16 bg-white/5 animate-pulse" />
								</div>
							}
						>
							{/* Balance Value */}
							<div class="text-center py-4 bg-white/2 border border-white/5 mb-6">
								<div class="data-value text-3xl sm:text-4xl text-white truncate px-2">
									{formatNumber(data()?.exchangeBalance?.btc ?? 0)}
								</div>
								<div class="text-[9px] font-bold text-slate-600 uppercase mt-2">
									BTC_ON_EXCHANGES
								</div>
							</div>

							{/* Changes */}
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-6">
								<div class="p-4 bg-white/2 border border-white/5 text-center">
									<div class="text-[9px] font-bold text-slate-600 uppercase mb-2 tracking-widest">
										7D_Delta
									</div>
									<div
										class={`data-value text-lg sm:text-xl ${(data()?.exchangeBalance?.change7d ?? 0) <= 0 ? "text-emerald-400" : "text-rose-400"}`}
									>
										{(data()?.exchangeBalance?.change7d ?? 0) > 0 ? "+" : ""}
										{data()?.exchangeBalance?.change7d?.toFixed(2) ?? "0.00"}%
									</div>
								</div>
								<div class="p-4 bg-white/2 border border-white/5 text-center">
									<div class="text-[9px] font-bold text-slate-600 uppercase mb-2 tracking-widest">
										30D_Delta
									</div>
									<div
										class={`data-value text-lg sm:text-xl ${(data()?.exchangeBalance?.change30d ?? 0) <= 0 ? "text-emerald-400" : "text-rose-400"}`}
									>
										{(data()?.exchangeBalance?.change30d ?? 0) > 0 ? "+" : ""}
										{data()?.exchangeBalance?.change30d?.toFixed(2) ?? "0.00"}%
									</div>
								</div>
							</div>

							{/* Explanation */}
							<div class="bg-indigo-500/5 border border-white/5 p-4">
								<p class="text-[10px] font-bold leading-relaxed uppercase tracking-tight text-slate-400">
									{(data()?.exchangeBalance?.change7d ?? 0) < 0 ? (
										<span class="text-emerald-400 font-black">
											Supply Squeeze Active: Outflows detected. Bullish
											accumulation trend confirmed.
										</span>
									) : (data()?.exchangeBalance?.change7d ?? 0) > 1 ? (
										<span class="text-rose-400 font-black">
											Exchange Inflow Surge: Elevated liquidation risk. Monitor
											for distribution.
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

					{/* Signal Footer */}
					<Show when={data()}>
						<div
							class={`px-6 py-4 border-t border-white/5 ${
								data()?.exchangeBalance.signalColor === "emerald"
									? "bg-emerald-500/5"
									: data()?.exchangeBalance.signalColor === "rose"
										? "bg-rose-500/5"
										: "bg-white/2"
							}`}
						>
							<div class="flex justify-between items-center">
								<span class="label-mono uppercase opacity-50">
									Supply_Shock_Status
								</span>
								<span
									class={`text-[10px] font-black px-2 py-0.5 border uppercase ${
										data()?.exchangeBalance.signalColor === "emerald"
											? "border-emerald-500/40 text-emerald-400"
											: data()?.exchangeBalance.signalColor === "rose"
												? "border-rose-500/40 text-rose-400"
												: "border-white/10 text-slate-400"
									}`}
								>
									{data()?.exchangeBalance.signal}
								</span>
							</div>
						</div>
					</Show>
				</div>

				{/* Realized Price Card */}
				<div class="directive-card">
					<div class="p-6">
						<div class="flex items-center gap-3 mb-8">
							<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
								<IconDiamond class="w-5 h-5 text-emerald-400" />
							</div>
							<div>
								<h3 class="font-black text-white uppercase tracking-tighter text-sm">
									Realized Basis
								</h3>
								<p class="label-mono opacity-50">Holding_Costs</p>
							</div>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-4">
									<div class="h-10 bg-white/5 animate-pulse" />
									<div class="h-24 bg-white/5 animate-pulse" />
								</div>
							}
						>
							{/* Current Price */}
							<div class="text-center py-4 bg-white/2 border border-white/5 mb-6">
								<div class="data-value text-3xl sm:text-4xl text-white truncate px-2">
									{formatCurrency(data()?.realizedPrice?.current ?? 0)}
								</div>
								<div class="text-[9px] font-bold text-slate-600 uppercase mt-2">
									TERMINAL_MARKET_PRICE
								</div>
							</div>

							{/* Price Levels */}
							<div class="space-y-1 mb-6">
								{/* STH Realized */}
								<div class="p-4 border border-white/5 bg-white/2">
									<div class="flex justify-between items-center mb-2">
										<span class="text-[10px] font-black text-white uppercase tracking-tight">
											STH_Realized
										</span>
										<span class="label-mono text-[9px]">
											{data()?.realizedPrice?.sthRatio?.toFixed(2) ?? "0.00"}
											X_MTM
										</span>
									</div>
									<div class="data-value text-2xl text-slate-300">
										{formatCurrency(data()?.realizedPrice?.sth ?? 0)}
									</div>
									<p class="text-[8px] font-bold text-slate-600 uppercase mt-2">
										Short-term / Speculator cost basis
									</p>
								</div>

								{/* LTH Realized */}
								<div class="p-4 border border-white/5 bg-white/2">
									<div class="flex justify-between items-center mb-2">
										<span class="text-[10px] font-black text-white uppercase tracking-tight">
											LTH_Realized
										</span>
										<span class="label-mono text-[9px]">
											{data()?.realizedPrice?.lthRatio?.toFixed(2) ?? "0.00"}
											X_MTM
										</span>
									</div>
									<div class="data-value text-2xl text-slate-400">
										{formatCurrency(data()?.realizedPrice?.lth ?? 0)}
									</div>
									<p class="text-[8px] font-bold text-slate-600 uppercase mt-2">
										Long-term / Strategic cost basis
									</p>
								</div>
							</div>
						</Show>
					</div>

					{/* Trend Signal Footer */}
					<Show when={data()}>
						<div
							class={`px-6 py-4 border-t border-white/5 ${
								data()?.realizedPrice.trendBroken
									? "bg-rose-500/5"
									: "bg-emerald-500/5"
							}`}
						>
							<div class="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-2 sm:gap-0">
								<span class="label-mono uppercase opacity-50">
									Bull_Regime_Integrity
								</span>
								<span
									class={`text-[10px] font-black px-2 py-0.5 border uppercase ${
										data()?.realizedPrice.trendBroken
											? "border-rose-500/40 text-rose-400"
											: "border-emerald-500/40 text-emerald-400"
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
			<div class="mt-6 flex justify-between items-center">
				<div class="flex items-center gap-2">
					<div class="w-1.5 h-1.5 bg-cyan-500 animate-pulse rounded-full"></div>
					<span class="label-mono text-[9px] opacity-40 uppercase">
						Ledger_Sync_Active
					</span>
				</div>
				<span class="label-mono text-[9px] opacity-40 uppercase">
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
