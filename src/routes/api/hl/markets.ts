import { json } from "@solidjs/router";
import { getAddress, getHL, HL_NETWORK_LABEL } from "../../../lib/hyperliquid";

interface MarketInfo {
	symbol: string;
	szDecimals: number;
	maxLeverage: number;
	mid: string | null;
}

export async function GET() {
	try {
		const hl = getHL();
		const [meta, mids] = await Promise.all([hl.info.meta(), hl.info.allMids()]);

		const markets: MarketInfo[] = meta.universe
			.filter((u) => !u.isDelisted)
			.map((u) => ({
				symbol: u.name,
				szDecimals: u.szDecimals,
				maxLeverage: u.maxLeverage,
				mid: mids[u.name] ?? null,
			}))
			.sort((a, b) => a.symbol.localeCompare(b.symbol));

		return json({
			network: HL_NETWORK_LABEL,
			address: await getAddress(),
			markets,
		});
	} catch (e) {
		console.error("Failed to load Hyperliquid markets:", e);
		const message = e instanceof Error ? e.message : "Failed to load markets";
		return json({ error: message }, { status: 500 });
	}
}
