import { Title } from "@solidjs/meta";
import AssetTable from "~/components/AssetTable";
import BTCChart from "~/components/BTCChart";
import LiquidityEngine from "~/components/LiquidityEngine";

export default function Home() {
	return (
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 bg-[#09090b]">
			<Title>Titan Terminal | Crypto Analytics</Title>

			{/* Main Grid Layout */}
			<div class="space-y-16">
				{/* 1. Technical Analysis */}
				<section>
					<BTCChart />
				</section>

				{/* 2. Market Overview */}
				<section class="space-y-4">
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

				{/* 3. Global Liquidity (Macro) */}
				<section class="space-y-4">
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
			</div>
		</div>
	);
}
