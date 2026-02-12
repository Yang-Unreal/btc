import { type Component, createSignal, For, onMount, Show } from "solid-js";
import { formatCompact, formatCryptoPrice } from "../lib/format";

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
	change1h: number;
	change24h: number;
	change7d: number;
	change30d: number;
	change1y: number;
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
			const marketRes = await fetch("/api/market_cap");
			if (!marketRes.ok) throw new Error("Sync failed");

			const marketData: CryptoAsset[] = await marketRes.json();
			setAssets(marketData);

			// Favorites (Optional)
			try {
				const favRes = await fetch("/api/favorites");
				if (favRes.ok) {
					const favData = await favRes.json();
					setFavorites(new Set<string>(favData));
				}
			} catch (favErr) {
				console.warn("Favorites sync background failure:", favErr);
			}
		} catch (_err) {
			setError("Market Data Unavailable");
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
		return showFavoritesOnly()
			? list.filter((a) => favorites().has(a.symbol))
			: list;
	};

	const ChangeCell: Component<{ value: number }> = (props) => (
		<td class="py-4 px-4 text-right">
			<span
				class={`font-mono text-xs font-medium ${
					props.value > 0
						? "text-emerald-400"
						: props.value < 0
							? "text-rose-400"
							: "text-slate-500"
				}`}
			>
				{props.value > 0 ? "+" : ""}
				{props.value.toFixed(1)}%
			</span>
		</td>
	);

	return (
		<div class="space-y-4">
			{/* Controls */}
			<div class="flex justify-between items-center mb-6">
				<div class="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShowFavoritesOnly(!showFavoritesOnly())}
						class={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
							showFavoritesOnly()
								? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
								: "text-slate-500 hover:text-slate-300 border border-transparent"
						}`}
					>
						<IconStar class="w-3 h-3" filled={showFavoritesOnly()} />
						{showFavoritesOnly() ? "Favorites" : "All Assets"}
					</button>
				</div>
				<button
					type="button"
					onClick={fetchData}
					class="p-1.5 text-slate-500 hover:text-white transition-colors"
					title="Refresh"
				>
					<IconRefresh class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} />
				</button>
			</div>

			{/* Table */}
			<div class="overflow-x-auto no-scrollbar">
				<table class="w-full text-left border-collapse min-w-[900px]">
					<thead>
						<tr class="border-b border-white/5 text-slate-500">
							<th class="py-3 px-4 w-12 text-[10px] font-bold uppercase tracking-wider">
								#
							</th>
							<th class="py-3 px-4 text-[10px] font-bold uppercase tracking-wider">
								Asset
							</th>
							<th class="py-3 px-4 text-right text-[10px] font-bold uppercase tracking-wider">
								Price
							</th>
							<th class="py-3 px-4 text-right text-[10px] font-bold uppercase tracking-wider">
								Mkt Cap
							</th>
							<th class="py-3 px-4 text-right text-[10px] font-bold uppercase tracking-wider">
								Volume (24h)
							</th>
							<th class="py-3 px-4 text-right text-[10px] font-bold uppercase tracking-wider">
								1h
							</th>
							<th class="py-3 px-4 text-right text-[10px] font-bold uppercase tracking-wider">
								24h
							</th>
							<th class="py-3 px-4 text-right text-[10px] font-bold uppercase tracking-wider">
								7d
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/5">
						<Show
							when={!loading() || assets().length > 0}
							fallback={
								<tr>
									<td
										colspan="8"
										class="py-12 text-center text-slate-500 text-xs"
									>
										Loading market data...
									</td>
								</tr>
							}
						>
							<For each={filteredAssets()}>
								{(asset, index) => (
									<tr class="group hover:bg-white/[0.02] transition-colors">
										<td class="py-4 px-4 text-xs text-slate-500 font-mono">
											{index() + 1}
										</td>
										<td class="py-4 px-4">
											<div class="flex items-center gap-3">
												<button
													type="button"
													onClick={() => toggleFavorite(asset.symbol)}
													class="text-slate-600 hover:text-indigo-400 transition-colors"
												>
													<IconStar
														class="w-3.5 h-3.5"
														filled={favorites().has(asset.symbol)}
													/>
												</button>
												<div class="flex items-center gap-3">
													<img
														src={asset.image}
														alt={asset.name}
														class="w-6 h-6 rounded-full opacity-90 group-hover:opacity-100 transition-opacity"
													/>
													<div>
														<span class="text-sm font-bold text-slate-200 block leading-none">
															{asset.symbol}
														</span>
														<span class="text-[10px] text-slate-500 uppercase tracking-wider">
															{asset.name}
														</span>
													</div>
												</div>
											</div>
										</td>
										<td class="py-4 px-4 text-right">
											<span class="font-mono text-sm font-medium text-slate-200">
												{formatCryptoPrice(asset.price)}
											</span>
										</td>
										<td class="py-4 px-4 text-right">
											<span class="font-mono text-xs text-slate-400">
												{formatCompact(asset.marketCap)}
											</span>
										</td>
										<td class="py-4 px-4 text-right">
											<span class="font-mono text-xs text-slate-400">
												{formatCompact(asset.volume24h)}
											</span>
										</td>
										<ChangeCell value={asset.change1h} />
										<ChangeCell value={asset.change24h} />
										<ChangeCell value={asset.change7d} />
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
