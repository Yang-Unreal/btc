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

// --- Signal Colors ---
const getSignalColors = (signal: SignalType) => {
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
	const colors = () => getSignalColors(props.signal);

	return (
		<div class="group bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all duration-300 overflow-hidden">
			{/* Header */}
			<div class="p-5 pb-3">
				<div class="flex justify-between items-start mb-3">
					<div class="flex items-center gap-3">
						<div
							class={`w-10 h-10 rounded-xl ${props.iconBg} shadow-sm flex items-center justify-center`}
						>
							{props.icon}
						</div>
						<div>
							<h3 class="font-bold text-slate-800 text-sm leading-tight">
								{props.title}
							</h3>
							<div class="flex items-center gap-1.5 mt-0.5">
								<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-sm">
									{props.correlation}
								</span>
								<Show when={props.isDemo}>
									<span class="text-[9px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">
										Demo
									</span>
								</Show>
								<span class="text-[10px] text-slate-400">to BTC</span>
							</div>
						</div>
					</div>
				</div>

				{/* Value */}
				<div class="flex items-baseline gap-2">
					<Show
						when={!props.loading && props.value !== null}
						fallback={
							<div class="h-9 w-28 bg-slate-100 animate-pulse rounded" />
						}
					>
						<span
							class={`text-3xl font-extrabold tracking-tight ${
								props.trend === "up"
									? "text-emerald-500"
									: props.trend === "down"
										? "text-rose-500"
										: "text-slate-900"
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
								<IconTrendUp class="w-5 h-5 text-emerald-500" />
							) : (
								<IconTrendDown class="w-5 h-5 text-rose-500" />
							)}
						</Show>
					</Show>
				</div>
			</div>

			{/* Signal Section */}
			<div class={`p-4 ${colors().bg} border-t ${colors().border}`}>
				<div class="flex justify-between items-center mb-2">
					<span class="text-xs font-bold text-slate-500 uppercase tracking-wide">
						BTC Impact
					</span>
					<span
						class={`text-xs font-bold px-2.5 py-1 rounded-full ${colors().bg} ${colors().text} border ${colors().border}`}
					>
						{props.signal}
					</span>
				</div>
				<p class="text-sm text-slate-600">{props.description}</p>
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
		<div class="">
			{/* Section Header */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-5 gap-4">
				<div>
					<div class="flex items-center gap-2 mb-2">
						<span class="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-full">
							Level 1
						</span>
						<span class="text-xs text-slate-400 font-medium">The Engine</span>
					</div>
					<h2 class="text-2xl font-bold text-slate-900 tracking-tight">
						Global Liquidity
					</h2>
					<p class="text-slate-500 mt-1 max-w-2xl text-sm">
						Crypto is a "Liquidity Sponge". These metrics show if money is
						flowing into or out of risk assets.
					</p>
				</div>
				<button
					type="button"
					onClick={fetchData}
					class="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-95"
				>
					<IconRefresh class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} />
					{loading() ? "Updating..." : "Refresh"}
				</button>
			</div>

			{/* Cards Grid */}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<IndicatorCard
					title="U.S. Dollar Index (DXY)"
					value={data().dxy}
					icon={<IconGlobe class="w-5 h-5 text-indigo-600" />}
					iconBg="bg-slate-50"
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
					icon={<IconChartBar class="w-5 h-5 text-indigo-600" />}
					iconBg="bg-slate-50"
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
					icon={<IconDollar class="w-5 h-5 text-indigo-600" />}
					iconBg="bg-slate-50"
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
					icon={<IconBank class="w-5 h-5 text-indigo-600" />}
					iconBg="bg-slate-50"
					signal={fedAnalysis().signal}
					signalLabel={fedAnalysis().label}
					description={fedAnalysis().desc}
					correlation="Inverse"
					loading={loading()}
				/>
			</div>

			{/* Golden Rule Note */}
			<div class="mt-5 p-4 bg-slate-50 border border-slate-100 rounded-xl">
				<div class="flex items-start gap-3">
					<span class="text-xl">💡</span>
					<div>
						<p class="text-sm font-semibold text-slate-800 mb-1">
							The Golden Rule
						</p>
						<p class="text-sm text-slate-600">
							<strong>DXY falling + Yields falling = Bullish for BTC.</strong>{" "}
							Global Liquidity sets the direction of the cycle.
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
