import { formatCryptoPrice } from "./src/lib/format";

const testCases = [
	{ price: 65000.5, expected: "$65,000.50" },
	{ price: 1.25, expected: "$1.25" },
	{ price: 0.1234, expected: "$0.1234" },
	{ price: 0.00012345, expected: "$0.00012345" },
	{ price: 0.000006588, expected: "$0.0₅6588" },
	{ price: 0.00000000123, expected: "$0.0₈123" },
	{ price: 0.000000000000123, expected: "$0.0₁₂123" },
];

console.log("Running Price Format Tests...");
let failed = false;

for (const { price, expected } of testCases) {
	const actual = formatCryptoPrice(price).replace(/\s/g, " ");
	const normalizedExpected = expected.replace(/\s/g, " ");
	if (actual === normalizedExpected) {
		console.log(`✅ [PASS] ${price} -> ${actual}`);
	} else {
		console.error(
			`❌ [FAIL] ${price}: Expected "${normalizedExpected}", got "${actual}"`,
		);
		failed = true;
	}
}

if (failed) {
	process.exit(1);
} else {
	console.log("All tests passed!");
}
