import { createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";

// --- Icons ---

const IconBank = (props: { class?: string }) => (
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

const IconScale = (props: { class?: string }) => (
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

const IconGlobe = (props: { class?: string }) => (
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

const IconRefresh = (props: { class?: string }) => (
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

// --- Types & Helpers ---

type ImpactLevel = "Bullish" | "Neutral" | "Bearish";

interface AnalysisResult {
	label: string;
	description: string;
	impact: ImpactLevel;
	color: string;
	bgColor: string;
	correlationType: "Inverse" | "Direct";
}

export default function MacroData() {
	const [dxy, setDxy] = createSignal<number | null>(null);
	const [us10y, setUs10y] = createSignal<number | null>(null);
	const [realRate, setRealRate] = createSignal<number | null>(null);
	const [impliedFedRate, setImpliedFedRate] = createSignal<number | null>(null);

	const [loading, setLoading] = createSignal(true);
	const [lastUpdated, setLastUpdated] = createSignal<Date | null>(null);

	// Directions for UI flash
	const [dxyDir, setDxyDir] = createSignal<"up" | "down" | null>(null);

	// --- Analytical Logic ---
	const analyzeDXY = (val: number | null): AnalysisResult => {
		if (val === null)
			return {
				label: "--",
				description: "No Data",
				impact: "Neutral",
				color: "text-slate-400",
				bgColor: "bg-slate-100",
				correlationType: "Inverse",
			};

		if (val > 103)
			return {
				label: "Headwind",
				description: "Strong Dollar typically suppresses BTC price.",
				impact: "Bearish",
				color: "text-rose-600",
				bgColor: "bg-rose-50",
				correlationType: "Inverse",
			};
		if (val < 99)
			return {
				label: "Tailwind",
				description: "Weak Dollar encourages asset speculation.",
				impact: "Bullish",
				color: "text-emerald-600",
				bgColor: "bg-emerald-50",
				correlationType: "Inverse",
			};
		return {
			label: "Neutral",
			description: "Dollar strength is within normal bounds.",
			impact: "Neutral",
			color: "text-slate-600",
			bgColor: "bg-slate-50",
			correlationType: "Inverse",
		};
	};

	const analyzeYields = (val: number | null): AnalysisResult => {
		if (val === null)
			return {
				label: "--",
				description: "No Data",
				impact: "Neutral",
				color: "text-slate-400",
				bgColor: "bg-slate-100",
				correlationType: "Inverse",
			};

		if (val > 1.8)
			return {
				label: "Restrictive",
				description: "High real yields compete with non-yielding assets.",
				impact: "Bearish",
				color: "text-rose-600",
				bgColor: "bg-rose-50",
				correlationType: "Inverse",
			};
		if (val < 0.5)
			return {
				label: "Accommodative",
				description: "Low real yields boost Bitcoin appeal.",
				impact: "Bullish",
				color: "text-emerald-600",
				bgColor: "bg-emerald-50",
				correlationType: "Inverse",
			};
		return {
			label: "Moderate",
			description: "Yields are neither stimulating nor choking risk.",
			impact: "Neutral",
			color: "text-slate-600",
			bgColor: "bg-slate-50",
			correlationType: "Inverse",
		};
	};

	const analyzeFed = (val: number | null): AnalysisResult => {
		// Fed funds context depends heavily on trend, but simplified:
		// High rates (>4.5%) are generally risk-off
		if (val === null)
			return {
				label: "--",
				description: "No Data",
				impact: "Neutral",
				color: "text-slate-400",
				bgColor: "bg-slate-100",
				correlationType: "Inverse",
			};

		if (val > 4.5)
			return {
				label: "Tight Policy",
				description: "Cost of capital is high, reducing liquidity.",
				impact: "Bearish",
				color: "text-rose-600",
				bgColor: "bg-rose-50",
				correlationType: "Inverse",
			};
		if (val < 2.5)
			return {
				label: "Loose Policy",
				description: "Cheap money fuels crypto markets.",
				impact: "Bullish",
				color: "text-emerald-600",
				bgColor: "bg-emerald-50",
				correlationType: "Inverse",
			};
		return {
			label: "Neutral",
			description: "Rates are near the neutral anchor.",
			impact: "Neutral",
			color: "text-amber-600",
			bgColor: "bg-amber-50",
			correlationType: "Inverse",
		};
	};

	const fetchData = async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/macro?t=${Date.now()}`);
			if (!res.ok) throw new Error("API Error");

			const data = await res.json();
			if (data.dxy !== null) {
				setDxy((prev) => {
					if (prev !== null && data.dxy !== prev)
						setDxyDir(data.dxy > prev ? "up" : "down");
					return data.dxy;
				});
				setUs10y(data.us10y);
				setRealRate(data.realRate);
				setImpliedFedRate(data.impliedFedRate);
				setLastUpdated(new Date());
			}

			setTimeout(() => setDxyDir(null), 1500);
		} catch (e) {
			console.error("Failed to fetch macro data", e);
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
		const timer = setInterval(fetchData, 60000); // 1 min poll
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="mb-12">
			{/* Section Header */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
				<div>
					<h2 class="text-2xl font-bold text-slate-900 tracking-tight">
						Macroeconomic Environment
					</h2>
					<p class="text-slate-500 mt-1 max-w-2xl">
						Bitcoin does not exist in a vacuum. These global metrics
						historically drive institutional liquidity flows.
					</p>
				</div>
				<button
					type="button"
					onClick={() => fetchData()}
					class="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-95"
				>
					<IconRefresh class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} />
					{loading() ? "Updating..." : "Refresh Data"}
				</button>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* 1. DXY Card */}
				<MacroCard
					title="U.S. Dollar Index (DXY)"
					icon={<IconGlobe class="w-6 h-6 text-indigo-600" />}
					value={dxy()}
					format="0.000"
					direction={dxyDir()}
					analysis={analyzeDXY(dxy())}
					loading={loading()}
				/>

				{/* 2. Real Yields Card */}
				<MacroCard
					title="Real 10Y Yields"
					icon={<IconScale class="w-6 h-6 text-indigo-600" />}
					value={realRate()}
					format="0.00"
					suffix="%"
					analysis={analyzeYields(realRate())}
					loading={loading()}
					extraContext={(() => {
						const val = us10y();
						return val ? `Nominal: ${val.toFixed(2)}%` : undefined;
					})()}
				/>

				{/* 3. Fed Rates Card */}
				<MacroCard
					title="Implied Fed Rate"
					icon={<IconBank class="w-6 h-6 text-indigo-600" />}
					value={impliedFedRate()}
					format="0.00"
					suffix="%"
					analysis={analyzeFed(impliedFedRate())}
					loading={loading()}
				/>
			</div>

			<div class="mt-4 flex justify-end">
				<span class="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
					Last Updated:{" "}
					{lastUpdated() ? lastUpdated()?.toLocaleTimeString() : "--:--"}
				</span>
			</div>
		</div>
	);
}

// --- Sub-Component for consistent card layout ---

interface MacroCardProps {
	title: string;
	icon: JSX.Element;
	value: number | null;
	format?: string;
	suffix?: string;
	direction?: "up" | "down" | null;
	analysis: AnalysisResult;
	loading: boolean;
	extraContext?: string;
}

function MacroCard(props: MacroCardProps) {
	return (
		<div class="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col h-full">
			{/* Header */}
			<div class="p-6 pb-2">
				<div class="flex justify-between items-start mb-5">
					<div class="flex items-center gap-4">
						<div class="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 shadow-xs flex items-center justify-center">
							{props.icon}
						</div>
						<div>
							<h3 class="font-bold text-slate-800 leading-tight">
								{props.title}
							</h3>
							<div class="flex items-center gap-1.5 mt-1">
								<span class="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded">
									{props.analysis.correlationType}
								</span>
								<span class="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
									Correlation
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Main Value */}
				<div class="flex items-baseline gap-2 mb-2">
					<Show
						when={!props.loading && props.value !== null}
						fallback={
							<div class="h-10 w-32 bg-slate-50 animate-pulse rounded-lg my-1" />
						}
					>
						<div
							class={`text-4xl font-black tracking-tight ${props.direction === "up" ? "text-emerald-500" : props.direction === "down" ? "text-rose-500" : "text-slate-800"}`}
						>
							{props.value?.toFixed(props.format === "0.000" ? 3 : 2)}
							{props.suffix}
						</div>
					</Show>
					<Show when={props.extraContext}>
						<span class="text-xs text-slate-400 font-mono font-bold">
							{props.extraContext}
						</span>
					</Show>
				</div>
			</div>

			{/* Divider */}
			<div class="w-full h-px bg-slate-50 mx-0"></div>

			{/* Analysis Section (Bottom Half) */}
			<div class="p-6 pt-5 bg-slate-50/50 grow flex flex-col justify-end">
				<div>
					<div class="flex justify-between items-center mb-3">
						<span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
							Macro Impact
						</span>
						<span
							class={`text-[10px] font-black px-2 py-0.5 rounded-full border ${props.analysis.bgColor} ${props.analysis.color} border-current border-opacity-20`}
						>
							{props.analysis.impact.toUpperCase()}
						</span>
					</div>

					{/* Status Bar */}
					<div class="w-full h-1.5 bg-slate-100 rounded-full mb-4 overflow-hidden shadow-xs">
						<div
							class={`h-full rounded-full transition-all duration-700 ${props.analysis.impact === "Bullish" ? "bg-emerald-500 w-full" : props.analysis.impact === "Bearish" ? "bg-rose-500 w-full" : "bg-slate-300 w-1/2 mx-auto"}`}
						></div>
					</div>

					<p class="text-xs text-slate-500 leading-relaxed font-medium">
						{props.analysis.description}
					</p>
				</div>
			</div>
		</div>
	);
}
