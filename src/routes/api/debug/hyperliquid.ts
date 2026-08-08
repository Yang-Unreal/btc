import { json } from "@solidjs/router";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function GET() {
	const diagnostics: Record<string, unknown> = {
		nodeVersion: process.version,
		platform: process.platform,
		arch: process.arch,
		env: {
			HL_PRIVATE_KEY_isSet: !!process.env.HL_PRIVATE_KEY,
			HL_PRIVATE_KEY_length: process.env.HL_PRIVATE_KEY?.length ?? 0,
			HL_TESTNET_isSet: !!process.env.HL_TESTNET,
			HL_TESTNET_value: process.env.HL_TESTNET ?? "(undefined)",
			allHlVars: Object.keys(process.env)
				.filter((k) => /^(HL|HYPERLIQUID)/.test(k))
				.sort(),
		},
	};

	try {
		const rootNoble = join("/app", ".output", "server", "node_modules", "@noble", "hashes");
		const pkgPath = join(rootNoble, "package.json");

		diagnostics.patch = {
			rootCryptoExists: existsSync(join(rootNoble, "crypto.js")),
			rootExportsCrypto: false,
			nitroCryptoExists: existsSync(
				join("/app", ".output", "server", "node_modules", ".nitro", "@noble", "hashes@1.8.0", "crypto.js"),
			),
		};

		if (existsSync(pkgPath)) {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
			diagnostics.patch.rootExportsCrypto = Boolean(pkg.exports?.["./crypto"]);
		}

		const mod = await import("@noble/hashes/crypto");
		diagnostics.moduleResolution = {
			resolvable: true,
			hasCryptoExport: typeof mod?.crypto !== "undefined",
		};
	} catch (e) {
		diagnostics.moduleResolution = {
			resolvable: false,
			error: e instanceof Error ? e.message : String(e),
		};
	}

	try {
		const {
			getAddress,
			getHL,
			HL_NETWORK_LABEL,
		} = await import("../../../lib/hyperliquid");
		const hl = getHL();
		const address = await getAddress();
		const meta = await hl.info.meta();
		diagnostics.hyperliquid = {
			network: HL_NETWORK_LABEL,
			address,
			marketsAvailable: meta.universe.filter((u: { isDelisted?: boolean }) => !u.isDelisted).length,
		};
	} catch (e) {
		diagnostics.hyperliquid = {
			error: e instanceof Error ? e.message : String(e),
		};
	}

	return json(diagnostics);
}
