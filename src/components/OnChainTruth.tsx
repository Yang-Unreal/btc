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
	const [lastUpdated, _setLastUpdated] = createSignal<Date | null>(null);

	const fetchData = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/onchain");
			if (res.ok) {
				const json = await res.json();
				if (!json.error) setData(json);
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
		<div class="">
			{/* Section Header */}
			<div class="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4 border-b border-slate-100 pb-6">
				<div>
					<div class="flex items-center gap-2 mb-2">
						<span class="text-[10px] font-black text-cyan-500 uppercase tracking-widest bg-cyan-50 px-2 py-0.5 rounded">
							Tactical Level 03
						</span>
						<span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
							On-Chain Truth
						</span>
					</div>
					<h2 class="text-3xl font-black text-slate-900 tracking-tight">
						On-Chain Valuation
					</h2>
					<p class="text-slate-500 mt-2 max-w-2xl text-sm font-medium">
						Institutional-grade value assessment. Identifying{" "}
						<span class="text-slate-800 font-bold">Holder Conviction</span> and{" "}
						<span class="text-slate-800 font-bold">Supply Dynamics</span>.
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
						class="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-600 hover:text-cyan-600 hover:border-cyan-100 transition-all active:scale-95"
					>
						<IconRefresh class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} />
						{loading() ? "Updating..." : "Refresh"}
					</button>
				</div>
			</div>

			{/* Three Column Layout */}
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* MVRV Z-Score Card */}
				<div class="bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden transition-all hover:bg-white hover:shadow-sm">
					<div class="p-6">
						<div class="flex items-center gap-3 mb-5">
							<div class="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center">
								<IconScale class="w-5 h-5 text-indigo-600" />
							</div>
							<div>
								<h3 class="font-bold text-slate-800">MVRV Z-Score</h3>
								<p class="text-xs text-slate-400">
									Market Value vs Realized Value
								</p>
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
							{/* Z-Score Value */}
							<div class="text-center mb-4">
								<div
									class={`text-5xl font-black tracking-tight ${
										data()?.mvrv?.signalColor === "rose"
											? "text-rose-500"
											: data()?.mvrv?.signalColor === "emerald"
												? "text-emerald-500"
												: "text-slate-700"
									}`}
								>
									{data()?.mvrv?.zScore?.toFixed(2) ?? "0.00"}
								</div>
								<div class="text-sm text-slate-400 mt-1">Z-Score</div>
							</div>

							{/* Gauge Bar */}
							<div class="relative mb-4">
								<div class="h-3 rounded-full bg-slate-100 overflow-hidden">
									{/* Pointer */}
									<div
										class="absolute top-0 w-1 h-3 bg-slate-900 rounded transition-all duration-500"
										style={{ left: `${mvrvGaugePosition()}%` }}
									/>
								</div>
								<div class="flex justify-between mt-1 text-[10px] text-slate-400 font-medium">
									<span>-1 (Buy)</span>
									<span>0</span>
									<span>3+ (Sell)</span>
								</div>
							</div>

							{/* Zones Legend */}
							<div class="grid grid-cols-3 gap-2 text-center text-xs">
								<div class="p-2 bg-slate-50 border border-emerald-100 rounded-lg">
									<div class="font-bold text-emerald-600">&lt; 0</div>
									<div class="text-emerald-500">Undervalued</div>
								</div>
								<div class="p-2 bg-slate-50 border border-slate-100 rounded-lg">
									<div class="font-bold text-slate-600">0-3</div>
									<div class="text-slate-500">Normal</div>
								</div>
								<div class="p-2 bg-slate-50 border border-rose-100 rounded-lg">
									<div class="font-bold text-rose-600">&gt; 3</div>
									<div class="text-rose-500">Overheated</div>
								</div>
							</div>
						</Show>
					</div>

					{/* Signal Footer */}
					<Show when={data()}>
						<div
							class={`p-4 border-t ${
								data()?.mvrv.signalColor === "rose"
									? "bg-rose-50 border-rose-200"
									: data()?.mvrv.signalColor === "emerald"
										? "bg-emerald-50 border-emerald-200"
										: "bg-slate-50 border-slate-200"
							}`}
						>
							<div class="flex justify-between items-center">
								<span class="text-sm font-medium text-slate-600">
									Cycle Position
								</span>
								<span
									class={`text-xs font-bold px-2.5 py-1 rounded-full ${
										data()?.mvrv.signalColor === "rose"
											? "bg-rose-100 text-rose-600 border border-rose-200"
											: data()?.mvrv.signalColor === "emerald"
												? "bg-emerald-100 text-emerald-600 border border-emerald-200"
												: "bg-slate-100 text-slate-600 border border-slate-200"
									}`}
								>
									{data()?.mvrv.signal}
								</span>
							</div>
						</div>
					</Show>
				</div>

				{/* Exchange Balance Card */}
				<div class="bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden transition-all hover:bg-white hover:shadow-sm">
					<div class="p-6">
						<div class="flex items-center gap-3 mb-5">
							<div class="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center">
								<IconDatabase class="w-5 h-5 text-indigo-600" />
							</div>
							<div>
								<h3 class="font-bold text-slate-800">Exchange Balance</h3>
								<p class="text-xs text-slate-400">BTC on all exchanges</p>
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
							{/* Balance Value */}
							<div class="text-center mb-4">
								<div class="text-4xl font-extrabold text-slate-900 tracking-tight">
									{formatNumber(data()?.exchangeBalance?.btc ?? 0)}
								</div>
								<div class="text-sm text-slate-400 mt-1">BTC on Exchanges</div>
							</div>

							{/* Changes */}
							<div class="grid grid-cols-2 gap-3 mb-4">
								<div class="p-3 bg-slate-50 rounded-lg text-center">
									<div class="text-xs text-slate-400 mb-1">7d Change</div>
									<div
										class={`text-lg font-bold ${(data()?.exchangeBalance?.change7d ?? 0) <= 0 ? "text-emerald-600" : "text-rose-600"}`}
									>
										{(data()?.exchangeBalance?.change7d ?? 0) > 0 ? "+" : ""}
										{data()?.exchangeBalance?.change7d?.toFixed(2) ?? "0.00"}%
									</div>
								</div>
								<div class="p-3 bg-slate-50 rounded-lg text-center">
									<div class="text-xs text-slate-400 mb-1">30d Change</div>
									<div
										class={`text-lg font-bold ${(data()?.exchangeBalance?.change30d ?? 0) <= 0 ? "text-emerald-600" : "text-rose-600"}`}
									>
										{(data()?.exchangeBalance?.change30d ?? 0) > 0 ? "+" : ""}
										{data()?.exchangeBalance?.change30d?.toFixed(2) ?? "0.00"}%
									</div>
								</div>
							</div>

							{/* Explanation */}
							<p class="text-xs text-slate-500 leading-relaxed">
								{(data()?.exchangeBalance?.change7d ?? 0) < 0 ? (
									<span class="text-emerald-600 font-medium">
										Coins leaving exchanges = Supply shock potential. Bullish.
									</span>
								) : (data()?.exchangeBalance?.change7d ?? 0) > 1 ? (
									<span class="text-rose-600 font-medium">
										Coins entering exchanges = Potential dump incoming. Bearish.
									</span>
								) : (
									<span>
										Exchange flows are stable. Watch for trend changes.
									</span>
								)}
							</p>
						</Show>
					</div>

					{/* Signal Footer */}
					<Show when={data()}>
						<div
							class={`p-4 border-t ${
								data()?.exchangeBalance.signalColor === "emerald"
									? "bg-emerald-50 border-emerald-200"
									: data()?.exchangeBalance.signalColor === "rose"
										? "bg-rose-50 border-rose-200"
										: "bg-slate-50 border-slate-200"
							}`}
						>
							<div class="flex justify-between items-center">
								<span class="text-sm font-medium text-slate-600">
									Supply Status
								</span>
								<span
									class={`text-xs font-bold px-2.5 py-1 rounded-full ${
										data()?.exchangeBalance.signalColor === "emerald"
											? "bg-emerald-100 text-emerald-600 border border-emerald-200"
											: data()?.exchangeBalance.signalColor === "rose"
												? "bg-rose-100 text-rose-600 border border-rose-200"
												: "bg-slate-100 text-slate-600 border border-slate-200"
									}`}
								>
									{data()?.exchangeBalance.signal}
								</span>
							</div>
						</div>
					</Show>
				</div>

				{/* Realized Price Card */}
				<div class="bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden transition-all hover:bg-white hover:shadow-sm">
					<div class="p-6">
						<div class="flex items-center gap-3 mb-5">
							<div class="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center">
								<IconDiamond class="w-5 h-5 text-indigo-600" />
							</div>
							<div>
								<h3 class="font-bold text-slate-800">Realized Prices</h3>
								<p class="text-xs text-slate-400">Cost basis levels</p>
							</div>
						</div>

						<Show
							when={!loading() && data()}
							fallback={
								<div class="space-y-3">
									<div class="h-12 bg-slate-100 animate-pulse rounded" />
									<div class="h-24 bg-slate-100 animate-pulse rounded" />
								</div>
							}
						>
							{/* Current Price */}
							<div class="text-center mb-4">
								<div class="text-3xl font-extrabold text-slate-900 tracking-tight">
									{formatCurrency(data()?.realizedPrice?.current ?? 0)}
								</div>
								<div class="text-sm text-slate-400 mt-1">Current BTC Price</div>
							</div>

							{/* Price Levels */}
							<div class="space-y-3 mb-4">
								{/* STH Realized */}
								<div class="p-3 border border-slate-100 bg-slate-50 rounded-lg">
									<div class="flex justify-between items-center mb-1">
										<span class="text-xs font-bold text-slate-700">
											STH Realized Price
										</span>
										<span class="text-xs text-slate-500">
											{data()?.realizedPrice?.sthRatio?.toFixed(2) ?? "0.00"}x
										</span>
									</div>
									<div class="text-lg font-bold text-slate-800">
										{formatCurrency(data()?.realizedPrice?.sth ?? 0)}
									</div>
									<p class="text-[10px] text-slate-500 mt-1">
										Short-term holders (tourists) cost basis
									</p>
								</div>

								{/* LTH Realized */}
								<div class="p-3 border border-slate-100 bg-slate-50 rounded-lg">
									<div class="flex justify-between items-center mb-1">
										<span class="text-xs font-bold text-slate-700">
											LTH Realized Price
										</span>
										<span class="text-xs text-slate-500">
											{data()?.realizedPrice?.lthRatio?.toFixed(2) ?? "0.00"}x
										</span>
									</div>
									<div class="text-lg font-bold text-slate-800">
										{formatCurrency(data()?.realizedPrice?.lth ?? 0)}
									</div>
									<p class="text-[10px] text-slate-500 mt-1">
										Long-term holders (diamond hands) cost basis
									</p>
								</div>
							</div>
						</Show>
					</div>

					{/* Trend Signal Footer */}
					<Show when={data()}>
						<div
							class={`p-4 border-t ${
								data()?.realizedPrice.trendBroken
									? "bg-rose-50 border-rose-100"
									: "bg-emerald-50 border-emerald-100"
							}`}
						>
							<div class="flex justify-between items-center">
								<span class="text-sm font-medium text-slate-600">
									Bull Trend
								</span>
								<span
									class={`text-xs font-bold px-2.5 py-1 rounded-full ${
										data()?.realizedPrice.trendBroken
											? "bg-rose-100 text-rose-600 border border-rose-200"
											: "bg-emerald-100 text-emerald-600 border border-emerald-200"
									}`}
								>
									{data()?.realizedPrice.trendBroken ? "⚠️ Broken" : "✓ Intact"}
								</span>
							</div>
						</div>
					</Show>
				</div>
			</div>

			{/* Insight Note */}
			<div class="mt-5 p-4 bg-slate-50 border border-slate-100 rounded-xl">
				<div class="flex items-start gap-3">
					<span class="text-xl">🔍</span>
					<div>
						<p class="text-sm font-semibold text-slate-800 mb-1">
							On-Chain Sets the Floor
						</p>
						<p class="text-sm text-slate-600">
							<strong>
								In a bull market, price should bounce off the STH Realized
								Price.
							</strong>{" "}
							If it breaks below, the short-term trend is broken.
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
