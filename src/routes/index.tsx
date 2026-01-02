import { Title } from "@solidjs/meta";
import type { Component } from "solid-js";
import BTCChart from "~/components/BTCChart";
import DerivativesTrigger from "~/components/DerivativesTrigger";
import LiquidityEngine from "~/components/LiquidityEngine";
import OnChainTruth from "~/components/OnChainTruth";

// --- Custom Icons ---

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

export default function Home() {
	return (
		<div class="min-h-screen flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-400 overflow-x-hidden bg-[#0b0e14]">
			<Title>Directive | Capital Allocation Framework</Title>

			{/* Navigation Bar - Sharp and Dark */}
			<nav class="sticky top-0 z-50 bg-[#0b0e14]/80 backdrop-blur-md border-b border-white/5">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div class="flex justify-between items-center h-14">
						<div class="flex items-center gap-3">
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
						</div>

						<div class="flex gap-4 items-center">
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

			<main class="grow">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
					{/* Hero Section - Serious & Stripped back */}
					<div class="max-w-4xl mb-20 relative">
						<h1 class="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-6 leading-none">
							CAPITAL ALLOCATION <br class="hidden sm:block" />
							<span class="text-indigo-500">DIRECTIVE.</span>
						</h1>

						<p class="text-sm md:text-base text-slate-400 font-medium leading-relaxed max-w-xl mb-8">
							Closed-loop framework for the management of institutional bitcoin
							risk. Filtering noise via{" "}
							<span class="text-white font-bold">Liquidity Physics</span> and{" "}
							<span class="text-white font-bold">On-chain Verification</span>.
						</p>

						<div class="flex flex-wrap gap-2">
							<span class="badge-directive text-slate-400 border-white/10">
								<span class="w-1.5 h-1.5 bg-slate-700 mr-2"></span>
								Macro Filter
							</span>
							<span class="badge-directive text-indigo-400 border-indigo-500/20">
								<span class="w-1.5 h-1.5 bg-indigo-500 mr-2"></span>
								Technical Alpha
							</span>
							<span class="badge-directive text-rose-400 border-rose-500/20">
								<span class="w-1.5 h-1.5 bg-rose-500 mr-2"></span>
								Risk Mitigation
							</span>
						</div>
					</div>

					{/* Dashboard Sections - Strict Grid */}
					<div class="space-y-24">
						{/* LEVEL 1: MACRO FILTER */}
						<section class="space-y-6">
							<div class="flex items-center gap-4 flex-wrap">
								<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em]">
									01_MACRO_ENGINE
								</span>
								<div class="h-px grow bg-white/5"></div>
							</div>
							<div class="directive-card p-6 md:p-8">
								<LiquidityEngine />
							</div>
						</section>

						{/* LEVEL 2: TECHNICAL OVERSIGHT */}
						<section class="space-y-6">
							<div class="flex items-center gap-4 flex-wrap">
								<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em]">
									02_TECHNICAL_OPS
								</span>
								<div class="h-px grow bg-white/5"></div>
							</div>
							<div class="directive-card overflow-hidden">
								<BTCChart />
							</div>
						</section>

						{/* MARKET UNDERPINNINGS */}
						<section class="space-y-12">
							<div class="flex items-center gap-4 flex-wrap">
								<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em]">
									TACTICAL_DATA_SUITE
								</span>
								<div class="h-px grow bg-white/5"></div>
							</div>

							<div class="space-y-12">
								{/* Full width for complex components death */}
								<div class="directive-card p-8">
									<DerivativesTrigger />
								</div>

								<div class="directive-card p-8">
									<OnChainTruth />
								</div>
							</div>
						</section>
					</div>
				</div>
			</main>

			<footer class="border-t border-white/5 bg-[#0b0e14]">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
					<div class="flex flex-col md:flex-row justify-between items-center gap-6">
						<div class="flex items-center gap-3">
							<div class="w-6 h-6 bg-white/5 border border-white/10 flex items-center justify-center text-white text-[10px] font-bold">
								D
							</div>
							<span class="text-slate-400 text-xs font-bold tracking-widest uppercase">
								Directive Control Center
							</span>
						</div>

						<p class="text-slate-600 text-[10px] font-bold uppercase tracking-widest text-center md:text-right max-w-sm leading-relaxed">
							Unclassified Framework. Distribution restricted to authorized
							entities.
						</p>
					</div>
					<div class="mt-8 pt-6 border-t border-white/5 text-center text-[9px] font-bold text-slate-700 tracking-[0.2em] uppercase">
						Executed at {new Date().getFullYear()} / System Stable
					</div>
				</div>
			</footer>
		</div>
	);
}
