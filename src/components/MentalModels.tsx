import { For } from "solid-js";

interface Model {
	title: string;
	concept: string;
	implication: string;
	tag: string;
	color: string;
}

const MODELS: Model[] = [
	{
		title: "Reflexivity",
		concept:
			"Market prices influence the fundamentals they are supposed to reflect, creating feedback loops.",
		implication:
			"Bubbles and crashes are inherent. Watch for price driving sentiment driving flows.",
		tag: "George Soros",
		color: "border-indigo-500/30 text-indigo-400 bg-indigo-500/5",
	},
	{
		title: "Gresham's Law",
		concept: "Bad money drives out good money from circulation.",
		implication:
			"Fiat spend vs BTC hoarding. Low velocity supports institutional long-term value.",
		tag: "Monetary Policy",
		color: "border-amber-500/30 text-amber-400 bg-amber-500/5",
	},
	{
		title: "The Power Law",
		concept: "Value growth follows a predictable physical constant over time.",
		implication:
			"Volatility is noise. The long-term physical corridor is the primary signal.",
		tag: "Quant. Physics",
		color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
	},
	{
		title: "Filter Theory",
		concept:
			"Macro liquidity acts as a high-pass filter for speculative assets.",
		implication:
			"Technicals failure is high when Liquidity is restrictive. Fight the chart if tight.",
		tag: "Liquidity Dynamics",
		color: "border-slate-500/30 text-slate-400 bg-slate-500/5",
	},
];

export default function MentalModels() {
	return (
		<div class="space-y-8">
			<div class="flex items-center justify-between border-l-4 border-slate-500 pl-6 py-1">
				<div>
					<h2 class="text-2xl font-black text-white tracking-tighter uppercase whitespace-nowrap">
						Mental Models
					</h2>
					<p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
						Decision_Logic_Protocols
					</p>
				</div>
				<div class="badge-directive text-[9px] text-slate-500 border-white/5 bg-white/2">
					Operational_Manual_Annex
				</div>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-1">
				<For each={MODELS}>
					{(model) => (
						<div
							class={`p-6 border transition-all hover:bg-white/2 group ${model.color}`}
						>
							<div class="flex justify-between items-start mb-4">
								<h3 class="font-black text-white text-base tracking-tighter uppercase">
									{model.title}
								</h3>
								<span class="label-mono text-[9px] opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap">
									{"//"} {model.tag}
								</span>
							</div>
							<p class="text-[11px] font-bold text-slate-400 leading-relaxed mb-5 uppercase tracking-tight">
								{model.concept}
							</p>
							<div class="pt-4 border-t border-white/5">
								<p class="label-mono text-[9px] opacity-30 uppercase mb-2">
									Execution_Implication
								</p>
								<p class="text-[11px] font-mono font-black text-slate-300 leading-snug">
									"{model.implication}"
								</p>
							</div>
						</div>
					)}
				</For>
			</div>
		</div>
	);
}
