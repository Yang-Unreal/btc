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
		<div class="space-y-6">
			{/* Controls & Mini-Header */}
			<div class="flex justify-between items-center mb-4">
				<div class="flex items-center gap-3">
					<div class="h-px w-8 bg-cyan-500/50"></div>
					<span class="label-mono text-cyan-500 text-[10px]">
						Chain Analysis
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

			{/* Three Column Layout */}
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-1 bg-white/5 border border-white/5 rounded-xl overflow-hidden">
				{/* --- MVRV Z-Score Card --- */}
				<div class="bg-[#0B1221] p-6 flex flex-col relative group hover:bg-[#0f1525] transition-colors">
					<div class="flex items-center gap-3 mb-6 opacity-80">
						<IconScale class="w-4 h-4 text-slate-400" />
						<span class="text-xs font-bold text-slate-300 uppercase tracking-wide">
							MVRV Z-Score
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
						<div class="mb-6">
							<div
								class={`text-4xl font-mono tracking-tight font-medium ${
									data()?.mvrv.signalColor === "rose"
										? "text-rose-400"
										: data()?.mvrv.signalColor === "emerald"
											? "text-emerald-400"
											: "text-white"
								}`}
							>
								{data()?.mvrv?.zScore?.toFixed(2) ?? "0.00"}
							</div>
							<div class="label-mono text-slate-600 mt-1">Z Factor</div>
						</div>

						{/* MVRV Linear Map */}
						<div class="relative h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
							{/* Zones */}
							<div class="absolute inset-0 flex w-full opacity-30">
								<div class="w-[20%] bg-emerald-500"></div>
								<div class="w-[60%] bg-slate-500"></div>
								<div class="w-[20%] bg-rose-500"></div>
							</div>
							{/* Marker */}
							<div
								class="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_white] transition-all duration-700 ease-out"
								style={{ left: `${mvrvGaugePosition()}%` }}
							/>
						</div>

						<div class="flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-wider">
							<span>Undervalued</span>
							<span>Overheated</span>
						</div>

						<div class="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
							<span class="label-mono text-slate-500">Signal</span>
							<span
								class={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
									data()?.mvrv.signalColor === "rose"
										? "bg-rose-500/10 text-rose-400"
										: data()?.mvrv.signalColor === "emerald"
											? "bg-emerald-500/10 text-emerald-400"
											: "bg-slate-500/10 text-slate-400"
								}`}
							>
								{data()?.mvrv.signal}
							</span>
						</div>
					</Show>
				</div>

				{/* --- Exchange Balance Card --- */}
				<div class="bg-[#0B1221] p-6 flex flex-col relative group hover:bg-[#0f1525] transition-colors border-t lg:border-t-0 lg:border-l border-white/5">
					<div class="flex items-center gap-3 mb-6 opacity-80">
						<IconDatabase class="w-4 h-4 text-slate-400" />
						<span class="text-xs font-bold text-slate-300 uppercase tracking-wide">
							Exchange Flow
						</span>
					</div>

					<Show
						when={!loading() && data()}
						fallback={
							<div class="space-y-4 animate-pulse">
								<div class="h-8 w-32 bg-white/5 rounded" />
								<div class="grid grid-cols-2 gap-4">
									<div class="h-12 bg-white/5 rounded" />
									<div class="h-12 bg-white/5 rounded" />
								</div>
							</div>
						}
					>
						<div class="mb-6">
							<div class="text-3xl text-white font-mono tracking-tight font-medium">
								{formatNumber(data()?.exchangeBalance?.btc ?? 0)}
							</div>
							<div class="label-mono text-slate-600 mt-1">BTC On Exchanges</div>
						</div>

						<div class="grid grid-cols-2 gap-4 mb-4">
							<div>
								<div class="label-mono text-slate-500 mb-1">7d Change</div>
								<div
									class={`text-sm font-mono font-bold ${
										(data()?.exchangeBalance?.change7d ?? 0) <= 0
											? "text-emerald-400"
											: "text-rose-400"
									}`}
								>
									{(data()?.exchangeBalance?.change7d ?? 0) > 0 ? "+" : ""}
									{data()?.exchangeBalance?.change7d?.toFixed(2) ?? "0.00"}%
								</div>
							</div>
							<div>
								<div class="label-mono text-slate-500 mb-1">30d Change</div>
								<div
									class={`text-sm font-mono font-bold ${
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

						<div class="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
							<span class="label-mono text-slate-500">Flow Status</span>
							<span
								class={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
									data()?.exchangeBalance.signalColor === "emerald"
										? "bg-emerald-500/10 text-emerald-400"
										: data()?.exchangeBalance.signalColor === "rose"
											? "bg-rose-500/10 text-rose-400"
											: "bg-slate-500/10 text-slate-400"
								}`}
							>
								{data()?.exchangeBalance.signal}
							</span>
						</div>
					</Show>
				</div>

				{/* --- Realized Price Card --- */}
				<div class="bg-[#0B1221] p-6 flex flex-col relative group hover:bg-[#0f1525] transition-colors border-t lg:border-t-0 lg:border-l border-white/5">
					<div class="flex items-center gap-3 mb-6 opacity-80">
						<IconDiamond class="w-4 h-4 text-slate-400" />
						<span class="text-xs font-bold text-slate-300 uppercase tracking-wide">
							Realized Basis
						</span>
					</div>

					<Show
						when={!loading() && data()}
						fallback={
							<div class="space-y-4 animate-pulse">
								<div class="h-8 w-32 bg-white/5 rounded" />
								<div class="h-20 bg-white/5 rounded" />
							</div>
						}
					>
						<div class="mb-6">
							<div class="text-3xl text-white font-mono tracking-tight font-medium">
								{formatCurrency(data()?.realizedPrice?.current ?? 0)}
							</div>
							<div class="label-mono text-slate-600 mt-1">
								Aggregate Cost Basis
							</div>
						</div>

						<div class="space-y-3 mb-4">
							<div class="flex justify-between items-center text-sm">
								<span class="text-slate-500 font-medium text-xs">
									Short-Term Holders
								</span>
								<span class="font-mono text-slate-300">
									{formatCurrency(data()?.realizedPrice?.sth ?? 0)}
								</span>
							</div>
							<div class="flex justify-between items-center text-sm">
								<span class="text-slate-500 font-medium text-xs">
									Long-Term Holders
								</span>
								<span class="font-mono text-slate-300">
									{formatCurrency(data()?.realizedPrice?.lth ?? 0)}
								</span>
							</div>
						</div>

						<div class="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
							<span class="label-mono text-slate-500">Trend Integrity</span>
							<span
								class={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
									data()?.realizedPrice.trendBroken
										? "bg-rose-500/10 text-rose-400"
										: "bg-emerald-500/10 text-emerald-400"
								}`}
							>
								{data()?.realizedPrice.trendBroken ? "Compromised" : "Intact"}
							</span>
						</div>
					</Show>
				</div>
			</div>
		</div>
	);
}
