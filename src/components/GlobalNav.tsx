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
	const { loadSettings, loadPortfolio, loaded } = globalStore;

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
								<span class="hidden sm:block font-black text-sm tracking-tighter text-white leading-none uppercase">
									Homepage
								</span>
							</div>
						</A>
					</div>

					<div class="flex gap-2 sm:gap-4 items-center">
						{/* Trade Link */}
						<A
							href="/trade"
							class="flex items-center gap-2 px-3 py-2 bg-linear-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 rounded-lg hover:from-emerald-600/30 hover:to-teal-600/30 transition-all duration-200"
							activeClass="bg-gradient-to-r from-emerald-600/40 to-teal-600/40 border-emerald-400/50 shadow-lg shadow-emerald-500/20"
						>
							<span class="w-2 h-2 sm:w-3 sm:h-3 bg-linear-to-r from-emerald-400 to-teal-400 rounded-full shadow-lg shadow-emerald-400/50" />
							<span class="text-[10px] sm:text-xs font-bold text-slate-200 uppercase tracking-widest leading-none">
								Trade
							</span>
						</A>

						{/* Portfolio Link */}
						<A
							href="/profile"
							class="flex items-center gap-2 px-3 py-2 bg-linear-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-lg hover:from-indigo-600/30 hover:to-purple-600/30 transition-all duration-200"
							activeClass="bg-gradient-to-r from-indigo-600/40 to-purple-600/40 border-indigo-400/50 shadow-lg shadow-indigo-500/20"
						>
							<span class="w-2 h-2 sm:w-3 sm:h-3 bg-linear-to-r from-indigo-400 to-purple-400 rounded-full shadow-lg shadow-indigo-400/50" />
							<span class="text-[10px] sm:text-xs font-bold text-slate-200 uppercase tracking-widest leading-none">
								Portfolio
							</span>
						</A>

					</div>
				</div>
			</div>
		</nav>
	);
};

export default GlobalNav;
