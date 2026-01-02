import { type Component, createSignal, For, onMount } from "solid-js";

interface AssetData {
	symbol: string;
	name: string;
	image: string;
	price: number;
	marketCap: number;
	volume24h: number;
	change24h: number;
	rank: number;
}

const formatCurrency = (val: number) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: val < 1 ? 4 : 2,
		maximumFractionDigits: val < 1 ? 4 : 2,
	}).format(val);
};

const formatCompact = (val: number) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(val);
};

const AssetTable: Component = () => {
	const [assets, setAssets] = createSignal<AssetData[]>([]);
	const [loading, setLoading] = createSignal(true);

	const fetchAssets = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/market_cap");
			if (res.ok) {
				const data = await res.json();
				setAssets(data);
			}
		} catch (e) {
			console.error("Failed to load assets", e);
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchAssets();
	});

	return (
		<div class="mb-4">
			<div class="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6 border-l-4 border-slate-500 pl-6 py-2">
				<div>
					<h2 class="text-3xl font-black text-white tracking-tighter uppercase whitespace-nowrap">
						Market Intelligence
					</h2>
					<p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
						Cross_Asset_Benchmarking_Suite
					</p>
				</div>
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-white text-xs font-bold uppercase tracking-tighter">
						Live
					</div>
				</div>
			</div>

			<div class="border border-white/5 overflow-hidden">
				<div class="overflow-x-auto no-scrollbar">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr class="bg-white/2 border-b border-white/5 text-[10px] uppercase font-black tracking-[0.2em] text-slate-500">
								<th class="px-6 py-5 font-black">Asset_Ident</th>
								<th class="px-6 py-5 font-black text-right">Terminal_Price</th>
								<th class="px-6 py-5 font-black text-right">Delta_24H</th>
								<th class="px-6 py-5 font-black text-right">Market_Cap</th>
								<th class="px-6 py-5 font-black text-right hidden md:table-cell">
									Volume_24H
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5 bg-white/1">
							{loading() ? (
								<For each={Array(8).fill(0)}>
									{() => (
										<tr class="animate-pulse">
											<td class="px-6 py-5">
												<div class="h-4 w-32 bg-white/5"></div>
											</td>
											<td class="px-6 py-5">
												<div class="h-4 w-24 bg-white/5 ml-auto"></div>
											</td>
											<td class="px-6 py-5">
												<div class="h-4 w-16 bg-white/5 ml-auto"></div>
											</td>
											<td class="px-6 py-5">
												<div class="h-4 w-24 bg-white/5 ml-auto"></div>
											</td>
											<td class="px-6 py-5 hidden md:table-cell">
												<div class="h-4 w-24 bg-white/5 ml-auto"></div>
											</td>
										</tr>
									)}
								</For>
							) : (
								<For each={assets()}>
									{(asset) => (
										<tr class="hover:bg-white/5 transition-all group border-l-2 border-l-transparent hover:border-l-indigo-500">
											<td class="px-6 py-5">
												<div class="flex items-center gap-4">
													<span class="text-slate-600 font-mono text-[10px] w-6 shrink-0">
														{asset.rank.toString().padStart(2, "0")}
													</span>
													<img
														src={asset.image}
														alt={asset.name}
														class="w-6 h-6 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
													/>
													<div>
														<div class="font-black text-white text-[13px] uppercase tracking-tight">
															{asset.name}
														</div>
														<div class="label-mono text-[9px] opacity-40">
															{asset.symbol.toUpperCase()}
														</div>
													</div>
												</div>
											</td>
											<td class="px-6 py-5 text-right font-mono font-black text-slate-200 text-xs">
												{formatCurrency(asset.price)}
											</td>
											<td class="px-6 py-5 text-right">
												<span
													class={`font-mono text-[11px] font-black ${
														asset.change24h >= 0
															? "text-emerald-400"
															: "text-rose-400"
													}`}
												>
													{asset.change24h >= 0 ? "+" : ""}
													{(asset.change24h ?? 0).toFixed(2)}%
												</span>
											</td>
											<td class="px-6 py-5 text-right font-mono text-xs text-slate-400">
												{formatCompact(asset.marketCap)}
											</td>
											<td class="px-6 py-5 text-right text-slate-500 font-mono text-xs hidden md:table-cell">
												{formatCompact(asset.volume24h)}
											</td>
										</tr>
									)}
								</For>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default AssetTable;
