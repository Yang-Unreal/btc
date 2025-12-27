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
			"Bubbles and crashes are inherent, not anomalies. Watch for price driving sentiment driving flows.",
		tag: "George Soros",
		color: "border-indigo-500 bg-indigo-50 text-indigo-700",
	},
	{
		title: "Gresham's Law",
		concept: "Bad money drives out good money from circulation.",
		implication:
			"People spend fiat (bad/weak) and hoard Bitcoin (good/strong). Low velocity supports long-term value.",
		tag: "Monetary Policy",
		color: "border-amber-500 bg-amber-50 text-amber-700",
	},
	{
		title: "The Power Law",
		concept:
			"Value growth is non-linear and follows a predictable physical constant over time.",
		implication:
			"Short-term volatility is noise. The long-term corridor is the only signal that matters.",
		tag: "Giovanni Santostasi",
		color: "border-emerald-500 bg-emerald-50 text-emerald-700",
	},
	{
		title: "Filter Theory",
		concept:
			"Macro liquidity acts as a high-pass filter for speculative assets.",
		implication:
			"Technicals only work when Macro Liquidity is expansive. Fight the chart if liquidity is tight.",
		tag: "Capital Allocation",
		color: "border-slate-500 bg-slate-50 text-slate-700",
	},
];

export default function MentalModels() {
	return (
		<div class="space-y-6">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-xl font-bold text-slate-900 tracking-tight">
						Institutional Mental Models
					</h2>
					<p class="text-xs font-semibold text-slate-500 uppercase tracking-widest">
						Decision Frameworks & Logic
					</p>
				</div>
				<div class="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">
					Static Reference
				</div>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<For each={MODELS}>
					{(model) => (
						<div
							class={`p-5 rounded-2xl border-l-4 shadow-sm transition-all hover:shadow-md ${model.color} border-opacity-50`}
						>
							<div class="flex justify-between items-start mb-3">
								<h3 class="font-bold text-base tracking-tight">
									{model.title}
								</h3>
								<span class="text-[9px] font-black uppercase tracking-widest opacity-60 px-2 py-0.5 rounded-md bg-white border border-current border-opacity-20">
									{model.tag}
								</span>
							</div>
							<p class="text-xs font-bold text-slate-600 leading-relaxed mb-3">
								{model.concept}
							</p>
							<div class="pt-3 border-t border-current border-opacity-10">
								<p class="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">
									Execution Implication
								</p>
								<p class="text-xs font-bold leading-tight italic">
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
