import { writeFileSync, existsSync, copyFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const nobleRoot = join(projectRoot, "node_modules", "@noble", "hashes");
const packageJsonPath = join(nobleRoot, "package.json");

const sourcePaths = [
	join(projectRoot, "node_modules", "viem", "node_modules", "@noble", "hashes", "crypto.js"),
	join(projectRoot, "node_modules", "@noble", "curves", "node_modules", "@noble", "hashes", "crypto.js"),
	join(projectRoot, "node_modules", "ox", "node_modules", "@noble", "hashes", "crypto.js"),
];

const targetPath = join(nobleRoot, "crypto.js");

let source = sourcePaths.find((p) => existsSync(p));
if (!source) {
	console.warn("[patch-noble-hashes] No crypto.js found, skipping patch.");
	process.exit(0);
}

const original = readFileSync(source, "utf8");
const esmCrypto = original
	.replace(
		/Object\.defineProperty\(exports,\s*"__esModule",\s*\{[^}]+\}\);/,
		"",
	)
	.replace(/exports\.(crypto)\s*=\s*void\s*0;/, "")
	.replace(
		/exports\.(crypto)\s*=\s*typeof\s+globalThis\s*===\s*["']object["']\s*&&\s*["']crypto["']\s*in\s+globalThis\s*\?\s*globalThis\.crypto\s*:\s*undefined;?/,
		"export const crypto = typeof globalThis === \"object\" && \"crypto\" in globalThis ? globalThis.crypto : undefined;",
	);

writeFileSync(targetPath, esmCrypto, "utf8");

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
let changed = false;

if (!pkg.exports) {
	pkg.exports = {};
	changed = true;
}

if (!pkg.exports["./crypto"]) {
	pkg.exports["./crypto"] = "./crypto.js";
	changed = true;
}

if (changed) {
	writeFileSync(packageJsonPath, JSON.stringify(pkg, null, "\t") + "\n");
	console.log(`[patch-noble-hashes] Added ./crypto to exports`);
}

console.log(`[patch-noble-hashes] Wrote ESM crypto.js`);

// Patch Nitro bundled copy too
const nitro188 = join(
	projectRoot,
	".output",
	"server",
	"node_modules",
	".nitro",
	"@noble",
	"hashes@1.8.0",
);
if (existsSync(nitro188)) {
	writeFileSync(join(nitro188, "crypto.js"), esmCrypto, "utf8");
	console.log(`[patch-noble-hashes] Patched Nitro @noble/hashes@1.8.0/crypto.js`);
}

const outputNobleRoot = join(projectRoot, ".output", "server", "node_modules", "@noble", "hashes");
if (existsSync(outputNobleRoot)) {
	writeFileSync(join(outputNobleRoot, "crypto.js"), esmCrypto, "utf8");
	console.log(`[patch-noble-hashes] Patched .output/server/node_modules/@noble/hashes/crypto.js`);
}
