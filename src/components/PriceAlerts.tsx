import { createSignal, For, onMount, Show } from "solid-js";
import { formatCryptoPrice } from "../lib/format";
import { globalStore } from "../lib/store";

interface PriceAlert {
	id: string;
	symbol: string;
	targetPrice: string;
	enabled: string;
	triggered: string;
}

export default function PriceAlerts() {
	const [alerts, setAlerts] = createSignal<PriceAlert[]>([]);
	const [newPrice, setNewPrice] = createSignal("");
	const [loading, setLoading] = createSignal(false);
	const { currency } = globalStore;

	const fetchAlerts = async () => {
		try {
			const res = await fetch("/api/alerts");
			const data = await res.json();
			setAlerts(data);
		} catch (e) {
			console.error("Failed to fetch alerts", e);
		}
	};

	onMount(fetchAlerts);

	const addAlert = async (e: Event) => {
		e.preventDefault();
		if (!newPrice() || loading()) return;
		setLoading(true);
		try {
			await fetch("/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targetPrice: newPrice() }),
			});
			setNewPrice("");
			await fetchAlerts();
		} finally {
			setLoading(false);
		}
	};

	const toggleAlert = async (id: string, currentEnabled: boolean) => {
		try {
			await fetch("/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type: "TOGGLE", id, enabled: !currentEnabled }),
			});
			await fetchAlerts();
		} catch (e) {
			console.error(e);
		}
	};

	const deleteAlert = async (id: string) => {
		if (!confirm("Are you sure you want to delete this alert?")) return;
		try {
			await fetch("/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type: "DELETE", id }),
			});
			await fetchAlerts();
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<div class="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-bold text-white flex items-center gap-2">
					<span class="text-indigo-400">🔔</span> Price Alerts (BTC)
				</h3>
			</div>

			{/* Quick Add Form */}
			<form onSubmit={addAlert} class="flex gap-2">
				<div class="relative flex-1">
					<span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
						$
					</span>
					<input
						type="number"
						step="any"
						placeholder="Enter target price..."
						value={newPrice()}
						onInput={(e) => setNewPrice(e.currentTarget.value)}
						class="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all font-mono"
					/>
				</div>
				<button
					type="submit"
					disabled={loading()}
					class="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-6 rounded-xl transition-all active:scale-95"
				>
					Add
				</button>
			</form>

			{/* Alerts List */}
			<div class="space-y-3">
				<For each={alerts()}>
					{(alert) => {
						const isEnabled = alert.enabled === "true";
						const isTriggered = alert.triggered === "true";

						return (
							<div
								class={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isEnabled ? "bg-white/5 border-white/10" : "bg-black/20 border-white/5 opacity-60"}`}
							>
								<div class="flex items-center gap-4">
									<div
										class={`w-2 h-2 rounded-full ${isEnabled ? (isTriggered ? "bg-amber-400" : "bg-emerald-400") : "bg-slate-600"}`}
									/>
									<div>
										<div class="text-white font-bold font-mono">
											{formatCryptoPrice(Number(alert.targetPrice), currency())}
										</div>
										<div class="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
											{isTriggered ? "Triggered" : "Active"}
										</div>
									</div>
								</div>

								<div class="flex items-center gap-2">
									<button
										type="button"
										onClick={() => toggleAlert(alert.id, isEnabled)}
										class={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${isEnabled ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "bg-zinc-800 text-slate-500 hover:bg-zinc-700"}`}
									>
										{isEnabled ? "ON" : "OFF"}
									</button>
									<button
										type="button"
										onClick={() => deleteAlert(alert.id)}
										class="p-2 text-slate-500 hover:text-rose-400 transition-colors"
									>
										<svg
											class="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<title>Delete alert</title>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</div>
							</div>
						);
					}}
				</For>

				<Show when={alerts().length === 0}>
					<div class="text-center py-10 border border-dashed border-white/10 rounded-2xl text-slate-600 text-sm">
						No price alerts set
					</div>
				</Show>
			</div>
		</div>
	);
}
