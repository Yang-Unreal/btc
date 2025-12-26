// Simple in-memory cache with TTL for API responses
interface CacheEntry {
	data: unknown;
	timestamp: number;
	ttl: number;
}

class SimpleCache {
	private cache = new Map<string, CacheEntry>();

	set<T>(key: string, data: T, ttlMs: number = 60000): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl: ttlMs,
		});
	}

	get<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		if (Date.now() - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			return null;
		}

		return entry.data as T;
	}

	clear(): void {
		this.cache.clear();
	}

	size(): number {
		return this.cache.size;
	}
}

// Global cache instance
export const apiCache = new SimpleCache();

// Cache durations for different endpoints
export const CACHE_DURATIONS = {
	// Market data changes frequently, cache for 30 seconds
	MARKET_DATA: 30 * 1000,
	// Price data, cache for 10 seconds
	PRICE_DATA: 10 * 1000,
	// Historical data, cache for 5 minutes
	HISTORICAL_DATA: 5 * 60 * 1000,
} as const;
