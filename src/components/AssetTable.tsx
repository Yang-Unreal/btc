import { type Component, createSignal, For, onMount, Show } from "solid-js";

// --- Icons ---
const IconStar: Component<{ class?: string; filled?: boolean }> = (props) => (
	<svg
		class={props.class}
		fill={props.filled ? "currentColor" : "none"}
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Star</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
		/>
	</svg>
);

const IconRefresh: Component<{ class?: string }> = (props) => (
	<svg
		class={props.class}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<title>Refresh</title>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
		/>
	</svg>
);

interface CryptoAsset {
	symbol: string;
	name: string;
	image: string;
	price: number;
	marketCap: number;
	volume24h: number;
	change24h: number;
	rank: number;
}

export default function AssetTable() {
	const [assets, setAssets] = createSignal<CryptoAsset[]>([]);
	const [favorites, setFavorites] = createSignal<Set<string>>(new Set());
	const [loading, setLoading] = createSignal(true);
	const [showFavoritesOnly, setShowFavoritesOnly] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const fetchData = async () => {
		setLoading(true);
		setError(null);
		try {
			console.log("MARKET_UI: Initializing sync...");
			const marketRes = await fetch("/api/market_cap");
			console.log("MARKET_UI: Response status:", marketRes.status);

			if (!marketRes.ok) {
				const errorText = await marketRes.text();
				console.error("MARKET_UI: Error body:", errorText);
				throw new Error(`Sync failed: ${marketRes.status}`);
			}

			const rawData = await marketRes.text();
			let marketData: CryptoAsset[];
			try {
				marketData = JSON.parse(rawData);
			} catch (parseErr) {
				console.error(
					"MARKET_UI: JSON Parse Error. Raw body starts with:",
					rawData.substring(0, 100),
				);
				throw new Error("Malformed data protocol");
			}

			if (!Array.isArray(marketData)) {
				console.error("MARKET_UI: Expected array, got:", typeof marketData);
				throw new Error("Invalid data structure");
			}

			setAssets(marketData);
			console.log("MARKET_UI: Assets loaded:", marketData.length);

			// Favorites (Optional)
			try {
				const favRes = await fetch("/api/favorites");
				if (favRes.ok) {
					const favData = await favRes.json();
					setFavorites(new Set<string>(favData));
				}
			} catch (favErr) {
				console.warn("MARKET_UI: Favorites sync background failure:", favErr);
			}
		} catch (_err: any) {
			console.error("MARKET_UI: Critical failure:", _err);
			setError(`Sync Error: ${_err?.message || "Protocol Offline"}`);
		} finally {
			setLoading(false);
		}
	};

	const toggleFavorite = async (symbol: string) => {
		try {
			const res = await fetch("/api/favorites", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ symbol }),
			});

			if (res.ok) {
				const { favorited } = await res.json();
				setFavorites((prev) => {
					const next = new Set<string>(prev);
					if (favorited) next.add(symbol);
					else next.delete(symbol);
					return next;
				});
			}
		} catch (err) {
			console.error("Failed to toggle favorite:", err);
		}
	};

	onMount(fetchData);

	const filteredAssets = () => {
		const list = assets();
		if (showFavoritesOnly()) {
			return list.filter((a) => favorites().has(a.symbol));
		}
		return list;
	};

	const formatCurrency = (val: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			maximumFractionDigits: val < 1 ? 4 : 2,
		}).format(val);
	};

	const formatCompact = (val: number) => {
		return new Intl.NumberFormat("en-US", {
			notation: "compact",
			compactDisplay: "short",
			maximumFractionDigits: 1,
		}).format(val);
	};

	return (
		<div class="space-y-6">
			{/* Error Display */}
			<Show when={error()}>
				<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded">
					{error()}
				</div>
			</Show>

			{/* Header */}
			<div class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-4 border-indigo-500 pl-6 py-2">
				<div>
					<div class="flex items-center gap-3 mb-3 flex-wrap">
						<span class="badge-directive text-indigo-400 border-indigo-500/30 bg-indigo-500/5">
							Market_Monitor_X1
						</span>
						<span class="label-mono opacity-40">Systematic_Asset_View</span>
						<span class="text-[8px] bg-white/5 px-2 py-0.5 rounded opacity-30 text-white border border-white/10 uppercase font-black tracking-tighter">
							V2.2-DEBUG
						</span>
					</div>
					<h2 class="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-tight">
						Market Overview
					</h2>
				</div>

				<div class="flex items-center gap-4">
					<button
						type="button"
						onClick={() => setShowFavoritesOnly(!showFavoritesOnly())}
						class={`flex items-center gap-3 px-4 py-2 border text-[10px] font-black uppercase tracking-widest transition-all ${
							showFavoritesOnly()
								? "bg-indigo-500/10 border-indigo-500 text-indigo-400"
								: "bg-white/5 border-white/10 text-white/40 hover:text-white"
						}`}
					>
						<IconStar class="w-3 h-3" filled={showFavoritesOnly()} />
						{showFavoritesOnly() ? "Favorites_Mode" : "All_Assets"}
					</button>

					<button
						type="button"
						onClick={fetchData}
						class="flex items-center justify-center p-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
					>
						<IconRefresh class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} />
					</button>
				</div>
			</div>

			{/* Table */}
			<div class="directive-card overflow-x-auto no-scrollbar">
				<table class="w-full text-left border-collapse min-w-[700px]">
					<thead>
						<tr class="border-b border-white/5 bg-white/2">
							<th class="py-4 px-6 w-10"></th>
							<th class="py-4 px-2 label-mono text-[9px] text-slate-500">
								Asset
							</th>
							<th class="py-4 px-6 label-mono text-[9px] text-slate-500 text-right">
								Price
							</th>
							<th class="py-4 px-6 label-mono text-[9px] text-slate-500 text-right">
								24H_Change
							</th>
							<th class="py-4 px-6 label-mono text-[9px] text-slate-500 text-right">
								Market_Cap
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/3">
						<Show
							when={!loading() || assets().length > 0}
							fallback={
								<For each={[1, 2, 3, 4, 5]}>
									{() => (
										<tr>
											<td colspan="5" class="py-8 px-6">
												<div class="h-4 bg-white/5 animate-pulse rounded w-full" />
											</td>
										</tr>
									)}
								</For>
							}
						>
							<For
								each={filteredAssets()}
								fallback={
									<tr>
										<td colspan="5" class="py-20 text-center">
											<p class="label-mono text-slate-600 text-[10px]">
												No assets found in current filter regime
											</p>
										</td>
									</tr>
								}
							>
								{(asset) => (
									<tr class="group hover:bg-white/2 transition-colors relative">
										<td class="py-4 px-6">
											<button
												type="button"
												onClick={() => toggleFavorite(asset.symbol)}
												class={`transition-colors ${
													favorites().has(asset.symbol)
														? "text-indigo-400"
														: "text-slate-700 hover:text-slate-500"
												}`}
											>
												<IconStar
													class="w-4 h-4"
													filled={favorites().has(asset.symbol)}
												/>
											</button>
										</td>
										<td class="py-4 px-2">
											<div class="flex items-center gap-3">
												<img
													src={asset.image}
													alt={asset.name}
													class="w-6 h-6 rounded-full grayscale group-hover:grayscale-0 transition-all opacity-60 group-hover:opacity-100"
												/>
												<div class="flex flex-col">
													<span class="text-xs font-black text-white tracking-tight">
														{asset.symbol}
													</span>
													<span class="text-[9px] font-bold text-slate-500 uppercase">
														{asset.name}
													</span>
												</div>
											</div>
										</td>
										<td class="py-4 px-6 text-right">
											<span class="data-value text-xs text-white">
												{formatCurrency(asset.price)}
											</span>
										</td>
										<td class="py-4 px-6 text-right">
											<span
												class={`data-value text-xs ${
													asset.change24h >= 0
														? "text-emerald-400"
														: "text-rose-400"
												}`}
											>
												{asset.change24h >= 0 ? "+" : ""}
												{asset.change24h.toFixed(2)}%
											</span>
										</td>
										<td class="py-4 px-6 text-right">
											<span class="data-value text-xs text-slate-400">
												{formatCompact(asset.marketCap)}
											</span>
										</td>
									</tr>
								)}
							</For>
						</Show>
					</tbody>
				</table>
			</div>
		</div>
	);
}
