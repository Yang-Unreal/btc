import { Title } from "@solidjs/meta";
import type { Component } from "solid-js";
import AssetTable from "~/components/AssetTable";
import BTCChart from "~/components/BTCChart";
import DerivativesTrigger from "~/components/DerivativesTrigger";
import FuelGauge from "~/components/FuelGauge";
import LiquidityEngine from "~/components/LiquidityEngine";
import OnChainTruth from "~/components/OnChainTruth";
import PredictionRoutine from "~/components/PredictionRoutine";

// --- Custom Icons ---

const IconChart: Component<{ class?: string }> = (props) => (
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
			d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
		/>
	</svg>
);

const IconLightning: Component<{ class?: string }> = (props) => (
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
			d="M13 10V3L4 14h7v7l9-11h-7z"
		/>
	</svg>
);

const IconRadar: Component<{ class?: string }> = (props) => (
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
			d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
		/>
	</svg>
);

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
		<div class="min-h-screen flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-900 overflow-x-hidden">
			<Title>Bitcoin Insight | Institutional Analytics</Title>

			{/* Navigation Bar */}
			<nav class="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div class="flex justify-between items-center h-16">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 bg-linear-to-br from-indigo-600 via-indigo-500 to-violet-600 rounded-xl shadow-md shadow-indigo-500/20 flex items-center justify-center text-white">
								<IconTerminal class="w-5 h-5" />
							</div>
							<span class="font-bold text-xl tracking-tight text-slate-800">
								BTC<span class="text-indigo-600">Insight</span>
							</span>
						</div>

						<div class="flex gap-4 items-center">
							<div class="hidden md:flex items-center px-3.5 py-1.5 bg-emerald-50/80 text-emerald-700 rounded-full border border-emerald-200/60 text-xs font-semibold uppercase tracking-wide gap-2 shadow-sm">
								<span class="relative flex h-2 w-2">
									<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
									<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
								</span>
								Live
							</div>
						</div>
					</div>
				</div>
			</nav>

			<main class="grow">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
					{/* Hero Section */}
					<div class="text-center max-w-4xl mx-auto mb-12 relative">
						{/* Decorative background blur - more natural gradient */}
						<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[700px] h-[350px] bg-linear-to-r from-indigo-500/8 via-violet-500/6 to-blue-500/8 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

						<h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-[1.1]">
							Market Clarity in <br class="hidden sm:block" />
							<span class="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 via-violet-500 to-blue-600">
								Every Candle.
							</span>
						</h1>

						<p class="text-base md:text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto mb-8">
							Institutional-grade technical analysis. Combining real-time
							WebSocket feeds, dynamic
							<span class="font-semibold text-slate-700 mx-1">
								TD Sequential
							</span>{" "}
							indicators, and multi-frame volatility metrics.
						</p>

						<div class="flex flex-wrap justify-center gap-4 text-sm font-medium text-slate-500">
							<span class="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full shadow-xs border border-slate-200">
								<svg
									class="w-4 h-4 text-indigo-500"
									fill="currentColor"
									viewBox="0 0 20 20"
									aria-hidden="true"
								>
									<path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" />
								</svg>
								Real-time 1m-1M
							</span>
							<span class="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full shadow-xs border border-slate-200">
								<svg
									class="w-4 h-4 text-emerald-500"
									fill="currentColor"
									viewBox="0 0 20 20"
									aria-hidden="true"
								>
									<path
										fill-rule="evenodd"
										d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
										clip-rule="evenodd"
									/>
								</svg>
								Kraken Feed
							</span>
							<span class="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full shadow-xs border border-slate-200">
								<svg
									class="w-4 h-4 text-orange-500"
									fill="currentColor"
									viewBox="0 0 20 20"
									aria-hidden="true"
								>
									<path
										fill-rule="evenodd"
										d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
										clip-rule="evenodd"
									/>
								</svg>
								Smart Indicators
							</span>
						</div>
					</div>

					{/* Main Chart Component */}
					<div class="mb-10 relative z-10">
						<BTCChart />
					</div>

					{/* Dashboard Sections with smooth visual flow */}
					<div class="space-y-8">
						{/* Daily Prediction Routine - Summary at Top */}
						<section class="rounded-3xl p-6 -mx-2 sm:mx-0 bg-linear-to-br from-slate-900/2 to-slate-800/1">
							<PredictionRoutine />
						</section>

						{/* Level 1: Global Liquidity */}
						<section class="rounded-3xl p-6 -mx-2 sm:mx-0 bg-linear-to-br from-indigo-500/2 to-violet-500/1">
							<LiquidityEngine />
						</section>

						{/* Level 2: New Money Inflow */}
						<section class="rounded-3xl p-6 -mx-2 sm:mx-0 bg-linear-to-br from-emerald-500/2 to-teal-500/1">
							<FuelGauge />
						</section>

						{/* Level 3: On-Chain Truth */}
						<section class="rounded-3xl p-6 -mx-2 sm:mx-0 bg-linear-to-br from-cyan-500/2 to-blue-500/1">
							<OnChainTruth />
						</section>

						{/* Level 4: Derivatives & Sentiment */}
						<section class="rounded-3xl p-6 -mx-2 sm:mx-0 bg-linear-to-br from-rose-500/2 to-orange-500/1">
							<DerivativesTrigger />
						</section>

						{/* Asset Table Section */}
						<section class="rounded-3xl p-6 -mx-2 sm:mx-0">
							<AssetTable />
						</section>
					</div>

					{/* Feature Grid */}
					<div class="mt-16 mb-8">
						<div class="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
							{/* Feature 1 */}
							<div class="group p-7 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-lg hover:bg-white hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
								<div class="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
									<IconChart class="w-28 h-28 text-indigo-600" />
								</div>
								<div class="w-11 h-11 bg-linear-to-br from-indigo-50 to-indigo-100/50 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300 shadow-sm">
									<IconChart class="w-5 h-5 text-indigo-600" />
								</div>
								<h3 class="text-lg font-bold text-slate-900 mb-2">
									Technical Precision
								</h3>
								<p class="text-slate-500 text-sm leading-relaxed">
									Advanced charting with configurable EMA ribbons, RSI
									oscillators, and Fear & Greed indexing.
								</p>
							</div>

							{/* Feature 2 */}
							<div class="group p-7 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-lg hover:bg-white hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
								<div class="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
									<IconLightning class="w-28 h-28 text-cyan-600" />
								</div>
								<div class="w-11 h-11 bg-linear-to-br from-cyan-50 to-cyan-100/50 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300 shadow-sm">
									<IconLightning class="w-5 h-5 text-cyan-600" />
								</div>
								<h3 class="text-lg font-bold text-slate-900 mb-2">
									Live Synchronization
								</h3>
								<p class="text-slate-500 text-sm leading-relaxed">
									Direct WebSocket to Kraken for real-time price action.
									Historical data backfills seamlessly.
								</p>
							</div>

							{/* Feature 3 */}
							<div class="group p-7 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-lg hover:bg-white hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
								<div class="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
									<IconRadar class="w-28 h-28 text-emerald-600" />
								</div>
								<div class="w-11 h-11 bg-linear-to-br from-emerald-50 to-emerald-100/50 rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300 shadow-sm">
									<IconRadar class="w-5 h-5 text-emerald-600" />
								</div>
								<h3 class="text-lg font-bold text-slate-900 mb-2">
									Algorithmic Signals
								</h3>
								<p class="text-slate-500 text-sm leading-relaxed">
									TD Sequential logic identifies Setup (9) and Exhaustion (13)
									patterns for precise entries.
								</p>
							</div>
						</div>
					</div>
				</div>
			</main>

			<footer class="border-t border-slate-200/60 bg-white/60 backdrop-blur-sm">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
					<div class="flex flex-col md:flex-row justify-between items-center gap-5">
						<div class="flex items-center gap-2.5">
							<div class="w-7 h-7 bg-linear-to-br from-slate-200 to-slate-300 rounded-lg flex items-center justify-center text-slate-600 text-xs font-bold shadow-sm">
								B
							</div>
							<span class="text-slate-600 font-semibold">BTC Insight</span>
						</div>

						<p class="text-slate-400 text-sm text-center md:text-right max-w-md leading-relaxed">
							Market data by Kraken API. For educational purposes only.
						</p>
					</div>
					<div class="mt-6 pt-6 border-t border-slate-100/80 text-center text-xs text-slate-300">
						&copy; {new Date().getFullYear()} BTC Insight. All rights reserved.
					</div>
				</div>
			</footer>
		</div>
	);
}
