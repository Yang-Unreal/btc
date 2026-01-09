import { type Component, onMount, Show } from "solid-js";
import { globalStore } from "../lib/store";

const IconTerminal: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
		/>
	</svg>
);

const GlobalNav: Component = () => {
	const { currency, setCurrency, loadSettings, loaded } = globalStore;

	onMount(() => {
		loadSettings();
	});

	return (
		<nav class="sticky top-0 z-50 bg-[#0b0e14]/80 backdrop-blur-md border-b border-white/5">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex justify-between items-center h-14">
					{/* Logo Area */}
					<div class="flex items-center gap-3">
						<a
							href="/"
							class="flex items-center gap-3 hover:opacity-80 transition-opacity"
						>
							<div class="w-8 h-8 bg-white/5 border border-white/10 flex items-center justify-center text-white">
								<IconTerminal class="w-4 h-4 text-indigo-400" />
							</div>
							<div class="flex flex-col">
								<span class="font-black text-sm tracking-tighter text-white leading-none">
									DIRECTIVE<span class="text-indigo-500">.CORE</span>
								</span>
								<span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
									Sovereign Mandate v3.1
								</span>
							</div>
						</a>
					</div>

					<div class="flex gap-4 items-center">
						{/* Global Currency Toggle */}
						<Show when={loaded()}>
							<div class="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
								<button
									type="button"
									onClick={() => setCurrency("USD")}
									class={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
										currency() === "USD"
											? "bg-indigo-600 text-white shadow-sm"
											: "text-slate-500 hover:text-slate-300"
									}`}
								>
									USD
								</button>
								<button
									type="button"
									onClick={() => setCurrency("EUR")}
									class={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
										currency() === "EUR"
											? "bg-indigo-600 text-white shadow-sm"
											: "text-slate-500 hover:text-slate-300"
									}`}
								>
									EUR
								</button>
							</div>
						</Show>

						{/* Live Indicator */}
						<div class="hidden md:flex items-center px-3 py-1 bg-white/5 text-emerald-400 border border-white/10 text-[10px] font-bold uppercase tracking-widest gap-2">
							<span class="relative flex h-1.5 w-1.5">
								<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
								<span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
							</span>
							Live Ops
						</div>
					</div>
				</div>
			</div>
		</nav>
	);
};

export default GlobalNav;
