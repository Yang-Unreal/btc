import { Title } from "@solidjs/meta";
import type { Component } from "solid-js";
import AssetTable from "~/components/AssetTable";
import BTCChart from "~/components/BTCChart";
import DerivativesTrigger from "~/components/DerivativesTrigger";
import ExecutionChecklist from "~/components/ExecutionChecklist";
import FuelGauge from "~/components/FuelGauge";
import LiquidityEngine from "~/components/LiquidityEngine";
import MentalModels from "~/components/MentalModels";
import OnChainTruth from "~/components/OnChainTruth";
import PredictionRoutine from "~/components/PredictionRoutine";
import SurvivalProtocols from "~/components/SurvivalProtocols";

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
		<div class="min-h-screen flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-900 overflow-x-hidden bg-slate-50">
			<Title>
				Capital Allocation Directive | Institutional Bitcoin Strategy
			</Title>

			{/* Navigation Bar */}
			<nav class="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div class="flex justify-between items-center h-16">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 bg-slate-900 rounded-xl shadow-lg flex items-center justify-center text-white">
								<IconTerminal class="w-5 h-5" />
							</div>
							<div class="flex flex-col">
								<span class="font-black text-lg tracking-tighter text-slate-900 leading-none">
									CAPITAL<span class="text-indigo-600">ALLOCATION</span>
								</span>
								<span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
									Directive v2.0
								</span>
							</div>
						</div>

						<div class="flex gap-4 items-center">
							<div class="hidden md:flex items-center px-3.5 py-1.5 bg-emerald-50/80 text-emerald-700 rounded-full border border-emerald-200/60 text-xs font-semibold uppercase tracking-wide gap-2 shadow-sm">
								<span class="relative flex h-2 w-2">
									<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
									<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
								</span>
								Live Market Data
							</div>
						</div>
					</div>
				</div>
			</nav>

			<main class="grow">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
					{/* Hero Section */}
					<div class="text-center max-w-4xl mx-auto mb-16 relative">
						<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[700px] h-[350px] bg-linear-to-r from-slate-200/20 via-indigo-50/10 to-slate-200/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

						<h1 class="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-6 leading-[1.1]">
							Strategic <br class="hidden sm:block" />
							<span class="text-transparent bg-clip-text bg-linear-to-r from-slate-900 to-slate-700">
								Bitcoin Mandate.
							</span>
						</h1>

						<p class="text-base md:text-lg text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto mb-8">
							A top-down allocation framework for sovereign and institutional
							capital. Filtering volatility via{" "}
							<span class="text-slate-800 font-bold">Macro-Liquidity</span>,
							<span class="text-slate-800 font-bold">Technical Precision</span>,
							and
							<span class="text-slate-800 font-bold">Survival Protocols</span>.
						</p>

						<div class="flex flex-wrap justify-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
							<span class="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200">
								<span class="w-2 h-2 rounded-full bg-slate-900"></span>
								Macro Filter
							</span>
							<span class="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200">
								<span class="w-2 h-2 rounded-full bg-indigo-500"></span>
								Technical Oversight
							</span>
							<span class="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200">
								<span class="w-2 h-2 rounded-full bg-rose-500"></span>
								Strategic Allocation
							</span>
						</div>
					</div>

					{/* Dashboard Sections with clean visual separation */}
					<div class="space-y-20">
						{/* LEVEL 1: MACRO FILTER */}
						<section class="space-y-8">
							<div class="flex items-center gap-4">
								<div class="h-px grow bg-slate-200"></div>
								<span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
									Logic Level 01: Macro Filter
								</span>
								<div class="h-px grow bg-slate-200"></div>
							</div>
							<div class="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
								<LiquidityEngine />
							</div>
						</section>

						{/* LEVEL 2: TECHNICAL OVERSIGHT */}
						<section class="space-y-8">
							<div class="flex items-center gap-4">
								<div class="h-px grow bg-slate-200"></div>
								<span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
									Logic Level 02: Technical Oversight
								</span>
								<div class="h-px grow bg-slate-200"></div>
							</div>
							<div class="relative z-10 transition-all hover:scale-[1.005]">
								<BTCChart />
							</div>
						</section>

						{/* LEVEL 3: STRATEGIC ALLOCATION */}
						<section class="space-y-8">
							<div class="flex items-center gap-4">
								<div class="h-px grow bg-slate-200"></div>
								<span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
									Logic Level 03: Strategic Allocation
								</span>
								<div class="h-px grow bg-slate-200"></div>
							</div>

							<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
								<div class="lg:col-span-8 space-y-8">
									<SurvivalProtocols />
									<MentalModels />
								</div>
								<div class="lg:col-span-4">
									<ExecutionChecklist />
								</div>
							</div>
						</section>

						{/* MARKET UNDERPINNINGS */}
						<section class="space-y-12">
							<div class="flex items-center gap-4">
								<div class="h-px grow bg-slate-200"></div>
								<span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
									Tactical Underpinnings
								</span>
								<div class="h-px grow bg-slate-200"></div>
							</div>

							<div class="space-y-16">
								{/* Grid for simpler components */}
								<div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
									<div class="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm transition-all hover:shadow-md">
										<FuelGauge />
									</div>
									<div class="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm transition-all hover:shadow-md">
										<PredictionRoutine />
									</div>
								</div>

								{/* Full width for complex components */}
								<div class="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm transition-all hover:shadow-md">
									<DerivativesTrigger />
								</div>

								<div class="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm transition-all hover:shadow-md">
									<OnChainTruth />
								</div>
							</div>
						</section>

						{/* Asset Table Section */}
						<section class="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
							<h3 class="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8">
								Ecosystem Benchmarking
							</h3>
							<AssetTable />
						</section>
					</div>
				</div>
			</main>

			<footer class="border-t border-slate-200/60 bg-white/60 backdrop-blur-sm">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
					<div class="flex flex-col md:flex-row justify-between items-center gap-5">
						<div class="flex items-center gap-2.5">
							<div class="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm">
								C
							</div>
							<span class="text-slate-600 font-bold tracking-tight">
								Capital Allocation Directive
							</span>
						</div>

						<p class="text-slate-400 text-sm text-center md:text-right max-w-md leading-relaxed">
							Market data by Public APIs. Institutional framework v2.0.
							Educational purposes only.
						</p>
					</div>
					<div class="mt-6 pt-6 border-t border-slate-100/80 text-center text-xs text-slate-300">
						&copy; {new Date().getFullYear()} Capital Allocation Directive.
					</div>
				</div>
			</footer>
		</div>
	);
}
