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
		<div class="space-y-6">
			{/* Header */}
			<div class="flex items-center justify-between pb-4 border-b border-slate-100">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xl">
						🎯
					</div>
					<div>
						<h2 class="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">
							Daily Pulse
						</h2>
						<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
							Aggregate Market Bias
						</p>
					</div>
				</div>
				<Show when={!loading()}>
					<div
						class={`px-4 py-1.5 rounded-full ${overallSignal().bgColor} text-white font-black text-[10px] uppercase tracking-widest shadow-sm`}
					>
						{overallSignal().signal}
					</div>
				</Show>
			</div>

			{/* Checks List */}
			<div class="space-y-4">
				<Show
					when={!loading()}
					fallback={
						<div class="space-y-4">
							<div class="h-12 bg-slate-50 animate-pulse rounded-xl" />
							<div class="h-12 bg-slate-50 animate-pulse rounded-xl" />
						</div>
					}
				>
					{/* Fuel Check */}
					<div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
						<span class="text-2xl">{fuelCheck().icon}</span>
						<div class="flex-1">
							<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
								Liquidity Fuel
							</p>
							<p class="text-xs font-bold text-slate-800">
								{fuelCheck().label}
							</p>
						</div>
						<span
							class={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white border border-slate-100 ${
								fuelCheck().status === "bullish"
									? "text-emerald-600"
									: "text-slate-400"
							}`}
						>
							{fuelCheck().status}
						</span>
					</div>

					{/* Whale Check */}
					<div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
						<span class="text-2xl">{whaleCheck().icon}</span>
						<div class="flex-1">
							<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
								Whale Activity
							</p>
							<p class="text-xs font-bold text-slate-800">
								{whaleCheck().label}
							</p>
						</div>
						<span
							class={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white border border-slate-100 ${
								whaleCheck().status === "bullish"
									? "text-emerald-600"
									: "text-slate-400"
							}`}
						>
							{whaleCheck().status}
						</span>
					</div>

					{/* Temperature Check */}
					<div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
						<span class="text-2xl">{tempCheck().icon}</span>
						<div class="flex-1">
							<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
								Market Heat
							</p>
							<p class="text-xs font-bold text-slate-800">
								{tempCheck().label}
							</p>
						</div>
						<span
							class={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white border border-slate-100 ${
								tempCheck().status === "bullish"
									? "text-emerald-600"
									: "text-amber-600"
							}`}
						>
							{tempCheck().status}
						</span>
					</div>
				</Show>
			</div>

			{/* Analysis Logic Footer */}
			<div class="p-4 bg-slate-900 rounded-xl text-slate-400 text-[10px] leading-relaxed">
				<p class="font-bold text-slate-200 uppercase tracking-widest mb-1">
					The Logic:
				</p>
				Macro Trends set direction. On-chain sets the floor. Derivatives set the
				noise. Align daily with the highest probability trend.
			</div>
		</div>
	);
}
