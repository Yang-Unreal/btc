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
		<div class="min-h-screen flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-900 bg-[#f8fafc] overflow-x-hidden">
			<Title>Bitcoin Insight | Institutional Analytics</Title>

			{/* Navigation Bar */}
			<nav class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div class="flex justify-between items-center h-16">
						<div class="flex items-center gap-2.5">
							<div class="w-9 h-9 bg-linear-to-br from-indigo-600 to-violet-600 rounded-lg shadow-sm flex items-center justify-center text-white">
								<IconTerminal class="w-5 h-5" />
							</div>
							<span class="font-bold text-xl tracking-tight text-slate-800">
								BTC<span class="text-indigo-600">Insight</span>
							</span>
						</div>

						<div class="flex gap-4 items-center">
							<div class="hidden md:flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-xs font-semibold uppercase tracking-wide gap-2">
								<span class="relative flex h-2 w-2">
									<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
									<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
								</span>
								System Operational
							</div>
						</div>
					</div>
				</div>
			</nav>

			<main class="grow">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
					{/* Hero Section */}
					<div class="text-center max-w-4xl mx-auto mb-16 relative">
						{/* Decorative background blur */}
						<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>

						<h1 class="text-5xl sm:text-6xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 leading-[1.1]">
							Market Clarity in <br class="hidden sm:block" />
							<span class="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 via-violet-600 to-blue-500">
								Every Candle.
							</span>
						</h1>

						<p class="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10">
							Institutional-grade technical analysis. Combining real-time
							WebSocket feeds, dynamic
							<span class="font-semibold text-slate-800 mx-1">
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
					<div class="mb-12 relative z-10">
						<BTCChart />
					</div>

					{/* Daily Prediction Routine - Summary at Top */}
					<PredictionRoutine />

					{/* Level 1: Global Liquidity */}
					<LiquidityEngine />

					{/* Level 2: New Money Inflow */}
					<FuelGauge />

					{/* Level 3: On-Chain Truth */}
					<OnChainTruth />

					{/* Level 4: Derivatives & Sentiment */}
					<DerivativesTrigger />

					{/* Asset Table Section */}
					<AssetTable />

					{/* Feature Grid */}
					<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
						{/* Feature 1 */}
						<div class="group p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
							<div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
								<IconChart class="w-32 h-32 text-indigo-600" />
							</div>
							<div class="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
								<IconChart class="w-6 h-6 text-indigo-600" />
							</div>
							<h3 class="text-xl font-bold text-slate-900 mb-3">
								Technical Precision
							</h3>
							<p class="text-slate-500 text-sm leading-relaxed">
								Advanced charting engine featuring configurable EMA ribbons
								(20-200), RSI oscillators, and Fear & Greed indexing to pinpoint
								trend reversals.
							</p>
						</div>

						{/* Feature 2 */}
						<div class="group p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
							<div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
								<IconLightning class="w-32 h-32 text-cyan-600" />
							</div>
							<div class="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
								<IconLightning class="w-6 h-6 text-cyan-600" />
							</div>
							<h3 class="text-xl font-bold text-slate-900 mb-3">
								Live Synchronization
							</h3>
							<p class="text-slate-500 text-sm leading-relaxed">
								Direct WebSocket connection to Kraken ensures you see price
								action as it happens. Historical data backfills seamlessly for
								deep analysis.
							</p>
						</div>

						{/* Feature 3 */}
						<div class="group p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
							<div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
								<IconRadar class="w-32 h-32 text-emerald-600" />
							</div>
							<div class="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
								<IconRadar class="w-6 h-6 text-emerald-600" />
							</div>
							<h3 class="text-xl font-bold text-slate-900 mb-3">
								Algorithmic Signals
							</h3>
							<p class="text-slate-500 text-sm leading-relaxed">
								Built-in TD Sequential logic automatically identifies Setup (9)
								and Exhaustion (13) patterns, giving you institutional-grade
								entry and exit signals.
							</p>
						</div>
					</div>
				</div>
			</main>

			<footer class="border-t border-slate-200 bg-white">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
					<div class="flex flex-col md:flex-row justify-between items-center gap-6">
						<div class="flex items-center gap-2">
							<div class="w-6 h-6 bg-slate-200 rounded-md flex items-center justify-center text-slate-500 text-xs font-bold">
								B
							</div>
							<span class="text-slate-600 font-semibold">BTC Insight</span>
						</div>

						<p class="text-slate-400 text-sm text-center md:text-right max-w-md">
							Market data provided by Kraken API. This dashboard is for
							educational purposes only and does not constitute financial
							advice.
						</p>
					</div>
					<div class="mt-8 pt-8 border-t border-slate-100 text-center text-xs text-slate-300">
						&copy; {new Date().getFullYear()} BTC Insight Analysis Dashboard.
						All rights reserved.
					</div>
				</div>
			</footer>
		</div>
	);
}
