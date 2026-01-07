const SUBSCRIPTS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

/**
 * Formats a number into a subscript notation for leading zeros.
 * Example: 0.000006588 -> $0.0₅6588
 */
export function formatCryptoPrice(price: number, symbol = "$"): string {
	if (price === 0) return `${symbol}0.00`;
	if (price >= 0.0001) {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			maximumFractionDigits: price < 1 ? 4 : 2,
		})
			.format(price)
			.replace("$", symbol);
	}

	// For very small numbers
	const priceStr = price.toFixed(20);
	const match = priceStr.match(/^0\.(0+)/);
	if (!match) return `${symbol}${price.toFixed(4)}`;

	const zerosCount = match[1].length;
	if (zerosCount <= 4) {
		// For small but not "subscript-small" numbers, show up to 8 decimals but trim trailing zeros
		return `${symbol}${price.toFixed(8).replace(/\.?0+$/, "")}`;
	}

	const significantPart = priceStr.slice(match[0].length).replace(/0+$/, "");
	// Take up to 4 significant digits
	const displayDigits = significantPart.slice(0, 4);

	const subscriptCount = zerosCount
		.toString()
		.split("")
		.map((d) => SUBSCRIPTS[Number.parseInt(d)])
		.join("");

	return `${symbol}0.0${subscriptCount}${displayDigits}`;
}

/**
 * Formats large numbers into a compact form (e.g., 1.2M, 500K)
 */
export function formatCompact(val: number) {
	return new Intl.NumberFormat("en-US", {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(val);
}
