import { Title } from "@solidjs/meta";
import AssetTable from "~/components/AssetTable";
import BTCChart from "~/components/BTCChart";
import DerivativesTrigger from "~/components/DerivativesTrigger";
import FearGreed from "~/components/FearGreed";
import LiquidityEngine from "~/components/LiquidityEngine";
import OnChainTruth from "~/components/OnChainTruth";
import TitanTriggers from "~/components/TitanTriggers";

export default function Home() {
	return (
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 bg-[#09090b]">
			<Title>Titan Terminal | Crypto Analytics</Title>

			{/* Hero Section - Simplified & Functional */}
			<div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 border-b border-white/5 pb-8">
				<div>
					<h1 class="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4 leading-none uppercase">
						Market <span class="text-indigo-500">Command</span>
					</h1>
					<p class="text-sm md:text-base text-slate-400 font-medium leading-relaxed max-w-xl">
						Real-time institutional analytics, on-chain metrics, and automated
						signal detection for crypto assets.
					</p>
				</div>

				{/* Quick Status Badges */}
				<div class="flex flex-wrap gap-2">
					<div class="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
						<span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
						System Online
					</div>
					<div class="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
						BTC Dominance High
					</div>
				</div>
			</div>

			{/* Main Grid Layout */}
			<div class="space-y-24">
				{/* 1. Market Overview */}
				<section class="space-y-6">
					<div class="flex items-center gap-4">
						<div class="w-1 h-6 bg-indigo-500"></div>
						<h2 class="text-xl font-bold text-white uppercase tracking-tight">
							Market Overview
						</h2>
					</div>
					<div class="directive-card p-6 md:p-8 border border-white/5 bg-[#0b0e14]">
						<AssetTable />
					</div>
				</section>

				{/* 2. Global Liquidity (Macro) */}
				<section class="space-y-6">
					<div class="flex items-center gap-4">
						<div class="w-1 h-6 bg-indigo-500"></div>
						<h2 class="text-xl font-bold text-white uppercase tracking-tight">
							Global Liquidity Context
						</h2>
					</div>
					<div class="directive-card p-6 md:p-8 border border-white/5 bg-[#0b0e14]">
						<LiquidityEngine />
					</div>
				</section>

				{/* 3. Technical Analysis */}
				<section class="space-y-6">
					<div class="flex items-center gap-4">
						<div class="w-1 h-6 bg-indigo-500"></div>
						<h2 class="text-xl font-bold text-white uppercase tracking-tight">
							Technical Analysis
						</h2>
					</div>
					<div class="directive-card overflow-hidden border border-white/5 bg-[#0b0e14]">
						<BTCChart />
					</div>
				</section>

				{/* 4. Strategy Matrix */}
				<section class="space-y-6">
					<div class="flex items-center gap-4">
						<div class="w-1 h-6 bg-indigo-500"></div>
						<h2 class="text-xl font-bold text-white uppercase tracking-tight">
							Titan Strategy Matrix
						</h2>
					</div>
					<div class="directive-card p-6 md:p-8 border border-white/5 bg-[#0b0e14]">
						<TitanTriggers />
					</div>
				</section>

				{/* 5. Deep Data Suite (Derivatives, OnChain, Sentiment) */}
				<section class="space-y-12">
					<div class="flex items-center gap-4">
						<div class="w-1 h-6 bg-indigo-500"></div>
						<h2 class="text-xl font-bold text-white uppercase tracking-tight">
							Deep Data Analytics
						</h2>
					</div>

					<div class="space-y-12">
						{/* Derivatives */}
						<div class="directive-card p-0 overflow-hidden border border-white/5 bg-[#0b0e14]">
							<DerivativesTrigger />
						</div>

						{/* On-Chain */}
						<div class="directive-card p-0 overflow-hidden border border-white/5 bg-[#0b0e14]">
							<OnChainTruth />
						</div>

						{/* Sentiment (New Feature) */}
						<div class="directive-card p-0 overflow-hidden border border-white/5 bg-[#0b0e14]">
							<FearGreed />
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
