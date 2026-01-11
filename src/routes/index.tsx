import { Title } from "@solidjs/meta";
import AssetTable from "~/components/AssetTable";
import BTCChart from "~/components/BTCChart";
import DerivativesTrigger from "~/components/DerivativesTrigger";
import LiquidityEngine from "~/components/LiquidityEngine";
import OnChainTruth from "~/components/OnChainTruth";
import TitanTriggers from "~/components/TitanTriggers";

export default function Home() {
	return (
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
			<Title>Directive | Capital Allocation Framework</Title>

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
				{/* LEVEL 0: MARKET INTELLIGENCE */}
				<section class="space-y-6">
					<div class="flex items-center gap-4 flex-wrap">
						<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em]">
							00 Market Intel
						</span>
						<div class="h-px grow bg-white/5"></div>
					</div>
					<div class="directive-card p-6 md:p-8">
						<AssetTable />
					</div>
				</section>

				{/* LEVEL 1: MACRO FILTER */}
				<section class="space-y-6">
					<div class="flex items-center gap-4 flex-wrap">
						<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em]">
							01 Macro Engine
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
							02 Technical Ops
						</span>
						<div class="h-px grow bg-white/5"></div>
					</div>
					<div class="directive-card overflow-hidden">
						<BTCChart />
					</div>
				</section>

				{/* TITAN 9 PROTOCOL */}
				<section class="space-y-6">
					<div class="directive-card p-6 md:p-8">
						<TitanTriggers />
					</div>
				</section>

				{/* MARKET UNDERPINNINGS */}
				<section class="space-y-12">
					<div class="flex items-center gap-4 flex-wrap">
						<span class="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.4em]">
							Tactical Data Suite
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
	);
}
