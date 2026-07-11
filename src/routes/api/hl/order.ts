import { json } from "@solidjs/router";
import { formatPrice, formatSize } from "@nktkas/hyperliquid/utils";
import { getConverter, getHL } from "../../../lib/hyperliquid";

/** Price buffer applied to the mid to ensure an aggressive market fill. */
const PRICE_TOLERANCE = 0.01; // 1%

interface OrderRequestBody {
	coin?: unknown;
	isBuy?: unknown;
	size?: unknown;
	leverage?: unknown;
}

function parseBool(value: unknown): boolean {
	return value === true || value === "true" || value === "1";
}

export async function POST({ request }: { request: Request }) {
	try {
		const body = (await request.json()) as OrderRequestBody;

		const coin = typeof body.coin === "string" ? body.coin.trim() : "";
		if (!coin) {
			return json({ error: "coin is required" }, { status: 400 });
		}

		const isBuy = parseBool(body.isBuy);
		const size = Number(body.size);
		if (!Number.isFinite(size) || size <= 0) {
			return json({ error: "size must be a number greater than 0" }, { status: 400 });
		}

		let leverage = Number(body.leverage);
		if (!Number.isFinite(leverage) || leverage <= 0) {
			leverage = 10;
		}
		leverage = Math.min(Math.floor(leverage), 100);

		const converter = await getConverter();
		const assetId = converter.getAssetId(coin);
		if (assetId === undefined) {
			return json({ error: `Unknown or unsupported coin: ${coin}` }, { status: 400 });
		}
		const szDecimals = converter.getSzDecimals(coin) ?? 0;

		const hl = getHL();

		// Leverage is persisted on the account, but we set it explicitly each
		// time to guarantee the requested leverage for the new position.
		await hl.exchange.updateLeverage({
			asset: assetId,
			isCross: true,
			leverage,
		});

		const mids = await hl.info.allMids();
		const midStr = mids[coin];
		if (!midStr) {
			return json({ error: `No market price available for ${coin}` }, { status: 400 });
		}
		const mid = Number(midStr);
		if (!Number.isFinite(mid) || mid <= 0) {
			return json({ error: `Invalid market price for ${coin}` }, { status: 400 });
		}

		const price = mid * (isBuy ? 1 + PRICE_TOLERANCE : 1 - PRICE_TOLERANCE);
		const priceStr = formatPrice(price, szDecimals);
		const sizeStr = formatSize(size, szDecimals);

		const result = await hl.exchange.order({
			orders: [
				{
					a: assetId,
					b: isBuy,
					p: priceStr,
					s: sizeStr,
					r: false,
					t: { limit: { tif: "Ioc" } },
				},
			],
			grouping: "na",
		});

		return json({ result });
	} catch (e) {
		console.error("Hyperliquid order failed:", e);
		const message = e instanceof Error ? e.message : "Order placement failed";
		return json({ error: message }, { status: 500 });
	}
}
