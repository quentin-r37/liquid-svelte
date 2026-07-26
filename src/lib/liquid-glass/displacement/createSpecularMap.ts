import type { GlassMap, SpecularMapParams } from '../liquidGlass.types.js';
import {
	MAX_MAP_DIMENSION,
	SPECULAR_LIGHT_ANGLE,
	SPECULAR_SUPERSAMPLE_MAX,
	SPECULAR_WIDTH_MAX,
	SPECULAR_WIDTH_MIN,
	SPECULAR_WIDTH_PER_BEZEL
} from '../runtime/glassTokens.js';
import { cornerExponent } from './cornerShape.js';
import { clampMapDimension, createMapCache, quantiseSize } from './mapCache.js';
import { sampleRoundedBox } from './roundedBoxSdf.js';

/**
 * Rasterises the specular rim — the bright hairline that reads as the lit edge of
 * a glass pebble.
 *
 * This is the single biggest contributor to the "premium" look, and it cannot be
 * faked with a CSS gradient border: the brightness has to follow the *surface
 * normal* against a fixed light direction, so it peaks on two opposite arcs and
 * fades to nothing on the two perpendicular ones. A CSS linear-gradient border
 * fades along a straight axis instead, which is why it always looks like a sticker
 * rather than a lit edge.
 *
 * The map is white with a shaped alpha, and the filter blends it over the
 * refracted backdrop with `mode="screen"`.
 *
 * Unlike the displacement map this is never generated *below* full resolution — a
 * 2px rim generated at half scale and upscaled is just a blurry smear — and on a
 * display whose pixel ratio is above 1 it goes the other way and supersamples,
 * because one texel per CSS pixel is still an upscale there. See
 * {@link SPECULAR_SUPERSAMPLE_MAX}.
 */

const cache = createMapCache();

const lightX = Math.cos(SPECULAR_LIGHT_ANGLE);
const lightY = Math.sin(SPECULAR_LIGHT_ANGLE);

export function specularWidthFor(bezel: number): number {
	return Math.min(
		SPECULAR_WIDTH_MAX,
		Math.max(SPECULAR_WIDTH_MIN, bezel * SPECULAR_WIDTH_PER_BEZEL)
	);
}

type NormalisedParams = Omit<SpecularMapParams, 'cornerShape' | 'pixelRatio'> & {
	exponent: number;
	/** Map texels per CSS pixel. */
	scale: number;
};

/**
 * Texels per CSS pixel to rasterise at, given the display's ratio.
 *
 * Two clamps, for different reasons. The ratio is stepped to halves so that the
 * fractional values a zoom ladder produces (1.1, 1.25, 1.32, …) collapse onto a
 * handful of cache keys instead of minting one per zoom step — the LRU only holds
 * `MAP_CACHE_LIMIT` entries and a page of glass would evict itself. And the
 * result is held below whatever `MAX_MAP_DIMENSION` allows for this geometry, so
 * supersampling can never be the thing that pushes a dimension into the clamp:
 * a map squashed on one axis puts the hairline off the silhouette, which is far
 * worse than a soft one.
 */
function supersampleFor(width: number, height: number, pixelRatio: number): number {
	const requested = Math.min(SPECULAR_SUPERSAMPLE_MAX, Math.max(1, pixelRatio));
	const stepped = Math.round(requested * 2) / 2;
	const fits = Math.floor(Math.min(MAX_MAP_DIMENSION / width, MAX_MAP_DIMENSION / height) * 2) / 2;

	return Math.max(1, Math.min(stepped, fits));
}

function normaliseParams(params: SpecularMapParams): NormalisedParams {
	const width = Math.max(4, quantiseSize(params.width));
	const height = Math.max(4, quantiseSize(params.height));
	const limit = Math.min(width, height) / 2;

	return {
		width,
		height,
		radius: Math.min(quantiseSize(Math.max(0, params.radius)), limit),
		exponent: cornerExponent(params.cornerShape ?? 'round'),
		// Rounded to a tenth of a pixel: the rim is thin enough that quantising it
		// to whole pixels would make it visibly pop as the bezel is adjusted.
		rimWidth: Math.max(0.5, Math.round(params.rimWidth * 10) / 10),
		scale: supersampleFor(width, height, params.pixelRatio ?? 1)
	};
}

