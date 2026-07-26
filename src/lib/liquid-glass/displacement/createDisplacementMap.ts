import type { DisplacementMapParams, GlassMap } from '../liquidGlass.types.js';
import { cornerExponent } from './cornerShape.js';
import { clampMapDimension, createMapCache, quantiseSize } from './mapCache.js';
import { sampleRoundedBox } from './roundedBoxSdf.js';
import { getMagnitudeLut, sampleLut } from './surfaceProfiles.js';

/**
 * Rasterises the refraction field into a PNG data URL consumable by
 * `<feImage href>`.
 *
 * Encoding follows the `feDisplacementMap` convention: horizontal offset in the
 * red channel, vertical offset in the green channel, 128 meaning "no shift".
 * Blue and alpha are unused by the filter but written as 128/255 so the map is a
 * valid, inspectable image.
 */

const cache = createMapCache();

/** Width of the antialiasing ramp just outside the outline, in CSS pixels. */
const EDGE_FEATHER = 1;

/**
 * The renderable form of the params: geometry clamped and quantised, and the
 * corner resolved from its CSS-facing keyword to the exponent the field wants.
 * Doubles as the cache identity.
 */
type NormalisedParams = Omit<DisplacementMapParams, 'cornerShape'> & { exponent: number };

function normaliseParams(params: DisplacementMapParams): NormalisedParams {
	const width = Math.max(4, quantiseSize(params.width));
	const height = Math.max(4, quantiseSize(params.height));
	const limit = Math.min(width, height) / 2;

	return {
		width,
		height,
		radius: Math.min(quantiseSize(Math.max(0, params.radius)), limit),
		// Resolved rather than carried through, so `'round'`, `1` and an omitted
		// value are one cache entry instead of three identical rasterisations.
		exponent: cornerExponent(params.cornerShape ?? 'round'),
		bezel: Math.max(1, Math.min(quantiseSize(Math.max(1, params.bezel)), limit)),
		profile: params.profile,
		resolution: params.resolution
	};
}

function cacheKey(p: NormalisedParams): string {
	return `${p.width}x${p.height}|r${p.radius}|n${p.exponent}|b${p.bezel}|${p.profile}|q${p.resolution}`;
}

/**
 * Paint the field.
 *
 * Cost is `O(mapWidth × mapHeight)`, but the inner loop is a handful of
 * arithmetic ops plus one LUT lookup — no allocation, no trigonometry (that all
 * happened once, when the LUT was built).
 */
function paint(
	data: Uint8ClampedArray,
	mapWidth: number,
	mapHeight: number,
	p: NormalisedParams
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

			const { depth, normalX, normalY } = sampleRoundedBox(
				x,
				y,
				halfWidth,
				halfHeight,
				p.radius,
				p.exponent
			);

			let r = 128;
			let g = 128;

			// Past the bezel is the flat centre, which must stay perfectly neutral.
			if (depth > -EDGE_FEATHER && depth < p.bezel) {
				const magnitude = sampleLut(lut, Math.max(0, depth) / p.bezel);
				// Feather the last pixel outside the outline, otherwise the rounded
				// corners show a stair-stepped seam.
				const fade = depth >= 0 ? 1 : 1 + depth / EDGE_FEATHER;
				const amount = magnitude * fade * 127;

				// Sign convention: the sample point moves *inwards*, along the negated
				// outward normal. That is what a convex lens does — it magnifies the
				// interior outwards — and it is the convention the reference effect
				// uses. Flipping it (sampling outwards) squeezes the surroundings into
				// the rim instead, which reads as a concave dent.
				r = 128 - normalX * amount;
				g = 128 - normalY * amount;
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
 * would otherwise have to revoke every dropped URL, and a single missed revoke is
 * a permanent leak. The cost is a base64 string per entry (~25 kB for a 320×80
 * element at `resolution: 0.75`) plus one PNG decode on first paint.
 */
export function getDisplacementMap(params: DisplacementMapParams): GlassMap | null {
	const p = normaliseParams(params);
	const mapWidth = clampMapDimension(p.width * p.resolution);
	const mapHeight = clampMapDimension(p.height * p.resolution);

	return cache.get(cacheKey(p), mapWidth, mapHeight, (data, w, h) => paint(data, w, h, p));
}
