import { Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { onMount } from "solid-js";

const BTCChart = clientOnly(() => import("~/components/BTCChart"));

export default function Home() {
	onMount(() => {
		if ("scrollRestoration" in history) {
			history.scrollRestoration = "manual";
		}
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	});

	return (
		<div class="w-full px-4 sm:px-6 lg:px-8 py-4 bg-[#09090b]">
			<Title>Titan Terminal | Crypto Analytics</Title>

			{/* Main Grid Layout */}
			<div class="space-y-16">
				{/* 1. Technical Analysis */}
				<section>
					<BTCChart />
				</section>
			</div>
		</div>
	);
}
