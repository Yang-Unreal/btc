import { Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { onMount } from "solid-js";
import AssetTable from "~/components/AssetTable";

const BTCChart = clientOnly(() => import("~/components/BTCChart"));

import MacroPyramidCalculator from "~/components/MacroPyramidCalculator";

export default function Home() {
	onMount(() => {
		if ("scrollRestoration" in history) {
			history.scrollRestoration = "manual";
		}
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	});

	return (
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 bg-[#09090b]">
			<Title>Titan Terminal | Crypto Analytics</Title>

			{/* Main Grid Layout */}
			<div class="space-y-16">
				{/* 1. Technical Analysis */}
				<section>
					<BTCChart />
				</section>

				{/* 2. Position Calculator */}
				<MacroPyramidCalculator />

				{/* 3. Market Overview */}
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
			</div>
		</div>
	);
}
