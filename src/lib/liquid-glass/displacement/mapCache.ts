import type { GlassMap, GlassMapStats } from '../liquidGlass.types.js';
import {
	MAP_CACHE_LIMIT,
	MAX_MAP_DIMENSION,
	MIN_MAP_DIMENSION,
	SIZE_QUANTUM
} from '../runtime/glassTokens.js';

/**
 * Shared rasterisation plumbing for the generated glass textures.
 *
 * Both the displacement field and the specular rim are painted the same way — a
 * per-pixel loop into an `ImageData`, serialised to a PNG data URL — so the
 * canvas, the LRU and the counters live here and each generator only supplies its
 * paint function.
 *
 * Everything is synchronous. `OffscreenCanvas` would buy nothing on the main
 * thread, and `toDataURL` staying sync means a caller can never observe two
 * in-flight generations racing for the same element.
 */

/**
 * One canvas, created lazily and resized in place. Allocating a canvas per call
 * is the single most expensive thing this module could do.
 */
let scratchCanvas: HTMLCanvasElement | null = null;
let scratchContext: CanvasRenderingContext2D | null = null;

const stats = { generations: 0, hits: 0 };
const caches = new Set<Map<string, GlassMap>>();

/** Round to a multiple of `SIZE_QUANTUM` so a continuous resize steps instead of thrashing. */
export function quantiseSize(value: number): number {
	return Math.round(value / SIZE_QUANTUM) * SIZE_QUANTUM;
}

/** Clamp a map dimension into the renderable range. */
export function clampMapDimension(value: number): number {
	return Math.min(MAX_MAP_DIMENSION, Math.max(MIN_MAP_DIMENSION, Math.round(value)));
}

/** Snapshot of cache activity across every generator, for debug panels and tests. */
export function getGlassMapStats(): GlassMapStats {
	let cacheSize = 0;
	for (const cache of caches) cacheSize += cache.size;
	return { generations: stats.generations, hits: stats.hits, cacheSize };
}

export function clearGlassMapCaches(): void {
	for (const cache of caches) cache.clear();
	stats.generations = 0;
	stats.hits = 0;
}

function getContext(width: number, height: number): CanvasRenderingContext2D | null {
	if (!scratchCanvas) {
		scratchCanvas = document.createElement('canvas');
		scratchContext = scratchCanvas.getContext('2d');
	}

	if (scratchCanvas.width !== width) scratchCanvas.width = width;
	if (scratchCanvas.height !== height) scratchCanvas.height = height;

	return scratchContext;
}

export interface MapCache {
	/**
	 * Return the cached map for `key`, or rasterise it by handing `paint` a fresh
	 * `ImageData` buffer to fill. Returns `null` on the server.
	 */
	get(
		key: string,
		width: number,
		height: number,
		paint: (data: Uint8ClampedArray, width: number, height: number) => void
	): GlassMap | null;
}

export function createMapCache(limit = MAP_CACHE_LIMIT): MapCache {
	const cache = new Map<string, GlassMap>();
	caches.add(cache);

	return {
		get(key, width, height, paint) {
			if (typeof document === 'undefined') return null;

			const cached = cache.get(key);
			if (cached) {
				// Re-insert to refresh recency for the LRU.
				cache.delete(key);
				cache.set(key, cached);
				stats.hits += 1;
				return cached;
			}

			const context = getContext(width, height);
			if (!context) return null;

			const imageData = context.createImageData(width, height);
			paint(imageData.data, width, height);
			context.putImageData(imageData, 0, 0);

			const map: GlassMap = {
				url: context.canvas.toDataURL('image/png'),
				width,
				height
			};

			cache.set(key, map);
			stats.generations += 1;

			if (cache.size > limit) {
				// Map iteration order is insertion order, so the first key is the LRU.
				const oldest = cache.keys().next();
				if (!oldest.done) cache.delete(oldest.value);
			}

			return map;
		}
	};
}
