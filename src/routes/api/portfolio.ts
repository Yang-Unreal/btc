import { json } from "@solidjs/router";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_FILE = join(process.cwd(), "src", "data", "portfolio.json");

interface Transaction {
	id: string;
	ticker: string;
	type: "BUY" | "SELL";
	amount: number;
	price: number;
	fee: number;
	date: string;
}

interface AssetHolding {
	amount: number;
	totalCost: number;
	averageBuyPrice: number;
	realizedPnL: number;
}

interface PortfolioData {
	transactions: Transaction[];
	favorites: string[];
}

export async function GET() {
	try {
		let rawData: PortfolioData = { transactions: [], favorites: [] };
		try {
			const fileContent = await readFile(DATA_FILE, "utf-8");
			rawData = JSON.parse(fileContent);
		} catch {
			// ignore
		}

		if (!rawData.transactions) rawData.transactions = [];
		if (!rawData.favorites) rawData.favorites = [];

		console.log("Loading portfolio from:", DATA_FILE);
		console.log("Raw transactions count:", rawData.transactions.length);

		const holdings: Record<string, AssetHolding> = {};

		// Compute Aggregates from History
		// Sort Ascending for calculation
		const sorted = [...rawData.transactions].sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
		);

		for (const tx of sorted) {
			if (!holdings[tx.ticker]) {
				holdings[tx.ticker] = {
					amount: 0,
					totalCost: 0,
					averageBuyPrice: 0,
					realizedPnL: 0,
				};
			}

			const h = holdings[tx.ticker];

			if (tx.type === "BUY") {
				const cost = tx.amount * tx.price + (tx.fee || 0);
				h.totalCost += cost;
				h.amount += tx.amount;
				h.averageBuyPrice = h.totalCost / h.amount; // Weighted Avg
			} else if (tx.type === "SELL") {
				// Reduce amount
				h.amount -= tx.amount;
				if (h.amount < 0) h.amount = 0; // Sanity check

				// Cost Basis reduction
				// Cost removed = amount sold * average buy price
				// Note: Fees on SELL are expenses, they increase realized LOSS or decrease GAIN.
				const costBasisRemoved = tx.amount * h.averageBuyPrice;
				h.totalCost -= costBasisRemoved;

				// Realized PnL = Proceeds - Cost Basis - Fee
				const proceeds = tx.amount * tx.price;
				const pnl = proceeds - costBasisRemoved - (tx.fee || 0);
				h.realizedPnL += pnl;
			}
		}

		return json({
			transactions: rawData.transactions,
			holdings,
			favorites: rawData.favorites,
		});
	} catch (e) {
		console.error(e);
		return json({ error: "Failed to fetch portfolio" }, { status: 500 });
	}
}

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { type, ticker, amount, price, fee = 0 } = body;

		let rawData: PortfolioData = { transactions: [], favorites: [] };
		try {
			const fileContent = await readFile(DATA_FILE, "utf-8");
			rawData = JSON.parse(fileContent);
		} catch {
			// ignore
		}
		if (!rawData.transactions) rawData.transactions = [];
		if (!rawData.favorites) rawData.favorites = [];

		if (type === "TOGGLE_FAVORITE") {
			const idx = rawData.favorites.indexOf(ticker);
			if (idx > -1) {
				rawData.favorites.splice(idx, 1);
			} else {
				rawData.favorites.push(ticker);
			}
		} else if (type === "DELETE") {
			// Delete transaction by ID
			const { id } = body;
			rawData.transactions = rawData.transactions.filter((tx) => tx.id !== id);
		} else if (type === "UPDATE") {
			// Update existing transaction
			const { id, ticker, txType, amount, price, fee } = body;
			const txIndex = rawData.transactions.findIndex((tx) => tx.id === id);
			if (txIndex !== -1) {
				rawData.transactions[txIndex] = {
					...rawData.transactions[txIndex],
					ticker,
					type: txType,
					amount: Number(amount),
					price: Number(price),
					fee: Number(fee),
				};
			}
			// Re-sort after update
			rawData.transactions.sort(
				(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
			);
		} else {
			// BUY / SELL logic
			const newTx: Transaction = {
				id: randomUUID(),
				date: new Date().toISOString(),
				ticker,
				type,
				amount: Number(amount),
				price: Number(price),
				fee: Number(fee),
			};

			rawData.transactions.push(newTx);
			// Sort by date desc for storage/display
			rawData.transactions.sort(
				(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
			);
		}

		await writeFile(DATA_FILE, JSON.stringify(rawData, null, 2));

		return json({ success: true });
	} catch (e) {
		console.error(e);
		return json({ error: "Failed to update portfolio" }, { status: 500 });
	}
}
