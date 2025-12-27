import { createSignal } from "solid-js";

export default function SurvivalProtocols() {
	const [balance, setBalance] = createSignal(10000);
	const [riskPercent, setRiskPercent] = createSignal(1); // Default 1%
	const [entryPrice, setEntryPrice] = createSignal(50000);
	const [stopLoss, setStopLoss] = createSignal(48000);

	const riskAmount = () => (balance() * riskPercent()) / 100;
	const priceRiskPercent = () =>
		Math.abs((entryPrice() - stopLoss()) / entryPrice()) * 100;
	const positionSize = () => {
		const risk = riskAmount();
		const drop = Math.abs(entryPrice() - stopLoss());
		if (drop === 0) return 0;
		return risk / drop;
	};
	const notionalValue = () => positionSize() * entryPrice();
	const leverageNeeded = () => notionalValue() / balance();

	return (
		<div class="p-6 bg-white border border-slate-200 rounded-2xl shadow-xl font-sans ring-1 ring-slate-100">
			<div class="flex items-center gap-3 mb-6">
				<div class="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center text-white">
					<svg
						class="w-6 h-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<title>Shield Icon</title>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
				<div>
					<h2 class="text-xl font-bold text-slate-900 tracking-tight">
						Survival Protocols
					</h2>
					<p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
						Risk Management & Position Sizing
					</p>
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
				{/* Calculator Section */}
				<div class="space-y-6">
					<div class="space-y-4">
						<div>
							<label
								for="balance"
								class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
							>
								Account Balance ($)
							</label>
							<input
								id="balance"
								type="number"
								value={balance()}
								onInput={(e) => setBalance(Number(e.currentTarget.value))}
								class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
							/>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label
									for="risk-percent"
									class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
								>
									Risk Per Trade (%)
								</label>
								<input
									id="risk-percent"
									type="number"
									value={riskPercent()}
									onInput={(e) => setRiskPercent(Number(e.currentTarget.value))}
									class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
								/>
							</div>
							<div>
								<span class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
									Risk Amount ($)
								</span>
								<div class="w-full px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl font-mono font-bold text-rose-600">
									$
									{riskAmount().toLocaleString(undefined, {
										minimumFractionDigits: 2,
									})}
								</div>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label
									for="entry-price"
									class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
								>
									Entry Price
								</label>
								<input
									id="entry-price"
									type="number"
									value={entryPrice()}
									onInput={(e) => setEntryPrice(Number(e.currentTarget.value))}
									class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
								/>
							</div>
							<div>
								<label
									for="stop-loss"
									class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
								>
									Stop Loss
								</label>
								<input
									id="stop-loss"
									type="number"
									value={stopLoss()}
									onInput={(e) => setStopLoss(Number(e.currentTarget.value))}
									class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Results Section */}
				<div class="bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between">
					<div class="space-y-6">
						<div>
							<p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
								Recommended Position Size
							</p>
							<div class="text-3xl font-mono font-black text-rose-400">
								{positionSize().toFixed(4)} <span class="text-lg">BTC</span>
							</div>
							<p class="text-xs text-slate-500 font-bold mt-1">
								Notional Value: $
								{notionalValue().toLocaleString(undefined, {
									maximumFractionDigits: 0,
								})}
							</p>
						</div>

						<div class="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
							<div>
								<p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
									Leverage
								</p>
								<div
									class={`text-xl font-mono font-bold ${leverageNeeded() > 3 ? "text-amber-400" : "text-emerald-400"}`}
								>
									{leverageNeeded().toFixed(2)}x
								</div>
							</div>
							<div>
								<p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
									Price Drop (SL)
								</p>
								<div class="text-xl font-mono font-bold text-slate-300">
									{priceRiskPercent().toFixed(2)}%
								</div>
							</div>
						</div>
					</div>

					<div
						class={`mt-6 p-4 rounded-xl border ${leverageNeeded() > 5 ? "bg-rose-500/10 border-rose-500/20 text-rose-200" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"}`}
					>
						<p class="text-[10px] font-black uppercase tracking-widest mb-1">
							Protocol Status
						</p>
						<p class="text-sm font-bold leading-tight">
							{leverageNeeded() > 5
								? "WARNING: High leverage detected. Protocol violation risk. Review stop loss distance."
								: leverageNeeded() > 3
									? "CAUTION: Moderate leverage. Maintain strict oversight."
									: "SAFE: Position aligns with institutional risk parameters."}
						</p>
					</div>
				</div>
			</div>

			{/* Strategy Mantras */}
			<div class="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
				{[
					{
						label: "Capital Preservation",
						value: "Primary Objective",
						icon: "🛡️",
					},
					{
						label: "Positive Expectancy",
						value: "Follow the Bias",
						icon: "📈",
					},
					{ label: "Emotional Entropy", value: "Zero Tolerance", icon: "🧘" },
				].map((item) => (
					<div class="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
						<span class="text-xl">{item.icon}</span>
						<div>
							<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
								{item.label}
							</p>
							<p class="text-xs font-bold text-slate-700">{item.value}</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
