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

	const overallSignalValue = (): {
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

	const overallSignalData = () => {
		const data = overallSignalValue();
		switch (data.signal) {
			case "Bullish":
				return {
					status: "ACCUMULATE",
					color: "text-emerald-400",
					border: "border-emerald-500/20",
					bg: "bg-emerald-500/10",
				};
			case "Cautious Bullish":
				return {
					status: "MONITOR_POS",
					color: "text-amber-400",
					border: "border-amber-500/20",
					bg: "bg-amber-500/10",
				};
			case "Bearish":
				return {
					status: "DE-RISK",
					color: "text-rose-400",
					border: "border-rose-500/20",
					bg: "bg-rose-500/10",
				};
			case "Cautious":
				return {
					status: "RESTRICTED",
					color: "text-amber-400",
					border: "border-amber-500/20",
					bg: "bg-amber-500/10",
				};
			default:
				return {
					status: "NEUTRAL",
					color: "text-slate-400",
					border: "border-white/10",
					bg: "bg-white/5",
				};
		}
	};

	return (
		<div class="h-full flex flex-col">
			{/* Header */}
			<div class="flex items-center justify-between pb-6 border-b border-white/5 mb-8">
				<div class="flex items-center gap-4">
					<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-white text-lg">
						<span class="font-black">P</span>
					</div>
					<div>
						<h2 class="text-2xl font-black text-white tracking-tighter uppercase leading-none mb-1">
							Daily Pulse
						</h2>
						<p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">
							Aggregated_Operational_Bias
						</p>
					</div>
				</div>
				<Show when={!loading()}>
					<div
						class={`px-4 py-2 border font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(0,0,0,0.5)] ${overallSignalData().color} ${overallSignalData().border} ${overallSignalData().bg}`}
					>
						{overallSignalData().status}
					</div>
				</Show>
			</div>

			{/* Checks List */}
			<div class="grow space-y-2">
				<Show
					when={!loading()}
					fallback={
						<div class="space-y-2">
							<div class="h-14 bg-white/2 animate-pulse" />
							<div class="h-14 bg-white/2 animate-pulse" />
							<div class="h-14 bg-white/2 animate-pulse" />
						</div>
					}
				>
					{/* Fuel Check */}
					<div class="flex items-center gap-5 p-5 bg-white/2 border border-white/5 group hover:border-white/10 transition-all">
						<div
							class={`w-1.5 h-10 shrink-0 ${fuelCheck().status === "bullish" ? "bg-emerald-500" : fuelCheck().status === "bearish" ? "bg-rose-500" : "bg-slate-700"}`}
						></div>
						<div class="flex-1">
							<p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
								Liquidity_Filter
							</p>
							<p class="text-[11px] font-bold text-white uppercase tracking-tight">
								{fuelCheck().label}
							</p>
						</div>
						<span
							class={`label-mono text-[9px] px-2 py-1 border whitespace-nowrap ${
								fuelCheck().status === "bullish"
									? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5 font-black"
									: "text-slate-500 border-white/5 bg-white/2"
							}`}
						>
							{"//"} {fuelCheck().status.toUpperCase()}
						</span>
					</div>

					{/* Whale Check */}
					<div class="flex items-center gap-5 p-5 bg-white/2 border border-white/5 group hover:border-white/10 transition-all">
						<div
							class={`w-1.5 h-10 shrink-0 ${whaleCheck().status === "bullish" ? "bg-emerald-500" : whaleCheck().status === "bearish" ? "bg-rose-500" : "bg-slate-700"}`}
						></div>
						<div class="flex-1">
							<p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
								Structural_Inflows
							</p>
							<p class="text-[11px] font-bold text-white uppercase tracking-tight">
								{whaleCheck().label}
							</p>
						</div>
						<span
							class={`label-mono text-[9px] px-2 py-1 border whitespace-nowrap ${
								whaleCheck().status === "bullish"
									? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5 font-black"
									: "text-slate-500 border-white/5 bg-white/2"
							}`}
						>
							{"//"} {whaleCheck().status.toUpperCase()}
						</span>
					</div>

					{/* Temperature Check */}
					<div class="flex items-center gap-5 p-5 bg-white/2 border border-white/5 group hover:border-white/10 transition-all">
						<div
							class={`w-1.5 h-10 shrink-0 ${tempCheck().status === "bullish" ? "bg-emerald-500" : tempCheck().status === "caution" ? "bg-amber-500" : "bg-slate-700"}`}
						></div>
						<div class="flex-1">
							<p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
								Market_Heat_Index
							</p>
							<p class="text-[11px] font-bold text-white uppercase tracking-tight">
								{tempCheck().label}
							</p>
						</div>
						<span
							class={`label-mono text-[9px] px-2 py-1 border whitespace-nowrap ${
								tempCheck().status === "bullish"
									? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5 font-black"
									: tempCheck().status === "caution"
										? "text-amber-400 border-amber-500/20 bg-amber-500/5"
										: "text-slate-500 border-white/5 bg-white/2"
							}`}
						>
							{"//"} {tempCheck().status.toUpperCase()}
						</span>
					</div>
				</Show>
			</div>

			{/* Analysis Logic Footer */}
			<div class="mt-8 p-6 bg-slate-900 border border-white/5 text-slate-400 text-[10px] leading-relaxed uppercase font-bold tracking-tight">
				<p class="text-white font-black mb-2 tracking-widest">
					KERNEL_LOGIC_SEQUENCE:
				</p>
				Macro trends set global direction. On-chain delta defines the structural
				floor. High-frequency derivatives constitute atmospheric noise. Align
				execution with the statistically dominant aggregate trend.
			</div>
		</div>
	);
}