function cacheKey(p: NormalisedParams): string {
	return `${p.width}x${p.height}|r${p.radius}|n${p.exponent}|s${p.rimWidth}|x${p.scale}`;
}

function paint(
	data: Uint8ClampedArray,
	mapWidth: number,
	mapHeight: number,
	p: NormalisedParams
): void {
	const halfWidth = p.width / 2;
	const halfHeight = p.height / 2;

	/**
	 * Texels per CSS pixel on each axis, recovered from the map dimensions rather
	 * than reused from `p.scale`: `clampMapDimension` rounds and may clamp, and
	 * sampling the SDF on a grid that disagrees with the texture's own aspect by
	 * even a fraction walks the hairline off the silhouette at the corners.
	 */
	const scaleX = mapWidth / p.width;
	const scaleY = mapHeight / p.height;

	/** One texel expressed in CSS pixels — the width of the coverage ramp below. */
	const texel = 1 / Math.min(scaleX, scaleY);

	/**
	 * The ramp straddles the inner boundary, so the band is sampled half a texel
	 * past it. Cutting the loop off at `rimWidth` instead would move the boundary
	 * inward by half a texel and dim the brightest part of the rim — an
	 * antialiasing pass is not supposed to cost energy.
	 */
	const outerDepth = p.rimWidth + texel * 0.5;

	for (let py = 0; py < mapHeight; py += 1) {
		const y = (py + 0.5) / scaleY - halfHeight;

		for (let px = 0; px < mapWidth; px += 1) {
			const x = (px + 0.5) / scaleX - halfWidth;
			const offset = (py * mapWidth + px) * 4;

			const { depth, normalX, normalY } = sampleRoundedBox(
				x,
				y,
				halfWidth,
				halfHeight,
				p.radius,
				p.exponent
			);

			if (depth <= 0 || depth >= outerDepth) {
				data[offset + 3] = 0;
				continue;
			}

			// Absolute dot product, so both the lit arc and the arc facing away pick
			// up a highlight — the asymmetric double rim that sells the thickness.
			// `-normalY` because the y axis points down in image space.
			const alignment = Math.abs(normalX * lightX + -normalY * lightY);

			// Circular ramp across the rim: dark at the very outline, brightest at the
			// inner edge of the band.
			const t = Math.min(1, Math.max(0, depth / p.rimWidth));
			const ramp = Math.sqrt(Math.max(0, 1 - (1 - t) ** 2));

			const intensity = alignment * ramp;
			const luminance = Math.min(255, 255 * intensity);

			/**
			 * Box-filter coverage across the *inner* boundary of the band.
			 *
			 * The outer boundary needs none: `ramp` goes to zero as `depth` does, and
			 * squaring it below leaves alpha rising linearly out of the outline. The
			 * inner boundary is the opposite — the ramp peaks exactly there and the
			 * band simply stops, so the brightest part of the hairline ends on a
			 * cliff, and a cliff following a curve is what stairs.
			 *
			 * One *texel* wide, not one CSS pixel: this is antialiasing, so it has to
			 * shrink as the map gets denser rather than dimming a fixed slice of the
			 * highlight. And centred on the boundary, not tucked inside it — the
			 * fraction of the texel that falls within the band is what coverage
			 * means, and a one-sided ramp would instead shave half a texel off the
			 * rim at every density.
			 */
			const coverage = Math.min(1, Math.max(0, 0.5 + (p.rimWidth - depth) / texel));

			data[offset] = luminance;
			data[offset + 1] = luminance;
			data[offset + 2] = luminance;
			// Squaring via `× intensity` tightens the falloff, turning a soft glow
			// into a crisp highlight.
			data[offset + 3] = Math.min(255, luminance * intensity * coverage);
		}
	}
}

/** Generate — or retrieve from cache — the specular rim map. `null` on the server. */
export function getSpecularMap(params: SpecularMapParams): GlassMap | null {
	const p = normaliseParams(params);
	// `feImage` still stretches the texture into `p.width × p.height` user-space
	// units — only the texel density changes, so nothing downstream of the map
	// needs to know this happened.
	const mapWidth = clampMapDimension(p.width * p.scale);
	const mapHeight = clampMapDimension(p.height * p.scale);

	return cache.get(cacheKey(p), mapWidth, mapHeight, (data, w, h) => paint(data, w, h, p));
}
