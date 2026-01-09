import { createRoot, createSignal } from "solid-js";

function createGlobalStore() {
	const [currency, setCurrency] = createSignal<"USD" | "EUR">("USD");
	const [loaded, setLoaded] = createSignal(false);

	const loadSettings = async () => {
		try {
			const res = await fetch("/api/settings");
			const data = await res.json();
			if (data.currency && data.currency !== currency()) {
				setCurrency(data.currency);
				localStorage.setItem("currency", data.currency);
			}
		} catch (e) {
			// On error, load from localStorage
			const stored =
				typeof localStorage !== "undefined"
					? localStorage.getItem("currency")
					: null;
			if (stored === "USD" || stored === "EUR") {
				setCurrency(stored);
			}
			console.error("Failed to load settings:", e);
		} finally {
			setLoaded(true);
		}
	};

	const saveCurrency = async (newCurrency: "USD" | "EUR") => {
		setCurrency(newCurrency);
		localStorage.setItem("currency", newCurrency);
		try {
			await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ currency: newCurrency }),
			});
		} catch (e) {
			console.error("Failed to save currency:", e);
		}
	};

	return { currency, setCurrency: saveCurrency, loadSettings, loaded };
}

export const globalStore = createRoot(createGlobalStore);
