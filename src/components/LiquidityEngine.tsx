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
	iconBg: string; // Deprecated but kept for compatibility
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
		<div class="directive-card flex flex-col h-full bg-[#0B1221] border border-white/5 hover:border-white/10 transition-all p-6">
			{/* Header */}
			<div class="flex justify-between items-start mb-6">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-indigo-400">
						{props.icon}
					</div>
					<div>
						<h3 class="text-xs font-bold text-white uppercase tracking-wide">
							{props.title}
						</h3>
						<span class="label-mono text-slate-500 text-[10px]">
							{props.correlation} Correlation
						</span>
					</div>
				</div>
			</div>

			{/* Value */}
			<div class="mb-6">
				<Show
					when={!props.loading && props.value !== null}
					fallback={<div class="h-8 w-24 bg-white/5 animate-pulse rounded" />}
				>
					<div class="flex items-baseline gap-2">
						<span class="font-mono text-xl md:text-2xl font-medium text-white tracking-tight">
							{typeof props.value === "number"
								? props.value.toFixed(2)
								: props.value}
							{props.suffix}
						</span>
						<Show when={props.trend}>
							{props.trend === "up" ? (
								<IconTrendUp class="w-4 h-4 text-emerald-400" />
							) : (
								<IconTrendDown class="w-4 h-4 text-rose-400" />
							)}
						</Show>
					</div>
				</Show>
			</div>

			{/* Signal */}
			<div class="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
				<span class="label-mono text-slate-500">Status</span>
				<span
					class={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
						props.signal === "Bullish"
							? "bg-emerald-500/10 text-emerald-400"
							: props.signal === "Bearish"
								? "bg-rose-500/10 text-rose-400"
								: "bg-slate-500/10 text-slate-400"
					}`}
				>
					{props.signal}
				</span>
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

	const fetchData = async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/macro?t=${Date.now()}`);
			if (res.ok) {
				const json = await res.json();
				setData(json);
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
		<div class="space-y-6">
			{/* Controls */}
			<div class="flex justify-between items-center mb-4">
				<div class="flex items-center gap-3">
					<div class="h-px w-8 bg-indigo-500/50"></div>
					<span class="label-mono text-indigo-500 text-[10px]">
						Macro Environment
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

			{/* Cards Grid */}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<IndicatorCard
					title="U.S. Dollar (DXY)"
					value={data().dxy}
					icon={<IconGlobe class="w-full h-full" />}
					iconBg="bg-white/5"
					signal={dxyAnalysis().signal}
					signalLabel={dxyAnalysis().label}
					description={dxyAnalysis().desc}
					correlation="Inverse"
					loading={loading()}
				/>

				<IndicatorCard
					title="10Y Yield"
					value={data().us10y}
					suffix="%"
					icon={<IconChartBar class="w-full h-full" />}
					iconBg="bg-white/5"
					signal={yieldsAnalysis().signal}
					signalLabel={yieldsAnalysis().label}
					description={yieldsAnalysis().desc}
					correlation="Inverse"
					loading={loading()}
				/>

				<IndicatorCard
					title="Real Rates"
					value={data().realRate}
					suffix="%"
					icon={<IconDollar class="w-full h-full" />}
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
					icon={<IconBank class="w-full h-full" />}
					iconBg="bg-white/5"
					signal={fedAnalysis().signal}
					signalLabel={fedAnalysis().label}
					description={fedAnalysis().desc}
					correlation="Inverse"
					loading={loading()}
				/>
			</div>
		</div>
	);
}
