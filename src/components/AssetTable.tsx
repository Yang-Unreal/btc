import { createSignal, For, onMount, type Component } from "solid-js";

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
    <div class="mb-12">
      <div class="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 tracking-tight">Market Overview</h2>
          <p class="text-slate-500 mt-1">
            Real-time market capitalization and performance metrics.
          </p>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ring-1 ring-slate-100">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                <th class="px-6 py-4 font-semibold">Asset</th>
                <th class="px-6 py-4 font-semibold text-right">Price</th>
                <th class="px-6 py-4 font-semibold text-right">24h Change</th>
                <th class="px-6 py-4 font-semibold text-right">Market Cap</th>
                <th class="px-6 py-4 font-semibold text-right hidden md:table-cell">Volume (24h)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {loading() ? (
                 // Skeleton Loading Rows
                <For each={Array(5).fill(0)}>
                  {() => (
                    <tr class="animate-pulse">
                      <td class="px-6 py-4"><div class="h-6 w-24 bg-slate-100 rounded"></div></td>
                      <td class="px-6 py-4"><div class="h-6 w-20 bg-slate-100 rounded ml-auto"></div></td>
                      <td class="px-6 py-4"><div class="h-6 w-16 bg-slate-100 rounded ml-auto"></div></td>
                      <td class="px-6 py-4"><div class="h-6 w-24 bg-slate-100 rounded ml-auto"></div></td>
                      <td class="px-6 py-4 hidden md:table-cell"><div class="h-6 w-24 bg-slate-100 rounded ml-auto"></div></td>
                    </tr>
                  )}
                </For>
              ) : (
                <For each={assets()}>
                  {(asset) => (
                    <tr class="hover:bg-slate-50/80 transition-colors group">
                      <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                          <span class="text-slate-400 font-mono text-xs w-4">#{asset.rank}</span>
                          <img src={asset.image} alt={asset.name} class="w-8 h-8 rounded-full" />
                          <div>
                            <div class="font-bold text-slate-800">{asset.name}</div>
                            <div class="text-xs text-slate-400 font-medium">{asset.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td class="px-6 py-4 text-right font-mono font-medium text-slate-700">
                        {formatCurrency(asset.price)}
                      </td>
                      <td class="px-6 py-4 text-right">
                        <span
                          class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            asset.change24h >= 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {asset.change24h >= 0 ? "+" : ""}
                          {asset.change24h.toFixed(2)}%
                        </span>
                      </td>
                      <td class="px-6 py-4 text-right font-medium text-slate-600">
                        {formatCompact(asset.marketCap)}
                      </td>
                      <td class="px-6 py-4 text-right text-slate-500 text-sm hidden md:table-cell">
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
