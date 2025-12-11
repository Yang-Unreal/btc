import { createSignal, onCleanup, onMount, Show } from "solid-js";

// Icons
const IconBank = (props: { class?: string }) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Bank Icon</title>
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
		<title>Scale Icon</title>
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
		<title>Globe Icon</title>
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
		<title>Refresh Icon</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
		/>
	</svg>
);

export default function MacroData() {
	const [dxy, setDxy] = createSignal<number | null>(null);
	const [us10y, setUs10y] = createSignal<number | null>(null);
	const [realRate, setRealRate] = createSignal<number | null>(null);
	const [impliedFedRate, setImpliedFedRate] = createSignal<number | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal(false);

	// Directions for UI flash
	const [dxyDir, setDxyDir] = createSignal<"up" | "down" | null>(null);
	const [yieldDir, setYieldDir] = createSignal<"up" | "down" | null>(null);

	const fetchData = async () => {
		setLoading(true);
		try {
			// Add cache buster to prevent caching of old 0 values
			const res = await fetch(`/api/macro?t=${Date.now()}`);
			if (!res.ok) throw new Error("API Error");

			const data = await res.json();

			if (data.dxy === null) {
				setError(true);
			} else {
				setError(false);
				// Update logic with direction detection
				setDxy((prev) => {
					if (prev !== null && data.dxy !== prev)
						setDxyDir(data.dxy > prev ? "up" : "down");
					return data.dxy;
				});

				setUs10y((prev) => {
					if (prev !== null && data.us10y !== prev)
						setYieldDir(data.us10y > prev ? "up" : "down");
					return data.us10y;
				});

				setRealRate(data.realRate);
				setImpliedFedRate(data.impliedFedRate);
			}

			// Reset flashes
			setTimeout(() => {
				setDxyDir(null);
				setYieldDir(null);
			}, 1500);
		} catch (e) {
			console.error("Failed to fetch macro data", e);
			setError(true);
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
		// Poll every 30s to be safe with rate limits
		const timer = setInterval(fetchData, 30000);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
			{/* 1. Fed Policy Card */}
			<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
				<div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
					<IconBank class="w-24 h-24 text-indigo-600" />
				</div>

				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
						<IconBank class="w-5 h-5" />
					</div>
					<h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider">
						Fed Implied Rate
					</h3>
				</div>

				<div class="flex flex-col gap-1">
					<Show
						when={!loading() && !error()}
						fallback={
							<div class="h-9 w-32 bg-slate-100 animate-pulse rounded my-1"></div>
						}
					>
						<div class="text-3xl font-bold text-slate-900 tracking-tight">
							{impliedFedRate()?.toFixed(2)}%
						</div>
					</Show>
					<Show when={error()}>
						<span class="text-sm text-rose-500 font-medium">
							Data Unavailable
						</span>
					</Show>
					<div class="flex items-center gap-2 text-xs font-medium text-slate-500">
						Market pricing via 30D Futures
					</div>
				</div>

				<div class="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
					<div>
						<div class="text-[10px] text-slate-400 uppercase font-bold mb-0.5">
							Structure
						</div>
						<div class="text-sm font-semibold text-slate-700">Inverted</div>
					</div>
					<div>
						<div class="text-[10px] text-slate-400 uppercase font-bold mb-0.5">
							Sentiment
						</div>
						<div class="text-sm font-semibold text-slate-700 flex items-center gap-1">
							<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Dovish
						</div>
					</div>
				</div>
			</div>

			{/* 2. Real Rates Card */}
			<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
				<div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
					<IconScale class="w-24 h-24 text-cyan-600" />
				</div>

				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600">
						<IconScale class="w-5 h-5" />
					</div>
					<h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider">
						Real Yields (10Y)
					</h3>
				</div>

				<div class="flex flex-col gap-1">
					<Show
						when={!loading() && !error()}
						fallback={
							<div class="h-9 w-32 bg-slate-100 animate-pulse rounded my-1"></div>
						}
					>
						<div
							class={`text-3xl font-bold tracking-tight transition-colors duration-500 ${yieldDir() === "up" ? "text-emerald-500" : yieldDir() === "down" ? "text-rose-500" : "text-slate-900"}`}
						>
							{realRate()?.toFixed(2)}%
						</div>
					</Show>
					<Show when={error()}>
						<span class="text-sm text-rose-500 font-medium">--</span>
					</Show>
					<div class="text-xs text-slate-500">
						<Show when={!loading() && us10y() !== null}>
							Nominal 10Y ({us10y()?.toFixed(2)}%) - 2.5% CPI
						</Show>
					</div>
				</div>

				<div class="mt-6 pt-4 border-t border-slate-100">
					<div class="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden">
						<div
							class="bg-linear-to-r from-cyan-400 to-blue-500 h-1.5 rounded-full transition-all duration-1000"
							style={{
								width: `${Math.min(Math.max(((realRate() || 0) / 3) * 100, 0), 100)}%`,
							}}
						></div>
					</div>
					<div class="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
						<span>Loose (&lt;0.5%)</span>
						<span>Tight (&gt;2.0%)</span>
					</div>
				</div>
			</div>

			{/* 3. DXY Card */}
			<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
				<div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
					<IconGlobe class="w-24 h-24 text-emerald-600" />
				</div>

				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
						<IconGlobe class="w-5 h-5" />
					</div>
					<h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider">
						DXY Index
					</h3>
				</div>

				<div class="flex flex-col gap-1">
					<Show
						when={!loading() && !error()}
						fallback={
							<div class="h-9 w-32 bg-slate-100 animate-pulse rounded my-1"></div>
						}
					>
						<div
							class={`text-3xl font-bold tracking-tight transition-colors duration-500 ${dxyDir() === "up" ? "text-emerald-500" : dxyDir() === "down" ? "text-rose-500" : "text-slate-900"}`}
						>
							{dxy()?.toFixed(3)}
						</div>
					</Show>
					<Show when={error()}>
						<span class="text-sm text-rose-500 font-medium">
							Check Connection
						</span>
					</Show>
					<div class="flex items-center gap-1 text-xs font-medium text-slate-500">
						<span
							class={`font-bold ${dxyDir() === "up" ? "text-emerald-500" : dxyDir() === "down" ? "text-rose-500" : "text-slate-400"}`}
						>
							{dxyDir() === "up" ? "▲" : dxyDir() === "down" ? "▼" : "•"}
						</span>
						Global USD Strength
					</div>
				</div>

				<div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
					<div class="text-xs text-slate-500 flex items-center gap-1">
						<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
						Real-Time Data
					</div>
					<button
						type="button"
						onClick={() => fetchData()}
						class="text-slate-400 hover:text-indigo-600 transition-colors"
						title="Refresh Data"
					>
						<IconRefresh
							class={`w-4 h-4 ${loading() ? "animate-spin text-indigo-600" : ""}`}
						/>
					</button>
				</div>
			</div>
		</div>
	);
}
