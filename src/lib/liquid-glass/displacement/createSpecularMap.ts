import type { GlassMap, SpecularMapParams } from '../liquidGlass.types.js';
import {
	SPECULAR_LIGHT_ANGLE,
	SPECULAR_WIDTH_MAX,
	SPECULAR_WIDTH_MIN,
	SPECULAR_WIDTH_PER_BEZEL
} from '../runtime/glassTokens.js';
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
 * Unlike the displacement map this is always generated at full resolution — a
 * 2px rim generated at half scale and upscaled is just a blurry smear.
 */

const cache = createMapCache();

const lightX = Math.cos(SPECULAR_LIGHT_ANGLE);
const lightY = Math.sin(SPECULAR_LIGHT_ANGLE);

/** Width of the antialiasing ramp just outside the outline, in CSS pixels. */
const EDGE_FEATHER = 1;

export function specularWidthFor(bezel: number): number {
	return Math.min(
		SPECULAR_WIDTH_MAX,
		Math.max(SPECULAR_WIDTH_MIN, bezel * SPECULAR_WIDTH_PER_BEZEL)
	);
}

function normaliseParams(params: SpecularMapParams): SpecularMapParams {
	const width = Math.max(4, quantiseSize(params.width));
	const height = Math.max(4, quantiseSize(params.height));
	const limit = Math.min(width, height) / 2;

	return {
		width,
		height,
		radius: Math.min(quantiseSize(Math.max(0, params.radius)), limit),
		// Rounded to a tenth of a pixel: the rim is thin enough that quantising it
		// to whole pixels would make it visibly pop as the bezel is adjusted.
		rimWidth: Math.max(0.5, Math.round(params.rimWidth * 10) / 10)
	};
}

function cacheKey(p: SpecularMapParams): string {
	return `${p.width}x${p.height}|r${p.radius}|s${p.rimWidth}`;
}

function paint(
	data: Uint8ClampedArray,
	mapWidth: number,
	mapHeight: number,
	p: SpecularMapParams
): void {
	const halfWidth = p.width / 2;
	const halfHeight = p.height / 2;

	for (let py = 0; py < mapHeight; py += 1) {
		const y = py + 0.5 - halfHeight;

		for (let px = 0; px < mapWidth; px += 1) {
			const x = px + 0.5 - halfWidth;
			const offset = (py * mapWidth + px) * 4;

			const { depth, normalX, normalY } = sampleRoundedBox(x, y, halfWidth, halfHeight, p.radius);

			if (depth <= -EDGE_FEATHER || depth >= p.rimWidth) {
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
			const fade = depth >= 0 ? 1 : 1 + depth / EDGE_FEATHER;
			const luminance = Math.min(255, 255 * intensity);

			data[offset] = luminance;
			data[offset + 1] = luminance;
			data[offset + 2] = luminance;
			// Squaring via `× intensity` tightens the falloff, turning a soft glow
			// into a crisp highlight.
			data[offset + 3] = Math.min(255, luminance * intensity * fade);
		}
	}
}

/** Generate — or retrieve from cache — the specular rim map. `null` on the server. */
export function getSpecularMap(params: SpecularMapParams): GlassMap | null {
	const p = normaliseParams(params);
	const mapWidth = clampMapDimension(p.width);
	const mapHeight = clampMapDimension(p.height);

	return cache.get(cacheKey(p), mapWidth, mapHeight, (data, w, h) => paint(data, w, h, p));
}
