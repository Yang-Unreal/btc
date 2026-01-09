import { A } from "@solidjs/router";
import { type Component, onMount } from "solid-js";
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
	const { currency, setCurrency, loadSettings, loadPortfolio } = globalStore;

	onMount(() => {
		loadSettings();
		loadPortfolio();
	});

	return (
		<nav class="sticky top-0 z-50 w-full bg-[#0b0e14]/90 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/20">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex justify-between items-center h-16">
					{/* Logo Area */}
					<div class="flex items-center gap-4">
						<A
							href="/"
							class="flex items-center gap-3 hover:opacity-80 transition-all duration-200"
						>
							<div class="w-10 h-10 bg-linear-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-white shadow-lg">
								<IconTerminal class="w-5 h-5 text-indigo-400" />
							</div>
							<div class="flex flex-col">
								<span class="font-black text-sm tracking-tighter text-white leading-none uppercase">
									DIRECTIVE<span class="text-indigo-400">.CORE</span>
								</span>
								<span class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
									Sovereign Mandate v3.1
								</span>
							</div>
						</A>
					</div>

					<div class="flex gap-4 items-center">
						{/* Portfolio Link */}
						<A
							href="/profile"
							class="hidden md:flex items-center gap-3 px-4 py-2 bg-linear-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-lg hover:from-indigo-600/30 hover:to-purple-600/30 transition-all duration-200"
							activeClass="bg-gradient-to-r from-indigo-600/40 to-purple-600/40 border-indigo-400/50 shadow-lg shadow-indigo-500/20"
						>
							<span class="w-3 h-3 bg-linear-to-r from-indigo-400 to-purple-400 rounded-full shadow-lg shadow-indigo-400/50" />
							<span class="text-xs font-bold text-slate-200 uppercase tracking-widest">
								Portfolio
							</span>
						</A>

						{/* Global Currency Toggle */}
						<div class="flex items-center bg-linear-to-r from-slate-800/50 to-slate-900/50 rounded-xl p-1 border border-white/10 shadow-inner">
							<button
								type="button"
								onClick={() => setCurrency("USD")}
								class={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
									currency() === "USD"
										? "bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
										: "text-slate-400 hover:text-slate-200 hover:bg-white/5"
								}`}
							>
								USD
							</button>
							<button
								type="button"
								onClick={() => setCurrency("EUR")}
								class={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
									currency() === "EUR"
										? "bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
										: "text-slate-400 hover:text-slate-200 hover:bg-white/5"
								}`}
							>
								EUR
							</button>
						</div>

						{/* Live Indicator */}
						<div class="hidden md:flex items-center px-4 py-2 bg-linear-to-r from-emerald-600/20 to-emerald-700/20 text-emerald-300 border border-emerald-500/30 rounded-lg shadow-inner text-xs font-bold uppercase tracking-widest gap-3">
							<span class="relative flex h-2.5 w-2.5">
								<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
								<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-lg shadow-emerald-500/50" />
							</span>
							<span class="text-emerald-200">Live Operations</span>
						</div>
					</div>
				</div>
			</div>
		</nav>
	);
};

export default GlobalNav;
