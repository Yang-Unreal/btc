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

export const calculateATR = (
	data: { high: number; low: number; close: number }[],
	period = 14,
): number[] => {
	if (data.length <= 1) return Array(data.length).fill(NaN);
	const tr: number[] = [NaN];
	for (let i = 1; i < data.length; i++) {
		const h = data[i].high;
		const l = data[i].low;
		const pc = data[i - 1].close;
		tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
	}
	// ATR is typically an EMA or Wilder's MA of TR
	// We'll use EMA for consistency with other indicators here
	const atr: number[] = [];
	const alpha = 1 / period;
	let currentAtr = 0;

	// Initial ATR is average of first 'period' TR values
	let firstSum = 0;
	let validCount = 0;
	for (let i = 1; i <= period && i < tr.length; i++) {
		firstSum += tr[i];
		validCount++;
	}
	currentAtr = firstSum / validCount;

	for (let i = 0; i < tr.length; i++) {
		if (i < period) {
			atr.push(NaN);
		} else if (i === period) {
			atr.push(currentAtr);
		} else {
			currentAtr = (tr[i] - currentAtr) * alpha + currentAtr;
			atr.push(currentAtr);
		}
	}
	return atr;
};

export const calculateMACD = (
	data: number[],
	fast = 12,
	slow = 26,
	signal = 9,
): { macd: number[]; signal: number[]; histogram: number[] } => {
	const fastEMA = calculateEMA(data, fast);
	const slowEMA = calculateEMA(data, slow);

	const macd: number[] = [];
	for (let i = 0; i < data.length; i++) {
		macd.push(fastEMA[i] - slowEMA[i]);
	}

	const signalLine = calculateEMA(
		macd.filter((v) => !Number.isNaN(v)),
		signal,
	);
	const signalResult: number[] = Array(data.length - signalLine.length).fill(
		NaN,
	);
	signalResult.push(...signalLine);

	const histogram: number[] = [];
	for (let i = 0; i < data.length; i++) {
		histogram.push(macd[i] - signalResult[i]);
	}

	return { macd, signal: signalResult, histogram };
};

export const calculateADX = (
	data: { high: number; low: number; close: number }[],
	period = 14,
): { adx: number[]; plusDI: number[]; minusDI: number[] } => {
	if (data.length <= period) {
		return {
			adx: Array(data.length).fill(NaN),
			plusDI: Array(data.length).fill(NaN),
			minusDI: Array(data.length).fill(NaN),
		};
	}

	const tr: number[] = [NaN];
	const plusDM: number[] = [NaN];
	const minusDM: number[] = [NaN];

	for (let i = 1; i < data.length; i++) {
		const h = data[i].high;
		const l = data[i].low;
		const ph = data[i - 1].high;
		const pl = data[i - 1].low;
		const pc = data[i - 1].close;

		tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));

		const upMove = h - ph;
		const downMove = pl - l;

		if (upMove > downMove && upMove > 0) {
			plusDM.push(upMove);
		} else {
			plusDM.push(0);
		}

		if (downMove > upMove && downMove > 0) {
			minusDM.push(downMove);
		} else {
			minusDM.push(0);
		}
	}

	const smooth = (arr: number[], p: number) => {
		const results: number[] = [];
		let sum = 0;
		for (let i = 1; i <= p; i++) sum += arr[i];
		let val = sum / p;
		for (let i = 0; i < p; i++) results.push(NaN);
		results.push(val);
		for (let i = p + 1; i < arr.length; i++) {
			val = (val * (p - 1) + arr[i]) / p;
			results.push(val);
		}
		return results;
	};

	const smoothTR = smooth(tr, period);
	const smoothPlusDM = smooth(plusDM, period);
	const smoothMinusDM = smooth(minusDM, period);

	const plusDI: number[] = [];
	const minusDI: number[] = [];
	const dx: number[] = [];

	for (let i = 0; i < data.length; i++) {
		const trVal = smoothTR[i];
		const pDI = (smoothPlusDM[i] / trVal) * 100;
		const mDI = (smoothMinusDM[i] / trVal) * 100;
		plusDI.push(pDI);
		minusDI.push(mDI);

		const diSum = pDI + mDI;
		const diDiff = Math.abs(pDI - mDI);
		dx.push(diSum === 0 ? 0 : (diDiff / diSum) * 100);
	}

	const adx = smooth(
		dx.filter((v) => !Number.isNaN(v)),
		period,
	);
	const adxResult: number[] = Array(data.length - adx.length).fill(NaN);
	adxResult.push(...adx);

	return { adx: adxResult, plusDI, minusDI };
};

export const calculateVWAP = (
	data: {
		time: number;
		high: number;
		low: number;
		close: number;
		volume: number;
	}[],
): number[] => {
	let cumulativeTPV = 0;
	let cumulativeVolume = 0;
	let lastDayTs = 0;
	const vwap: number[] = [];

	for (const candle of data) {
		const date = new Date(candle.time * 1000);
		const dayTs = date.getUTCDate();

		// Reset at the start of a new UTC day
		if (dayTs !== lastDayTs) {
			cumulativeTPV = 0;
			cumulativeVolume = 0;
			lastDayTs = dayTs;
		}

		const tp = (candle.high + candle.low + candle.close) / 3;
		cumulativeTPV += tp * candle.volume;
		cumulativeVolume += candle.volume;

		if (cumulativeVolume > 0) {
			vwap.push(cumulativeTPV / cumulativeVolume);
		} else {
			vwap.push(tp); // Fallback to Typical Price if no volume
		}
	}

	return vwap;
};
