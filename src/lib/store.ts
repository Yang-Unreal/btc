import { createRoot, createSignal } from "solid-js";

interface AssetHolding {
	amount: number;
	averageBuyPrice: number;
	totalCost: number;
	realizedPnL: number;
}

function createGlobalStore() {
	const [loaded, setLoaded] = createSignal(false);
	const [portfolio, setPortfolio] = createSignal<Record<string, AssetHolding>>(
		{},
	);
	const [portfolioLoaded, setPortfolioLoaded] = createSignal(false);

	const loadSettings = async () => {
		try {
			await fetch("/api/settings");
		} catch {
			// ignore
		} finally {
			setLoaded(true);
		}
	};

	const loadPortfolio = async () => {
		try {
			const res = await fetch("/api/portfolio");
			const data = await res.json();
			if (data.holdings) {
				setPortfolio(data.holdings);
			}
		} catch (e) {
			console.error("Failed to load portfolio:", e);
		} finally {
			setPortfolioLoaded(true);
		}
	};

	return {
		loadSettings,
		loaded,
		portfolio,
		setPortfolio,
		loadPortfolio,
		portfolioLoaded,
	};
}

export const globalStore = createRoot(createGlobalStore);
