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

	const getColor = (value: number) => {
		if (value < 25) return "#ef4444"; // Extreme Fear (Red)
		if (value < 45) return "#f97316"; // Fear (Orange)
		if (value < 55) return "#eab308"; // Neutral (Yellow)
		if (value < 75) return "#84cc16"; // Greed (Lime)
		return "#10b981"; // Extreme Greed (Emerald)
	};

	// SVG Gauge Logic
	const radius = 80;
	const stroke = 12;
	const normalizedValue = () => parseInt(data()?.value || "50");
	const circumference = Math.PI * radius; // Half circle
	const strokeDashoffset = () =>
		circumference - (normalizedValue() / 100) * circumference;

	return (
		<div class="w-full">
			{/* Section Header */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6 border-l-2 border-purple-500 pl-6 py-2">
				<div class="min-w-0">
					<div class="flex items-center gap-3 mb-2 flex-wrap">
						<span class="badge-directive text-purple-400 border-purple-500/30 bg-purple-500/5">
							Market Psychology
						</span>
						<span class="label-mono text-slate-500">Fear & Greed Index</span>
					</div>
					<h2 class="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
						Sentiment Gauge
					</h2>
					<p class="text-slate-500 mt-2 max-w-2xl text-sm font-medium leading-relaxed">
						An analysis of emotional bias. Extreme fear can be a buying
						opportunity, while extreme greed suggests a correction is due.
					</p>
				</div>
				<button
					type="button"
					onClick={fetchData}
					class="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white font-bold text-xs uppercase hover:bg-white/10 transition-colors rounded"
				>
					<IconRefresh
						class={`w-3.5 h-3.5 ${loading() ? "animate-spin" : ""}`}
					/>
					{loading() ? "Updating" : "Update"}
				</button>
			</div>

			{/* Main Content */}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
				{/* Gauge Card */}
				<div class="bg-[#0B1221] p-8 flex flex-col items-center justify-center min-h-[320px] relative">
					<Show
						when={!loading() && data()}
						fallback={
							<div class="flex flex-col items-center gap-4 animate-pulse">
								<div class="w-40 h-20 bg-white/5 rounded-t-full"></div>
								<div class="w-24 h-6 bg-white/5 rounded"></div>
							</div>
						}
					>
						{/* SVG Gauge */}
						<div class="relative w-64 h-32 mb-8">
							<svg class="w-full h-full overflow-visible" viewBox="0 0 200 110">
								<title>Fear & Greed Index Gauge</title>
								{/* Track */}
								<path
									d="M 20 100 A 80 80 0 0 1 180 100"
									fill="none"
									stroke="rgba(255,255,255,0.05)"
									stroke-width={stroke}
									stroke-linecap="round"
								/>
								{/* Fill */}
								<path
									d="M 20 100 A 80 80 0 0 1 180 100"
									fill="none"
									stroke={getColor(normalizedValue())}
									stroke-width={stroke}
									stroke-linecap="round"
									stroke-dasharray={circumference.toString()}
									stroke-dashoffset={strokeDashoffset().toString()}
									class="transition-all duration-1000 ease-out"
								/>
							</svg>

							{/* Value Center - Positioned absolutely relative to the container */}
							<div class="absolute bottom-0 left-0 right-0 text-center transform translate-y-4">
								<div
									class="text-6xl font-bold tracking-tighter tabular-nums leading-none"
									style={{ color: getColor(normalizedValue()) }}
								>
									{data()?.value || "--"}
								</div>
								<div class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
									{data()?.value_classification || "Unknown"}
								</div>
							</div>
						</div>

						{/* Range Labels */}
						<div class="w-full flex justify-between px-10 mt-4">
							<span class="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
								Fear
							</span>
							<span class="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
								Greed
							</span>
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
				<div class="bg-[#0B1221] p-8 flex flex-col justify-center">
					<h3 class="font-bold text-white text-lg mb-6 flex items-center gap-3">
						<IconHeart class="w-5 h-5 text-purple-400" />
						Interpretation
					</h3>

					<div class="space-y-4">
						<div class="flex items-start gap-4 p-4 rounded-lg bg-white/2 border border-white/5">
							<div class="w-2 h-2 mt-1.5 bg-rose-500 rounded-full shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div>
							<div>
								<h4 class="text-xs font-bold text-white uppercase mb-1">
									Extreme Fear (0-24)
								</h4>
								<p class="text-sm text-slate-400 leading-relaxed font-medium">
									Market participants are anxious. Historically, this condition
									presents a high-probability{" "}
									<span class="text-emerald-400">Accumulation Zone</span>.
								</p>
							</div>
						</div>

						<div class="flex items-start gap-4 p-4 rounded-lg bg-white/2 border border-white/5">
							<div class="w-2 h-2 mt-1.5 bg-emerald-500 rounded-full shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
							<div>
								<h4 class="text-xs font-bold text-white uppercase mb-1">
									Extreme Greed (75-100)
								</h4>
								<p class="text-sm text-slate-400 leading-relaxed font-medium">
									FOMO is driving price action. The likelihood of a severe
									correction or liquidation cascade is{" "}
									<span class="text-rose-400">Critical</span>.
								</p>
							</div>
						</div>

						<div class="pt-6 mt-2 border-t border-white/5 flex justify-between items-center opacity-50">
							<span class="label-mono text-slate-500 text-[10px]">
								Frequency: Daily
							</span>
							<span class="label-mono text-slate-500 text-[10px]">
								Source: alternative.me
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
