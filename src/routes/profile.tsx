import PriceAlerts from "../components/PriceAlerts";

export default function Profile() {
	return (
		<div class="min-h-screen bg-[#09090b] text-slate-200 font-sans selection:bg-indigo-500/30">
			<div class="fixed inset-0 pointer-events-none">
				<div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
				<div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
			</div>

			<div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-16">
				<PriceAlerts />
			</div>
		</div>
	);
}
