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
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24 bg-[#09090b]">
			<Title>Titan Terminal | Crypto Analytics</Title>

			{/* Hero Section */}
			<div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-24 border-b border-white/5 pb-8">
				<div>
					<h1 class="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-3 leading-tight">
						Market <span class="text-indigo-500">Command</span>
					</h1>
					<p class="text-sm md:text-base text-slate-400 font-medium leading-relaxed max-w-xl">
						Real-time institutional analytics, on-chain metrics, and automated
						signal detection.
					</p>
				</div>

				{/* Status Indicators */}
				<div class="flex items-center gap-3">
					<div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
						<div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
						<span class="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
							Online
						</span>
					</div>
					<div class="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/5 border border-indigo-500/10 rounded-full">
						<span class="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
							BTC Dominance High
						</span>
					</div>
				</div>
			</div>

			{/* Main Grid Layout */}
			<div class="space-y-32">
				{/* 1. Market Overview */}
				<section class="space-y-8">
					<div class="flex items-center gap-3">
						<div class="w-1 h-1 rounded-full bg-indigo-500"></div>
						<h2 class="text-lg font-semibold text-white tracking-tight">
							Market Overview
						</h2>
					</div>
					<div class="directive-card p-1">
						<AssetTable />
					</div>
				</section>

				{/* 2. Global Liquidity (Macro) */}
				<section class="space-y-8">
					<div class="flex items-center gap-3">
						<div class="w-1 h-1 rounded-full bg-indigo-500"></div>
						<h2 class="text-lg font-semibold text-white tracking-tight">
							Global Liquidity Context
						</h2>
					</div>
					<div class="directive-card p-1">
						<LiquidityEngine />
					</div>
				</section>

				{/* 3. Technical Analysis */}
				<section class="space-y-8">
					<div class="flex items-center gap-3">
						<div class="w-1 h-1 rounded-full bg-indigo-500"></div>
						<h2 class="text-lg font-semibold text-white tracking-tight">
							Technical Analysis
						</h2>
					</div>
					<div class="directive-card overflow-hidden">
						<BTCChart />
					</div>
				</section>

				{/* 4. Strategy Matrix */}
				<section class="space-y-8">
					<div class="flex items-center gap-3">
						<div class="w-1 h-1 rounded-full bg-indigo-500"></div>
						<h2 class="text-lg font-semibold text-white tracking-tight">
							Titan Strategy Matrix
						</h2>
					</div>
					<div class="directive-card p-1">
						<TitanTriggers />
					</div>
				</section>

				{/* 5. Deep Data Suite */}
				<section class="space-y-12">
					<div class="flex items-center gap-3">
						<div class="w-1 h-1 rounded-full bg-indigo-500"></div>
						<h2 class="text-lg font-semibold text-white tracking-tight">
							Deep Data Analytics
						</h2>
					</div>

					<div class="grid grid-cols-1 gap-12">
						{/* Derivatives */}
						<div class="directive-card overflow-hidden">
							<DerivativesTrigger />
						</div>

						{/* On-Chain */}
						<div class="directive-card overflow-hidden">
							<OnChainTruth />
						</div>

						{/* Sentiment */}
						<div class="directive-card overflow-hidden">
							<FearGreed />
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
