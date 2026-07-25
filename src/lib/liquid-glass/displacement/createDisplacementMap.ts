import type {
	DisplacementMap,
	DisplacementMapParams,
	DisplacementMapStats
} from '../liquidGlass.types.js';
import {
	MAP_CACHE_LIMIT,
	MAX_MAP_DIMENSION,
	MIN_MAP_DIMENSION,
	SIZE_QUANTUM
} from '../runtime/glassTokens.js';
import { sampleRoundedBox } from './roundedBoxSdf.js';
import { getMagnitudeLut, sampleLut } from './surfaceProfiles.js';

/**
 * Rasterises the refraction field into a PNG data URL consumable by
 * `<feImage href>`, and caches the result.
 *
 * Encoding follows the `feDisplacementMap` convention: horizontal offset in the
 * red channel, vertical offset in the green channel, 128 meaning "no shift".
 * Blue and alpha are unused by the filter but written as 128/255 so the map is a
 * valid, inspectable image.
 *
 * The whole module is synchronous. `OffscreenCanvas` would buy nothing on the
 * main thread, and `toDataURL` staying sync means a caller can never observe two
 * in-flight generations racing for the same element.
 */

/**
 * One canvas is created lazily and resized in place for every map. Allocating a
 * canvas per call is the single most expensive thing this module could do.
 */
let scratchCanvas: HTMLCanvasElement | null = null;
let scratchContext: CanvasRenderingContext2D | null = null;

const cache = new Map<string, DisplacementMap>();
const stats: DisplacementMapStats = { generations: 0, hits: 0, cacheSize: 0 };

/** Snapshot of cache activity, for debug panels and tests. */
export function getDisplacementMapStats(): DisplacementMapStats {
	return { generations: stats.generations, hits: stats.hits, cacheSize: cache.size };
}

export function clearDisplacementMapCache(): void {
	cache.clear();
	stats.generations = 0;
	stats.hits = 0;
	stats.cacheSize = 0;
}

/**
 * Round to a multiple of `SIZE_QUANTUM` so a continuous resize steps instead of
 * thrashing. Exported so callers can quantise *before* storing a measured size
 * in reactive state, keeping sub-pixel resize noise from causing re-renders.
 */
export function quantiseSize(value: number): number {
	return Math.round(value / SIZE_QUANTUM) * SIZE_QUANTUM;
}

const quantise = quantiseSize;

/**
 * Clamp the raw props into a geometry that is actually renderable, and quantise
 * it. The result doubles as the cache identity.
 */
function normaliseParams(params: DisplacementMapParams): DisplacementMapParams {
	const width = Math.max(MIN_MAP_DIMENSION, quantise(params.width));
	const height = Math.max(MIN_MAP_DIMENSION, quantise(params.height));
	const limit = Math.min(width, height) / 2;

	return {
		width,
		height,
		radius: Math.min(quantise(Math.max(0, params.radius)), limit),
		bezel: Math.max(1, Math.min(quantise(Math.max(1, params.bezel)), limit)),
		profile: params.profile,
		resolution: params.resolution
	};
}

function cacheKey(p: DisplacementMapParams): string {
	return `${p.width}x${p.height}|r${p.radius}|b${p.bezel}|${p.profile}|q${p.resolution}`;
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

/**
 * Paint the field into `data`.
 *
 * Cost is `O(mapWidth × mapHeight)`, but the inner loop is a handful of
 * arithmetic ops plus one LUT lookup — no allocation, no trigonometry (that all
 * happened once, when the LUT was built).
 */
function paint(
	data: Uint8ClampedArray,
	mapWidth: number,
	mapHeight: number,
	p: DisplacementMapParams
): void {
	const lut = getMagnitudeLut(p.profile);
	const halfWidth = p.width / 2;
	const halfHeight = p.height / 2;
	const scaleX = p.width / mapWidth;
	const scaleY = p.height / mapHeight;

	for (let py = 0; py < mapHeight; py += 1) {
		// Sample at pixel centres so the field is symmetric about the element.
		const y = (py + 0.5) * scaleY - halfHeight;

		for (let px = 0; px < mapWidth; px += 1) {
			const x = (px + 0.5) * scaleX - halfWidth;
			const offset = (py * mapWidth + px) * 4;

			const { depth, normalX, normalY } = sampleRoundedBox(x, y, halfWidth, halfHeight, p.radius);

			let r = 128;
			let g = 128;

			// Outside the outline, or past the bezel into the flat centre: neutral.
			if (depth >= 0 && depth < p.bezel) {
				const magnitude = sampleLut(lut, depth / p.bezel);
				r = 128 + normalX * magnitude * 127;
				g = 128 + normalY * magnitude * 127;
			}

			data[offset] = r;
			data[offset + 1] = g;
			data[offset + 2] = 128;
			data[offset + 3] = 255;
		}
	}
}

/**
 * Generate — or retrieve from cache — the displacement map for a geometry.
 *
 * Returns `null` on the server or when the geometry is degenerate; callers fall
 * back to the non-refracting tier in that case.
 *
 * Maps are stored as data URLs rather than object URLs on purpose: LRU eviction
 * would otherwise have to revoke every dropped URL, and a single missed revoke
 * is a permanent leak. The cost is a base64 string per entry (~25 kB for a
 * 320×80 element at `resolution: 0.75`) plus one PNG decode on first paint.
 */
export function getDisplacementMap(params: DisplacementMapParams): DisplacementMap | null {
	if (typeof document === 'undefined') return null;

	const normalised = normaliseParams(params);
	const key = cacheKey(normalised);

	const cached = cache.get(key);
	if (cached) {
		// Re-insert to refresh recency for the LRU.
		cache.delete(key);
		cache.set(key, cached);
		stats.hits += 1;
		return cached;
	}

	const mapWidth = clampDimension(normalised.width * normalised.resolution);
	const mapHeight = clampDimension(normalised.height * normalised.resolution);

	const context = getContext(mapWidth, mapHeight);
	if (!context) return null;

	const imageData = context.createImageData(mapWidth, mapHeight);
	paint(imageData.data, mapWidth, mapHeight, normalised);
	context.putImageData(imageData, 0, 0);

	const map: DisplacementMap = {
		url: context.canvas.toDataURL('image/png'),
		width: mapWidth,
		height: mapHeight
	};

	cache.set(key, map);
	stats.generations += 1;

	if (cache.size > MAP_CACHE_LIMIT) {
		// Map iteration order is insertion order, so the first key is the LRU.
		const oldest = cache.keys().next();
		if (!oldest.done) cache.delete(oldest.value);
	}

	return map;
}

function clampDimension(value: number): number {
	return Math.min(MAX_MAP_DIMENSION, Math.max(MIN_MAP_DIMENSION, Math.round(value)));
}
