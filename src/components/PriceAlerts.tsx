import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { SUPPORTED_ASSETS, ASSET_MAP } from "../lib/constants";
import { formatCryptoPrice } from "../lib/format";
import { globalStore } from "../lib/store";

interface PriceAlert {
	id: string;
	symbol: string;
	targetPrice: string;
	enabled: string;
	triggered: string;
}

const previousPrices: Record<string, number> = {};
	let ws: WebSocket | null = null;
	const subscribedSymbols = new Set<string>();
	let connecting = false;
	let reconnectTimer: number | null = null;

const sendTelegramMessage = async (message: string): Promise<void> => {
	const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
	const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
	if (!botToken || !chatId) return;

	try {
		await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: chatId,
				text: message,
				parse_mode: "HTML",
			}),
		});
	} catch {
		// ignore
	}
};

const connectWs = (
	symbols: string[],
	setAlerts: (v: PriceAlert[] | ((prev: PriceAlert[]) => PriceAlert[])) => void,
	getAlerts: () => PriceAlert[],
) => {
	if (connecting) return;
	if (ws) {
		ws.close();
		ws = null;
	}
	subscribedSymbols.clear();

	const unique = [...new Set(symbols)];
	if (unique.length === 0) return;

	connecting = true;
	const newWs = new WebSocket("wss://api.hyperliquid.xyz/ws");
	ws = newWs;

	let pingTimer: number | null = null;
	newWs.onopen = () => {
		connecting = false;
		console.log("[PriceAlerts] WS connected, state:", newWs.readyState, " subscribing to", unique);

		pingTimer = window.setInterval(() => {
			if (newWs.readyState === WebSocket.OPEN) {
				newWs.send(JSON.stringify({ method: "ping" }));
			}
		}, 30_000);

		for (const symbol of unique) {
			const asset = ASSET_MAP[symbol];
			const coin = asset?.hlSymbol || symbol;
			try {
				newWs.send(
					JSON.stringify({
						method: "subscribe",
						subscription: { type: "trades", coin },
					}),
				);
				console.log("[PriceAlerts] subscribed to", coin, "for symbol", symbol);
				subscribedSymbols.add(symbol);
			} catch (e) {
				console.error("[PriceAlerts] subscribe error for", symbol, e);
			}
		}
	};

	newWs.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data);
			console.log("[PriceAlerts] WS message:", msg.channel, msg.data?.length || 1);
			if (msg.channel !== "trades" || !Array.isArray(msg.data)) return;

			const tradesByCoin = new Map<string, number>();
			for (const trade of msg.data) {
				const px = parseFloat(trade.px);
				if (!Number.isNaN(px)) tradesByCoin.set(trade.coin, px);
			}
			console.log("[PriceAlerts] prices received:", [...tradesByCoin.entries()]);

			const currentAlerts = getAlerts();
			if (currentAlerts.length === 0) return;

			let changed = false;
			const next = currentAlerts.map((alert) => {
				const sym = alert.symbol || "BTC";
				const asset = ASSET_MAP[sym];
				const coin = asset?.hlSymbol || sym;
				const px = tradesByCoin.get(coin) || tradesByCoin.get(sym);
				if (!px) {
					console.log("[PriceAlerts] no price for", sym, "(coin:", coin, ") available:", [...tradesByCoin.keys()]);
					return alert;
				}

				const prev = previousPrices[sym] || 0;
				previousPrices[sym] = px;

				const target = Number(alert.targetPrice);
				const crossedUp =
					prev > 0 && prev < target && px >= target;
				const crossedDown =
					prev > 0 && prev > target && px <= target;

				console.log("[PriceAlerts]", sym, "px=", px, "target=", target, "prev=", prev, "match=", crossedUp || crossedDown, "triggered=", alert.triggered);

				if (
					(crossedUp || crossedDown) &&
					alert.triggered === "false"
				) {
					changed = true;
					return { ...alert, triggered: "true", enabled: "false" };
				}
				return alert;
			});

			if (changed) {
				setAlerts(next);
				fetchAlerts();
			}
		} catch (e) {
			console.error("[PriceAlerts] onmessage error", e);
		}
	};

	newWs.onclose = (event) => {
		connecting = false;
		if (pingTimer !== null) {
			window.clearInterval(pingTimer);
			pingTimer = null;
		}
		ws = null;
		subscribedSymbols.clear();
		console.log("[PriceAlerts] WS disconnected, code:", event.code, "reason:", event.reason, "wasClean:", event.wasClean);

		if (!event.wasClean) {
			reconnectTimer = window.setTimeout(() => {
				const symbols = alerts().map((a) => a.symbol || "BTC");
				connectWs(symbols, setAlerts, alerts);
			}, 2000);
		}
	};

	newWs.onerror = (event) => {
		connecting = false;
		if (pingTimer !== null) {
			window.clearInterval(pingTimer);
			pingTimer = null;
		}
		ws = null;
		subscribedSymbols.clear();
		console.log("[PriceAlerts] WS error event:", event);
	};
};

