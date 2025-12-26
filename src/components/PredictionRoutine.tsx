import { createSignal, onCleanup, onMount, Show } from "solid-js";

// --- Types ---
interface StablecoinData {
	total: { change7d: number };
	signal: "Bullish" | "Bearish" | "Neutral";
}

interface ETFData {
	weeklyFlow: number;
	signal: "Bullish" | "Bearish" | "Neutral";
}

interface OnChainData {
	mvrv: { zScore: number; signal: string };
	exchangeBalance: { change7d: number };
}

interface DerivativesData {
	fundingRate: { avg: number };
	signal: string;
}

type OverallSignal =
	| "Bullish"
	| "Cautious Bullish"
	| "Neutral"
	| "Cautious"
	| "Bearish";

// --- Main Component ---
export default function PredictionRoutine() {
	const [stableData, setStableData] = createSignal<StablecoinData | null>(null);
	const [etfData, setEtfData] = createSignal<ETFData | null>(null);
	const [onchainData, setOnchainData] = createSignal<OnChainData | null>(null);
	const [derivData, setDerivData] = createSignal<DerivativesData | null>(null);
	const [loading, setLoading] = createSignal(true);

	const fetchAllData = async () => {
		setLoading(true);
		try {
			const [sRes, eRes, oRes, dRes] = await Promise.all([
				fetch("/api/stablecoins"),
				fetch("/api/etf-flows"),
				fetch("/api/onchain"),
				fetch("/api/derivatives"),
			]);

			if (sRes.ok) {
				const d = await sRes.json();
				if (!d.error) setStableData(d);
			}
			if (eRes.ok) {
				const d = await eRes.json();
				if (!d.error) setEtfData(d);
			}
			if (oRes.ok) {
				const d = await oRes.json();
				if (!d.error) setOnchainData(d);
			}
			if (dRes.ok) {
				const d = await dRes.json();
				if (!d.error) setDerivData(d);
			}
		} catch (e) {
			console.error("Failed to fetch prediction data:", e);
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchAllData();
		const timer = setInterval(fetchAllData, 120000);
		onCleanup(() => clearInterval(timer));
	});

	// Computed signals
	const fuelCheck = () => {
		if (!stableData())
			return { status: "neutral", label: "Loading...", icon: "⏳" };
		const data = stableData() as StablecoinData;
		const change = data.total.change7d;
		if (change > 0.3)
			return {
				status: "bullish",
				label: `USDT Rising (+${change.toFixed(1)}%)`,
				icon: "✅",
			};
		if (change < -0.3)
			return {
				status: "bearish",
				label: `USDT Falling (${change.toFixed(1)}%)`,
				icon: "❌",
			};
		return { status: "neutral", label: "USDT Stable", icon: "➖" };
	};

	const whaleCheck = () => {
		if (!etfData() || !onchainData())
			return { status: "neutral", label: "Loading...", icon: "⏳" };
		const etfDataVal = etfData() as ETFData;
		const onchainDataVal = onchainData() as OnChainData;
		const etfPositive = etfDataVal.weeklyFlow > 0;
		const exchangeDecreasing = onchainDataVal.exchangeBalance.change7d < 0;

		if (etfPositive && exchangeDecreasing) {
			return {
				status: "bullish",
				label: `ETF +$${Math.abs(etfDataVal.weeklyFlow).toFixed(0)}M | Exchange ${onchainDataVal.exchangeBalance.change7d.toFixed(1)}%`,
				icon: "✅",
			};
		}
		if (!etfPositive && !exchangeDecreasing) {
			return {
				status: "bearish",
				label: "ETF Outflows & Exchange Inflows",
				icon: "❌",
			};
		}
		return {
			status: "neutral",
			label: "Mixed Signals",
			icon: "➖",
		};
	};

	const tempCheck = () => {
		if (!derivData() || !onchainData())
			return { status: "neutral", label: "Loading...", icon: "⏳" };
		const derivDataVal = derivData() as DerivativesData;
		const onchainDataVal = onchainData() as OnChainData;
		const funding = derivDataVal.fundingRate.avg;
		const mvrv = onchainDataVal.mvrv.zScore;

		const highFunding = funding > 0.05;
		const highMvrv = mvrv > 2.5;

		if (highFunding || highMvrv) {
			return {
				status: "caution",
				label: `Funding ${(funding * 100).toFixed(2)}% | MVRV ${mvrv.toFixed(1)}`,
				icon: "⚠️",
			};
		}
		if (funding < 0 || mvrv < 1) {
			return {
				status: "bullish",
				label: "Low Heat - Room to Run",
				icon: "✅",
			};
		}
		return {
			status: "neutral",
			label: `Funding ${(funding * 100).toFixed(2)}% | MVRV ${mvrv.toFixed(1)}`,
			icon: "➖",
		};
	};

	const overallSignal = (): {
		signal: OverallSignal;
		color: string;
		bgColor: string;
	} => {
		const fuel = fuelCheck().status;
		const whale = whaleCheck().status;
		const temp = tempCheck().status;

		const bullishCount = [fuel, whale, temp].filter(
			(s) => s === "bullish",
		).length;
		const bearishCount = [fuel, whale, temp].filter(
			(s) => s === "bearish",
		).length;
		const cautionCount = [fuel, whale, temp].filter(
			(s) => s === "caution",
		).length;

		if (bullishCount >= 2 && bearishCount === 0 && cautionCount === 0) {
			return {
				signal: "Bullish",
				color: "text-emerald-700",
				bgColor: "bg-emerald-500",
			};
		}
		if (bullishCount >= 2 && cautionCount > 0) {
			return {
				signal: "Cautious Bullish",
				color: "text-amber-700",
				bgColor: "bg-amber-400",
			};
		}
		if (bearishCount >= 2) {
			return {
				signal: "Bearish",
				color: "text-rose-700",
				bgColor: "bg-rose-500",
			};
		}
		if (cautionCount >= 2 || (bearishCount >= 1 && bullishCount === 0)) {
			return {
				signal: "Cautious",
				color: "text-amber-700",
				bgColor: "bg-amber-400",
			};
		}
		return {
			signal: "Neutral",
			color: "text-slate-700",
			bgColor: "bg-slate-400",
		};
	};

	return (
		<div class="mb-10">
			<div class="bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-700">
				{/* Header */}
				<div class="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<span class="text-2xl">🎯</span>
						<div>
							<h2 class="text-lg font-bold text-white tracking-tight">
								Daily Prediction Routine
							</h2>
							<p class="text-xs text-slate-400">
								Check these 3 things every morning
							</p>
						</div>
					</div>
					<Show when={!loading()}>
						<div
							class={`px-4 py-1.5 rounded-full ${overallSignal().bgColor} text-white font-bold text-sm shadow-lg`}
						>
							{overallSignal().signal}
						</div>
					</Show>
				</div>

				{/* Checks Grid */}
				<div class="p-6">
					<Show
						when={!loading()}
						fallback={
							<div class="space-y-4">
								<div class="h-12 bg-slate-700 animate-pulse rounded-lg" />
								<div class="h-12 bg-slate-700 animate-pulse rounded-lg" />
								<div class="h-12 bg-slate-700 animate-pulse rounded-lg" />
							</div>
						}
					>
						<div class="space-y-4">
							{/* Fuel Check */}
							<div
								class={`flex items-center gap-4 p-4 rounded-xl border ${
									fuelCheck().status === "bullish"
										? "bg-emerald-500/10 border-emerald-500/30"
										: fuelCheck().status === "bearish"
											? "bg-rose-500/10 border-rose-500/30"
											: "bg-slate-700/50 border-slate-600"
								}`}
							>
								<span class="text-2xl">{fuelCheck().icon}</span>
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-0.5">
										<span class="text-xs font-bold text-slate-400 uppercase tracking-wider">
											⛽ Fuel
										</span>
									</div>
									<div class="text-sm font-semibold text-white">
										{fuelCheck().label}
									</div>
								</div>
								<div
									class={`px-3 py-1 rounded-full text-xs font-bold ${
										fuelCheck().status === "bullish"
											? "bg-emerald-500/20 text-emerald-400"
											: fuelCheck().status === "bearish"
												? "bg-rose-500/20 text-rose-400"
												: "bg-slate-600 text-slate-300"
									}`}
								>
									{fuelCheck().status === "bullish"
										? "Bullish"
										: fuelCheck().status === "bearish"
											? "Bearish"
											: "Neutral"}
								</div>
							</div>

							{/* Whales Check */}
							<div
								class={`flex items-center gap-4 p-4 rounded-xl border ${
									whaleCheck().status === "bullish"
										? "bg-emerald-500/10 border-emerald-500/30"
										: whaleCheck().status === "bearish"
											? "bg-rose-500/10 border-rose-500/30"
											: "bg-slate-700/50 border-slate-600"
								}`}
							>
								<span class="text-2xl">{whaleCheck().icon}</span>
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-0.5">
										<span class="text-xs font-bold text-slate-400 uppercase tracking-wider">
											🐋 Whales
										</span>
									</div>
									<div class="text-sm font-semibold text-white">
										{whaleCheck().label}
									</div>
								</div>
								<div
									class={`px-3 py-1 rounded-full text-xs font-bold ${
										whaleCheck().status === "bullish"
											? "bg-emerald-500/20 text-emerald-400"
											: whaleCheck().status === "bearish"
												? "bg-rose-500/20 text-rose-400"
												: "bg-slate-600 text-slate-300"
									}`}
								>
									{whaleCheck().status === "bullish"
										? "Bullish"
										: whaleCheck().status === "bearish"
											? "Bearish"
											: "Neutral"}
								</div>
							</div>

							{/* Temperature Check */}
							<div
								class={`flex items-center gap-4 p-4 rounded-xl border ${
									tempCheck().status === "bullish"
										? "bg-emerald-500/10 border-emerald-500/30"
										: tempCheck().status === "caution"
											? "bg-amber-500/10 border-amber-500/30"
											: "bg-slate-700/50 border-slate-600"
								}`}
							>
								<span class="text-2xl">{tempCheck().icon}</span>
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-0.5">
										<span class="text-xs font-bold text-slate-400 uppercase tracking-wider">
											🌡️ Temperature
										</span>
									</div>
									<div class="text-sm font-semibold text-white">
										{tempCheck().label}
									</div>
								</div>
								<div
									class={`px-3 py-1 rounded-full text-xs font-bold ${
										tempCheck().status === "bullish"
											? "bg-emerald-500/20 text-emerald-400"
											: tempCheck().status === "caution"
												? "bg-amber-500/20 text-amber-400"
												: "bg-slate-600 text-slate-300"
									}`}
								>
									{tempCheck().status === "bullish"
										? "Healthy"
										: tempCheck().status === "caution"
											? "Caution"
											: "Neutral"}
								</div>
							</div>
						</div>
					</Show>
				</div>

				{/* Golden Rule Footer */}
				<div class="px-6 py-4 bg-slate-800/50 border-t border-slate-700">
					<div class="flex items-start gap-3">
						<span class="text-lg">💡</span>
						<p class="text-xs text-slate-400 leading-relaxed">
							<strong class="text-slate-300">The Golden Rule:</strong> Liquidity
							(M2) sets the Direction. On-Chain sets the Floor. Derivatives set
							the Noise. Master these three, and you'll know the trend before
							the K-line paints it.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
