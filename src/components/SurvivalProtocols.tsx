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
		<div class="my-8 md:my-12">
			{/* Section Header - Institutional Style */}
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6 border-l-4 border-rose-500 pl-6 py-2">
				<div>
					<div class="flex items-center gap-3 mb-3">
						<span class="badge-directive text-rose-500 border-rose-500/30 bg-rose-500/5">
							Tactical_Level_04
						</span>
						<span class="label-mono opacity-40">Risk_Management_Protocol</span>
					</div>
					<h2 class="text-4xl font-black text-white tracking-tighter uppercase">
						Survival Protocols
					</h2>
					<p class="text-slate-500 mt-3 max-w-2xl text-[13px] font-bold leading-relaxed uppercase tracking-tight">
						Systematic position sizing and risk mitigation. Operational{" "}
						<span class="text-white">Survival</span> is the primary objective of
						any institutional allocation.
					</p>
				</div>
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
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
				</div>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-1">
				{/* Calculator Section */}
				<div class="directive-card p-8">
					<div class="space-y-8">
						<div>
							<label
								for="balance"
								class="block label-mono text-[10px] opacity-50 uppercase mb-3"
							>
								Total_Account_Equity_($)
							</label>
							<div class="relative group">
								<input
									id="balance"
									type="number"
									value={balance()}
									onInput={(e) => setBalance(Number(e.currentTarget.value))}
									class="w-full px-5 py-4 bg-white/5 border border-white/10 text-xl font-mono font-black text-white focus:outline-none focus:border-rose-500/50 transition-all"
								/>
								<div class="absolute inset-y-0 right-5 flex items-center pointer-events-none opacity-20">
									USD
								</div>
							</div>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<label
									for="risk-percent"
									class="block label-mono text-[10px] opacity-50 uppercase mb-3"
								>
									Trade_Risk_Factor_(%)
								</label>
								<div class="relative group">
									<input
										id="risk-percent"
										type="number"
										value={riskPercent()}
										onInput={(e) =>
											setRiskPercent(Number(e.currentTarget.value))
										}
										class="w-full px-5 py-4 bg-white/5 border border-white/10 text-xl font-mono font-black text-white focus:outline-none focus:border-rose-500/50 transition-all"
									/>
									<div class="absolute inset-y-0 right-5 flex items-center pointer-events-none opacity-20">
										%
									</div>
								</div>
							</div>
							<div>
								<span class="block label-mono text-[10px] opacity-50 uppercase mb-3">
									Net_Capital_Risk_($)
								</span>
								<div class="w-full px-5 py-4 bg-rose-500/5 border border-rose-500/10 text-xl font-mono font-black text-rose-400">
									${" "}
									{riskAmount().toLocaleString(undefined, {
										minimumFractionDigits: 2,
									})}
								</div>
							</div>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
							<div>
								<label
									for="entry-price"
									class="block label-mono text-[10px] opacity-50 uppercase mb-3"
								>
									Terminal_Entry_Price
								</label>
								<div class="relative group">
									<input
										id="entry-price"
										type="number"
										value={entryPrice()}
										onInput={(e) =>
											setEntryPrice(Number(e.currentTarget.value))
										}
										class="w-full px-5 py-4 bg-white/5 border border-white/10 text-xl font-mono font-black text-white focus:outline-none focus:border-rose-500/50 transition-all"
									/>
								</div>
							</div>
							<div>
								<label
									for="stop-loss"
									class="block label-mono text-[10px] opacity-50 uppercase mb-3"
								>
									Protocol_Stop_Loss
								</label>
								<div class="relative group">
									<input
										id="stop-loss"
										type="number"
										value={stopLoss()}
										onInput={(e) => setStopLoss(Number(e.currentTarget.value))}
										class="w-full px-5 py-4 bg-white/5 border border-white/10 text-xl font-mono font-black text-white focus:outline-none focus:border-rose-500/50 transition-all"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Results Section */}
				<div class="directive-card bg-slate-900/40 p-8 flex flex-col">
					<div class="grow space-y-10">
						<div>
							<p class="label-mono text-[10px] opacity-40 uppercase mb-4 tracking-widest">
								Recommended_Exposure_Matrix
							</p>
							<div class="flex items-baseline gap-4">
								<div class="data-value text-6xl text-rose-400">
									{positionSize().toFixed(4)}
								</div>
								<div class="text-xl font-black text-slate-600 uppercase">
									BTC_Units
								</div>
							</div>
							<div class="mt-4 flex items-center gap-3">
								<span class="label-mono text-[11px] opacity-50">
									Notional_Value:
								</span>
								<span class="font-mono text-sm font-black text-slate-300">
									${" "}
									{notionalValue().toLocaleString(undefined, {
										maximumFractionDigits: 0,
									})}
								</span>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-1">
							<div class="p-6 bg-white/2 border border-white/5">
								<p class="label-mono text-[10px] opacity-40 uppercase mb-2">
									Effective_Leverage
								</p>
								<div
									class={`data-value text-3xl ${leverageNeeded() > 3 ? "text-amber-400" : "text-emerald-400"}`}
								>
									{leverageNeeded().toFixed(2)}x
								</div>
							</div>
							<div class="p-6 bg-white/2 border border-white/5 text-right">
								<p class="label-mono text-[10px] opacity-40 uppercase mb-2">
									Price_Drop_Tolerance
								</p>
								<div class="data-value text-3xl text-slate-300">
									{priceRiskPercent().toFixed(2)}%
								</div>
							</div>
						</div>
					</div>

					<div
						class={`mt-10 p-6 border ${leverageNeeded() > 5 ? "bg-rose-500/5 border-rose-500/20 text-rose-200" : "bg-emerald-500/5 border-emerald-500/20 text-emerald-200"}`}
					>
						<div class="flex items-center gap-3 mb-2">
							<div
								class={`w-2 h-2 rounded-full animate-pulse ${leverageNeeded() > 5 ? "bg-rose-500" : "bg-emerald-500"}`}
							></div>
							<p class="label-mono text-[10px] uppercase font-black tracking-widest">
								Protocol_Validation_Status
							</p>
						</div>
						<p class="text-[13px] font-bold leading-relaxed uppercase tracking-tight">
							{leverageNeeded() > 5
								? "CRITICAL: High leverage detected. Protocol violation risk. Review stop loss distance or reduce account risk factor."
								: leverageNeeded() > 3
									? "ADVISORY: Moderate leverage. Maintain strict oversight and ensure execution speed for stop loss protocol."
									: "NOMINAL: Position aligns with verified institutional risk parameters. Survival probability is high."}
						</p>
					</div>
				</div>
			</div>

			{/* Operational Heuristics */}
			<div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-1">
				{[
					{
						label: "Capital_Preservation",
						value: "Primary_Directive",
						icon: "🛡️",
					},
					{
						label: "Positive_Expectancy",
						value: "Bias_Confirmation",
						icon: "📈",
					},
					{ label: "Emotional_Entropy", value: "Zero_Tolerance", icon: "🧘" },
				].map((item) => (
					<div class="directive-card p-5 flex items-center gap-5 hover:bg-white/2 transition-colors">
						<span class="text-3xl filter saturate-0 grayscale opacity-40 group-hover:opacity-100 transition-opacity">
							{item.icon}
						</span>
						<div>
							<p class="label-mono text-[9px] opacity-40 uppercase mb-1">
								{item.label}
							</p>
							<p class="text-xs font-black text-white uppercase tracking-wider">
								{item.value}
							</p>
						</div>
					</div>
				))}
			</div>

			{/* Operational Timestamp */}
			<div class="mt-6 flex justify-between items-center opacity-40">
				<div class="flex items-center gap-2">
					<div class="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
					<span class="label-mono text-[9px] uppercase">
						Risk_Engine_Online
					</span>
				</div>
				<span class="label-mono text-[9px] uppercase">
					Audit_Signature: SP_
					{Math.floor(Date.now() / 1000)
						.toString(16)
						.toUpperCase()}
				</span>
			</div>
		</div>
	);
}