export default function PriceAlerts() {
	const [alerts, setAlerts] = createSignal<PriceAlert[]>([]);
	const [newPrice, setNewPrice] = createSignal("");
	const [selectedSymbol, setSelectedSymbol] = createSignal("BTC");
	const [loading, setLoading] = createSignal(false);
	const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
	const [showAssetDropdown, setShowAssetDropdown] = createSignal(false);
	const [assetSearchQuery, setAssetSearchQuery] = createSignal("");
	const { currency } = globalStore;

	const fetchAlerts = async () => {
		try {
			const res = await fetch("/api/alerts");
			const data = await res.json();
			setAlerts(data);
			const symbols = data.map((a) => a.symbol || "BTC");
			connectWs(symbols, setAlerts, alerts);
		} catch (e) {
			console.error("Failed to fetch alerts", e);
		}
	};

	onMount(fetchAlerts);

	let pollTimer: number | null = null;
	onMount(() => {
		pollTimer = window.setInterval(fetchAlerts, 30_000);
	});

	onCleanup(() => {
		if (reconnectTimer !== null) {
			window.clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		if (pollTimer !== null) {
			window.clearInterval(pollTimer);
			pollTimer = null;
		}
		if (ws) {
			ws.close();
			ws = null;
		}
		subscribedSymbols.clear();
	});

	const addAlert = async (e: Event) => {
		e.preventDefault();
		if (!newPrice() || loading()) return;
		setLoading(true);
		try {
			await fetch("/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					targetPrice: newPrice(),
					symbol: selectedSymbol(),
				}),
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

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleSelectAll = () => {
		const allIds = alerts().map((a) => a.id);
		const current = selectedIds();
		if (current.size === allIds.length && allIds.length > 0) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(allIds));
		}
	};

	const deleteSelectedAlerts = async () => {
		const ids = Array.from(selectedIds());
		if (ids.length === 0) return;
		if (!confirm(`Delete ${ids.length} selected alert(s)?`)) return;
		try {
			await fetch("/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type: "DELETE_BATCH", ids }),
			});
			setSelectedIds(new Set());
			await fetchAlerts();
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<div class="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-bold text-white flex items-center gap-2">
					<span class="text-indigo-400">🔔</span> Price Alerts
				</h3>
				<div class="flex items-center gap-3">
					<Show when={alerts().length > 0}>
						<label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
							<input
								type="checkbox"
								checked={selectedIds().size === alerts().length}
								onChange={toggleSelectAll}
								class="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
							/>
							<span>Select All</span>
						</label>
					</Show>
					<Show when={selectedIds().size > 0}>
						<button
							type="button"
							onClick={deleteSelectedAlerts}
							class="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95"
						>
							Delete ({selectedIds().size})
						</button>
					</Show>
				</div>
			</div>

			{/* Quick Add Form */}
			<form onSubmit={addAlert} class="flex gap-2">
				<div class="relative shrink-0">
					<button
						type="button"
						class="bg-black/40 border border-white/10 rounded-xl pl-3 pr-8 py-3 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer flex items-center gap-2 min-w-[110px]"
						onClick={() => {
							setShowAssetDropdown(!showAssetDropdown());
							setAssetSearchQuery("");
						}}
					>
						<span>{selectedSymbol()}/USD</span>
					</button>
					<span class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">
						▼
					</span>
					<Show when={showAssetDropdown()}>
						<div class="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-white/10 shadow-2xl rounded-xl py-1 min-w-[200px]">
							<div class="px-2 py-2">
								<input
									type="text"
									placeholder="Search assets..."
									value={assetSearchQuery()}
									onInput={(e) => setAssetSearchQuery(e.currentTarget.value)}
									class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 transition-all"
								/>
							</div>
							<div class="max-h-48 overflow-y-auto no-scrollbar">
								<For
									each={SUPPORTED_ASSETS.filter((asset) => {
										const q = assetSearchQuery().toLowerCase();
										if (!q) return true;
										return (
											asset.symbol.toLowerCase().includes(q) ||
											asset.name.toLowerCase().includes(q)
										);
									})}
								>
									{(asset) => (
										<div
											class={`w-full flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-colors ${
												selectedSymbol() === asset.symbol
													? "bg-indigo-500/20 text-indigo-300"
													: "text-slate-300 hover:bg-white/5"
											}`}
											onClick={() => {
												setSelectedSymbol(asset.symbol);
												setShowAssetDropdown(false);
												setAssetSearchQuery("");
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													setSelectedSymbol(asset.symbol);
													setShowAssetDropdown(false);
													setAssetSearchQuery("");
												}
											}}
											role="option"
											tabIndex={0}
										>
											<span class="font-bold">{asset.symbol}</span>
											<span class="text-slate-500">{asset.name}</span>
										</div>
									)}
								</For>
								<Show
									when={
										SUPPORTED_ASSETS.filter((asset) => {
											const q = assetSearchQuery().toLowerCase();
											if (!q) return false;
											return (
												asset.symbol.toLowerCase().includes(q) ||
												asset.name.toLowerCase().includes(q)
											);
										}).length === 0
									}
								>
									<div class="px-3 py-2 text-xs text-slate-500">
										No assets found
									</div>
								</Show>
							</div>
						</div>
					</Show>
				</div>
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
						const isSelected = selectedIds().has(alert.id);

						return (
							<div
								class={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isSelected ? "bg-indigo-500/10 border-indigo-500/30" : isEnabled ? "bg-white/5 border-white/10" : "bg-black/20 border-white/5 opacity-60"}`}
							>
								<div class="flex items-center gap-4">
									<input
										type="checkbox"
										checked={isSelected}
										onChange={() => toggleSelect(alert.id)}
										class="w-4 h-4 rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer shrink-0"
									/>
									<div
										class={`w-2 h-2 rounded-full ${isEnabled ? (isTriggered ? "bg-amber-400" : "bg-emerald-400") : "bg-slate-600"}`}
									/>
									<div>
										<div class="text-white font-bold font-mono">
											{alert.symbol}/USD:{" "}
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
