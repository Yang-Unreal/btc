import { type Component, createSignal, onMount, Show } from "solid-js";

interface SentimentData {
	value: string;
	value_classification: string;
	timestamp: string;
	time_until_update: string;
}

const IconHeart: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Heart</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
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

export default function FearGreed() {
	const [data, setData] = createSignal<SentimentData | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal(false);

	const fetchData = async () => {
		setLoading(true);
		setError(false);
		try {
			const res = await fetch("/api/sentiment");
			if (res.ok) {
				const json = await res.json();
				if (json.value) {
					setData(json);
				} else {
					setError(true);
				}
			} else {
				setError(true);
			}
		} catch (e) {
			console.error("Failed to fetch sentiment:", e);
			setError(true);
		} finally {
			setLoading(false);
		}
	};

	onMount(fetchData);

	const getGaugeRotation = (value: number) => {
		// 0 to 100 mapped to -90deg to 90deg
		const limited = Math.min(100, Math.max(0, value));
		return (limited / 100) * 180 - 90;
	};

	const getColor = (value: number) => {
		if (value < 25) return "#ef4444"; // Extreme Fear (Red)
		if (value < 45) return "#f97316"; // Fear (Orange)
		if (value < 55) return "#eab308"; // Neutral (Yellow)
		if (value < 75) return "#84cc16"; // Greed (Lime)
		return "#10b981"; // Extreme Greed (Emerald)
	};

	return (
		<div class="my-8 md:my-12 w-full max-w-7xl mx-auto px-4">
			{/* Section Header */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6 border-l-4 border-purple-500 pl-6 py-2">
				<div class="min-w-0">
					<div class="flex items-center gap-3 mb-3 flex-wrap">
						<span class="text-[10px] font-mono text-purple-500 px-2 py-1 border border-purple-500/30 bg-purple-500/5">
							Market Psychology
						</span>
						<span class="font-mono text-[10px] text-slate-400 opacity-60 uppercase">
							Fear & Greed Index
						</span>
					</div>
					<h2 class="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-tight">
						Sentiment Gauge
					</h2>
					<p class="text-slate-500 mt-3 max-w-2xl text-xs sm:text-sm font-bold leading-relaxed uppercase tracking-wide">
						Analyzing <span class="text-white">Emotional bias</span>. Extreme
						fear can be a buying opportunity, while extreme greed suggests a
						correction is due.
					</p>
				</div>
				<button
					type="button"
					onClick={fetchData}
					class="flex items-center gap-3 px-5 py-2.5 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all active:scale-95 whitespace-nowrap"
				>
					<IconRefresh
						class={`w-3.5 h-3.5 ${loading() ? "animate-spin" : ""}`}
					/>
					{loading() ? "Updating..." : "Update"}
				</button>
			</div>

			{/* Main Content */}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* Gauge Card */}
				<div class="bg-[#0B1221] border border-white/10 p-8 rounded-none relative overflow-hidden flex flex-col items-center justify-center min-h-[300px]">
					<Show
						when={!loading() && data()}
						fallback={
							<div class="flex flex-col items-center gap-4 animate-pulse">
								<div class="w-40 h-20 bg-white/5 rounded-t-full"></div>
								<div class="w-32 h-8 bg-white/5 rounded"></div>
							</div>
						}
					>
						{/* Semicircle Gauge with SVG */}
						<div class="relative w-64 h-32 mb-8">
							{/* Background Track */}
							<div class="absolute inset-0 w-full h-full overflow-hidden">
								<div class="w-64 h-64 rounded-full border-[1.5rem] border-white/5 border-b-0 absolute top-0 left-0 clip-path-semicircle"></div>
							</div>

							{/* Needle */}
							<div
								class="absolute bottom-0 left-1/2 w-1 h-32 origin-bottom transition-transform duration-1000 ease-out"
								style={{
									transform: `translateX(-50%) rotate(${getGaugeRotation(parseInt(data()?.value || "50"))}deg)`,
								}}
							>
								<div class="w-1 h-full bg-slate-500 relative">
									<div
										class="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
										style={{
											"background-color": getColor(
												parseInt(data()?.value || "50"),
											),
										}}
									></div>
								</div>
							</div>

							{/* Center Hub */}
							<div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-slate-700 rounded-full border-2 border-[#0B1221] z-10" />
						</div>

						{/* Value Display */}
						<div class="text-center z-10">
							<div
								class="text-6xl font-black tracking-tighter tabular-nums mb-2"
								style={{ color: getColor(parseInt(data()?.value || "50")) }}
							>
								{data()?.value || "--"}
							</div>
							<div class="text-sm font-bold text-slate-400 uppercase tracking-widest">
								{data()?.value_classification || "Unknown"}
							</div>
						</div>

						{/* Range Labels */}
						<div class="absolute bottom-8 left-8 text-[9px] font-black text-rose-500 uppercase">
							Fear
						</div>
						<div class="absolute bottom-8 right-8 text-[9px] font-black text-emerald-500 uppercase">
							Greed
						</div>
					</Show>

					{/* Error State */}
					<Show when={error() && !loading()}>
						<div class="text-center text-rose-400 font-bold uppercase text-xs">
							Data Unavailable
						</div>
					</Show>
				</div>

				{/* Context / History Card */}
				<div class="bg-[#0B1221] border border-white/10 p-8 flex flex-col justify-center">
					<h3 class="font-black text-white uppercase tracking-tighter text-lg mb-6 flex items-center gap-3">
						<IconHeart class="w-5 h-5 text-purple-400" />
						Interpretation
					</h3>

					<div class="space-y-6">
						<div class="flex items-start gap-4 p-4 bg-white/5 border border-white/5 rounded-sm">
							<div class="w-1.5 h-1.5 mt-1.5 bg-rose-500 rounded-full shrink-0"></div>
							<div>
								<h4 class="text-xs font-bold text-white uppercase mb-1">
									Extreme Fear (0-24)
								</h4>
								<p class="text-[11px] text-slate-400 leading-relaxed">
									Investors are worried. Often a sign that investors are too
									worried, which could be a{" "}
									<span class="text-emerald-400 font-bold">
										buying opportunity
									</span>
									.
								</p>
							</div>
						</div>

						<div class="flex items-start gap-4 p-4 bg-white/5 border border-white/5 rounded-sm">
							<div class="w-1.5 h-1.5 mt-1.5 bg-emerald-500 rounded-full shrink-0"></div>
							<div>
								<h4 class="text-xs font-bold text-white uppercase mb-1">
									Extreme Greed (75-100)
								</h4>
								<p class="text-[11px] text-slate-400 leading-relaxed">
									Investors limitlessly confident. The market is due for a
									correction. Time to{" "}
									<span class="text-rose-400 font-bold">take profits</span> or
									tighten stops.
								</p>
							</div>
						</div>

						<div class="pt-4 border-t border-white/5 flex justify-between items-center">
							<span class="text-[10px] text-slate-500 uppercase font-mono">
								Update Frequency: Daily
							</span>
							<span class="text-[10px] text-slate-500 uppercase font-mono">
								Source: alternative.me
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
