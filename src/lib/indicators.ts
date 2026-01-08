export const calculateSMA = (data: number[], period: number): number[] => {
	if (data.length < period) return Array(data.length).fill(NaN);
	const sma: number[] = [];
	for (let i = 0; i < period - 1; i++) sma.push(NaN);
	for (let i = period - 1; i < data.length; i++) {
		let sum = 0;
		for (let j = 0; j < period; j++) {
			sum += data[i - j];
		}
		sma.push(sum / period);
	}
	return sma;
};

export const calculateEMA = (data: number[], period: number): number[] => {
	if (data.length < period) return [];
	const ema: number[] = [];
	const multiplier = 2 / (period + 1);
	let sum = 0;
	for (let i = 0; i < period; i++) sum += data[i];
	let emaValue = sum / period;
	for (let i = 0; i < period - 1; i++) ema.push(NaN);
	ema.push(emaValue);
	for (let i = period; i < data.length; i++) {
		emaValue = (data[i] - emaValue) * multiplier + emaValue;
		ema.push(emaValue);
	}
	return ema;
};

export const calculateDonchianHigh = (
	highs: number[],
	period: number,
): number[] => {
	if (highs.length < period) return Array(highs.length).fill(NaN);
	const result: number[] = [];
	for (let i = 0; i < period - 1; i++) result.push(NaN);
	for (let i = period - 1; i < highs.length; i++) {
		let max = -Infinity;
		for (let j = 0; j < period; j++) {
			max = Math.max(max, highs[i - j]);
		}
		result.push(max);
	}
	return result;
};

export const calculateRSI = (data: number[], period = 14): number[] => {
	if (data.length <= period) return Array(data.length).fill(NaN);
	const rsiArray: number[] = [];
	let gains = 0;
	let losses = 0;
	for (let i = 1; i <= period; i++) {
		const change = data[i] - data[i - 1];
		if (change >= 0) gains += change;
		else losses += Math.abs(change);
	}
	let avgGain = gains / period;
	let avgLoss = losses / period;
	for (let i = 0; i < period; i++) rsiArray.push(NaN);
	let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
	rsiArray.push(100 - 100 / (1 + rs));
	for (let i = period + 1; i < data.length; i++) {
		const change = data[i] - data[i - 1];
		const currentGain = change > 0 ? change : 0;
		const currentLoss = change < 0 ? Math.abs(change) : 0;
		avgGain = (avgGain * (period - 1) + currentGain) / period;
		avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
		rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
		rsiArray.push(100 - 100 / (1 + rs));
	}
	return rsiArray;
};

// Helper to find simple Swing Highs/Lows
// A swing high is a high that is higher than N bars before and M bars after.
// Since we are looking for "Break previous Swing High" in real time,
// we usually look for the last confirmed swing high.
// A simple definition: Highest point in the last X bars, subject to it being a local max.
// For this simplified version, let's use a function that returns the Price of the last Swing High.
// Pivot High: High[i] > High[i-1]...High[i-left] AND High[i] > High[i+1]...High[i+right]
export const findLastSwingHigh = (
	highs: number[],
	left = 5,
	right = 5,
): number | null => {
	// Iterate backwards from the end
	for (let i = highs.length - 1 - right; i >= left; i--) {
		let isHigh = true;
		for (let j = 1; j <= left; j++) {
			if (highs[i - j] > highs[i]) {
				isHigh = false;
				break;
			}
		}
		if (!isHigh) continue;
		for (let j = 1; j <= right; j++) {
			if (highs[i + j] > highs[i]) {
				isHigh = false;
				break;
			}
		}
		if (isHigh) return highs[i];
	}
	return null;
};

export const findLastSwingLow = (
	lows: number[],
	left = 5,
	right = 5,
): number | null => {
	// Iterate backwards from the end
	for (let i = lows.length - 1 - right; i >= left; i--) {
		let isLow = true;
		for (let j = 1; j <= left; j++) {
			if (lows[i - j] < lows[i]) {
				isLow = false;
				break;
			}
		}
		if (!isLow) continue;
		for (let j = 1; j <= right; j++) {
			if (lows[i + j] < lows[i]) {
				isLow = false;
				break;
			}
		}
		if (isLow) return lows[i];
	}
	return null;
};
