import {
	ExchangeClient,
	HttpTransport,
	InfoClient,
} from "@nktkas/hyperliquid";
import { type AbstractWallet, getWalletAddress } from "@nktkas/hyperliquid/signing";
import type { SymbolConverter } from "@nktkas/hyperliquid/utils";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Hyperliquid network selection. Defaults to testnet per project decision.
 * Set `HL_TESTNET=false` in the environment to target mainnet (real funds).
 */
const USE_TESTNET = (process.env.HL_TESTNET ?? "true") !== "false";

export const HL_NETWORK_LABEL = USE_TESTNET ? "Testnet" : "Mainnet";

interface HLClients {
	transport: HttpTransport;
	info: InfoClient;
	exchange: ExchangeClient;
	wallet: AbstractWallet;
	converter: SymbolConverter | null;
}

let cached: HLClients | null = null;

/**
 * Lazily build (and cache) the Hyperliquid clients.
 *
 * Throws a clear error at call time (not import time) when the private key is
 * missing, so SSR/route registration never crashes. The key is read from the
 * server environment only and is never exposed to the browser.
 */
/**
 * Strip the noise that commonly leaks into `.env` values: surrounding quotes,
 * leading/trailing whitespace, and Windows CRLF line endings. Returns a
 * `0x`-prefixed hex string suitable for viem's `privateKeyToAccount`.
 */
function normalizePrivateKey(raw: string): `0x${string}` {
	// Drop any non-ASCII characters (BOM, zero-width spaces, NBSP, etc.) that
	// commonly sneak in via copy/paste or a BOM-prefixed .env file, then keep
	// only hex digits. This makes the key tolerant of stray invisible noise
	// while still guaranteeing a clean 64-char value.
	const ascii = raw.replace(/[^\x00-\x7F]/g, "");
	const body = ascii.trim().replace(/^0x/i, "").replace(/[^0-9a-fA-F]/g, "");

	if (body.length !== 64) {
		throw new Error(
			`HL_PRIVATE_KEY must be 64 hex characters, but ${body.length} were found after stripping whitespace/quotes. Verify the value is the private key (not the wallet address) and contains no extra characters.`,
		);
	}

	return `0x${body}` as `0x${string}`;
}

export function getHL(): HLClients {
	if (cached) {
		return cached;
	}

	const rawKey = process.env.HL_PRIVATE_KEY;
	if (!rawKey) {
		throw new Error(
			"HL_PRIVATE_KEY is not configured on the server. Add it to your .env file.",
		);
	}

	const key = normalizePrivateKey(rawKey);
	const transport = new HttpTransport({ isTestnet: USE_TESTNET });
	let wallet: AbstractWallet;
	try {
		wallet = privateKeyToAccount(key);
	} catch {
		throw new Error(
			"HL_PRIVATE_KEY is malformed. It must be exactly 64 hex characters (optionally 0x-prefixed), with no surrounding quotes, spaces, or trailing newlines.",
		);
	}

	cached = {
		transport,
		info: new InfoClient({ transport }),
		exchange: new ExchangeClient({ transport, wallet }),
		wallet,
		converter: null,
	};

	return cached;
}

export async function getAddress(): Promise<string> {
	return getWalletAddress(getHL().wallet);
}

/**
 * Resolve (and cache) the symbol converter used to map coin names to asset
 * IDs and size decimals.
 */
export async function getConverter(): Promise<SymbolConverter> {
	const hl = getHL();
	if (!hl.converter) {
		const { SymbolConverter } = await import("@nktkas/hyperliquid/utils");
		hl.converter = await SymbolConverter.create({ transport: hl.transport });
	}
	return hl.converter;
}
