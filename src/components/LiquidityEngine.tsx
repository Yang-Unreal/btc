import {
	type Component,
	createSignal,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";

// --- Icons ---
const IconGlobe: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Globe</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
		/>
	</svg>
);

const IconTrendUp: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Trend Up</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
		/>
	</svg>
);

const IconTrendDown: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Trend Down</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"
		/>
	</svg>
);

const IconBank: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Bank</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
		/>
	</svg>
);

const IconDollar: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Dollar</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
		/>
	</svg>
);

const IconChartBar: Component<{ class?: string }> = (props) => (
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
			d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
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
interface MacroData {
	dxy: number | null;
	us10y: number | null;
	realRate: number | null;
	impliedFedRate: number | null;
}

type SignalType = "Bullish" | "Bearish" | "Neutral";

interface IndicatorCardProps {
	title: string;
	value: string | number | null;
	suffix?: string;
	icon: JSX.Element;
	iconBg: string;
	signal: SignalType;
	signalLabel: string;
	description: string;
	correlation: "Inverse" | "Direct";
	loading: boolean;
	trend?: "up" | "down" | null;
	isDemo?: boolean;
}

// --- Analysis Functions ---
const analyzeDXY = (
	val: number | null,
): { signal: SignalType; label: string; desc: string } => {
	if (val === null) return { signal: "Neutral", label: "--", desc: "No data" };
	if (val > 103)
		return {
			signal: "Bearish",
			label: "Headwind",
			desc: "Strong Dollar suppresses BTC",
		};
	if (val < 99)
		return {
			signal: "Bullish",
			label: "Tailwind",
			desc: "Weak Dollar boosts assets",
		};
	return {
		signal: "Neutral",
		label: "Neutral",
		desc: "Dollar within normal range",
	};
};

const analyzeYields = (
	val: number | null,
): { signal: SignalType; label: string; desc: string } => {
	if (val === null) return { signal: "Neutral", label: "--", desc: "No data" };
	if (val > 4.5)
		return {
			signal: "Bearish",
			label: "Restrictive",
			desc: "High yields compete with BTC",
		};
	if (val < 3.5)
		return {
			signal: "Bullish",
			label: "Accommodative",
			desc: "Low yields boost BTC appeal",
		};
	return {
		signal: "Neutral",
		label: "Moderate",
		desc: "Yields at neutral levels",
	};
};

const analyzeRealRate = (
	val: number | null,
): { signal: SignalType; label: string; desc: string } => {
	if (val === null) return { signal: "Neutral", label: "--", desc: "No data" };
	if (val > 2.0)
		return {
			signal: "Bearish",
			label: "Tight",
			desc: "Positive real rates hurt risk assets",
		};
	if (val < 0.5)
		return {
			signal: "Bullish",
			label: "Easy",
			desc: "Low real rates favor speculation",
		};
	return {
		signal: "Neutral",
		label: "Balanced",
		desc: "Real rates at equilibrium",
	};
};

const analyzeFedRate = (
	val: number | null,
): { signal: SignalType; label: string; desc: string } => {
	if (val === null) return { signal: "Neutral", label: "--", desc: "No data" };
	if (val > 4.5)
		return {
			signal: "Bearish",
			label: "Tight Policy",
			desc: "High cost of capital",
		};
	if (val < 3.0)
		return {
			signal: "Bullish",
			label: "Loose Policy",
			desc: "Cheap money fuels crypto",
		};
	return { signal: "Neutral", label: "Neutral", desc: "Rates near anchor" };
};

// --- Indicator Card Component ---
const IndicatorCard: Component<IndicatorCardProps> = (props) => {
	return (
		<div class="directive-card flex flex-col h-full hover:bg-white/2 transition-colors">
			{/* Header */}
			<div class="p-6 pb-2">
				<div class="flex justify-between items-start mb-6">
					<div class="flex items-center gap-3">
						<div
							class={`w-10 h-10 border border-white/10 bg-white/5 flex items-center justify-center`}
						>
							{props.icon}
						</div>
						<div>
							<h3 class="font-black text-white uppercase tracking-tighter text-sm leading-tight">
								{props.title}
							</h3>
							<div class="flex items-center gap-2 mt-1">
								<span class="label-mono text-[9px] opacity-50">
									Correlation: {props.correlation}
								</span>
								<Show when={props.isDemo}>
									<span class="badge-directive text-rose-400 border-rose-400/30 bg-rose-400/5">
										DEMO
									</span>
								</Show>
							</div>
						</div>
					</div>
				</div>

				{/* Value */}
				<div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 mb-6 overflow-hidden">
					<Show
						when={!props.loading && props.value !== null}
						fallback={<div class="h-10 w-32 bg-white/5 animate-pulse" />}
					>
						<div class="flex items-center gap-2 truncate">
							<span
								class={`data-value text-3xl sm:text-4xl ${
									props.trend === "up"
										? "text-emerald-400"
										: props.trend === "down"
											? "text-rose-400"
											: "text-white"
								}`}
							>
								{typeof props.value === "number"
									? props.value >= 1000
										? (props.value / 1000).toFixed(2) + "T"
										: props.value.toFixed(2)
									: props.value}
								{props.suffix &&
								(typeof props.value !== "number" || props.value < 1000)
									? props.suffix
									: ""}
							</span>
							<Show when={props.trend}>
								{props.trend === "up" ? (
									<IconTrendUp class="w-5 h-5 text-emerald-400 shrink-0" />
								) : (
									<IconTrendDown class="w-5 h-5 text-rose-400 shrink-0" />
								)}
							</Show>
						</div>
					</Show>
				</div>
			</div>

			{/* Signal Section */}
			<div
				class={`mt-auto p-4 border-t border-white/5 ${
					props.signal === "Bullish"
						? "bg-emerald-500/5"
						: props.signal === "Bearish"
							? "bg-rose-500/5"
							: "bg-white/2"
				}`}
			>
				<div class="flex justify-between items-center mb-2">
					<span class="label-mono text-[9px] opacity-40 uppercase">
						BTC_Impact_Analysis
					</span>
					<span
						class={`text-[10px] font-black px-2 py-0.5 border uppercase ${
							props.signal === "Bullish"
								? "border-emerald-500/40 text-emerald-400"
								: props.signal === "Bearish"
									? "border-rose-500/40 text-rose-400"
									: "border-white/10 text-slate-400"
						}`}
					>
						{props.signal}
					</span>
				</div>
				<p class="text-[11px] font-bold text-slate-500 uppercase tracking-tight leading-tight">
					{props.description}
				</p>
			</div>
		</div>
	);
};

// --- Main Component ---
export default function LiquidityEngine() {
	const [data, setData] = createSignal<MacroData>({
		dxy: null,
		us10y: null,
		realRate: null,
		impliedFedRate: null,
	});
	const [loading, setLoading] = createSignal(true);
	const [lastUpdated, setLastUpdated] = createSignal<Date | null>(null);

	const fetchData = async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/macro?t=${Date.now()}`);
			if (res.ok) {
				const json = await res.json();
				setData(json);
				setLastUpdated(new Date());
			}
		} catch (e) {
			console.error("Failed to fetch liquidity data:", e);
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
		const timer = setInterval(fetchData, 60000);
		onCleanup(() => clearInterval(timer));
	});

	const dxyAnalysis = () => analyzeDXY(data().dxy);
	const yieldsAnalysis = () => analyzeYields(data().us10y);
	const realRateAnalysis = () => analyzeRealRate(data().realRate);
	const fedAnalysis = () => analyzeFedRate(data().impliedFedRate);

	return (
		<div class="my-8 md:my-12">
			{/* Section Header - Institutional Style */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6 border-l-4 border-indigo-500 pl-6 py-2">
				<div class="min-w-0">
					<div class="flex items-center gap-3 mb-3 flex-wrap">
						<span class="badge-directive text-indigo-400 border-indigo-500/30 bg-indigo-500/5">
							Tactical_Level_01
						</span>
						<span class="label-mono opacity-40">Global_Liquidity_Engine</span>
					</div>
					<h2 class="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-tight">
						Macro Liquidity
					</h2>
					<p class="text-slate-500 mt-3 max-w-2xl text-[13px] font-bold leading-relaxed uppercase tracking-tight">
						Crypto is a <span class="text-white">"Liquidity Sponge"</span>.
						Systematic monitoring of global capital flows and interest rate
						regimes to determine primary asset direction.
					</p>
				</div>
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

			{/* Cards Grid - Directive Style */}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1">
				<IndicatorCard
					title="U.S. Dollar Index (DXY)"
					value={data().dxy}
					icon={<IconGlobe class="w-5 h-5 text-indigo-400" />}
					iconBg="bg-white/5"
					signal={dxyAnalysis().signal}
					signalLabel={dxyAnalysis().label}
					description={dxyAnalysis().desc}
					correlation="Inverse"
					loading={loading()}
				/>

				<IndicatorCard
					title="10Y Treasury Yield"
					value={data().us10y}
					suffix="%"
					icon={<IconChartBar class="w-5 h-5 text-indigo-400" />}
					iconBg="bg-white/5"
					signal={yieldsAnalysis().signal}
					signalLabel={yieldsAnalysis().label}
					description={yieldsAnalysis().desc}
					correlation="Inverse"
					loading={loading()}
				/>

				<IndicatorCard
					title="Real Interest Rate"
					value={data().realRate}
					suffix="%"
					icon={<IconDollar class="w-5 h-5 text-indigo-400" />}
					iconBg="bg-white/5"
					signal={realRateAnalysis().signal}
					signalLabel={realRateAnalysis().label}
					description={realRateAnalysis().desc}
					correlation="Inverse"
					loading={loading()}
				/>

				<IndicatorCard
					title="Implied Fed Rate"
					value={data().impliedFedRate}
					suffix="%"
					icon={<IconBank class="w-5 h-5 text-indigo-400" />}
					iconBg="bg-white/5"
					signal={fedAnalysis().signal}
					signalLabel={fedAnalysis().label}
					description={fedAnalysis().desc}
					correlation="Inverse"
					loading={loading()}
				/>
			</div>

			{/* Golden Rule Note */}
			<div class="mt-8 p-4 bg-indigo-500/5 border border-indigo-500/10">
				<div class="flex items-start gap-4">
					<span class="text-2xl filter saturate-0 grayscale opacity-50">
						💡
					</span>
					<div>
						<p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">
							Protocol_Heuristic
						</p>
						<p class="text-[11px] text-slate-400 font-bold uppercase tracking-tight leading-normal">
							<span class="text-white">DXY falling + Yields falling</span>{" "}
							results in maximum risk-on tailwinds. Global Liquidity determines
							the fundamental velocity of the BTC cycle.
						</p>
					</div>
				</div>
			</div>

			{/* Status Bar */}
			<div class="mt-6 flex justify-between items-center">
				<div class="flex items-center gap-2">
					<div class="w-1.5 h-1.5 bg-indigo-500 animate-pulse rounded-full"></div>
					<span class="label-mono text-[9px] opacity-40 uppercase">
						Macro_Stream_Active
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
						: "UNKNOWN"}
				</span>
			</div>
		</div>
	);
}
