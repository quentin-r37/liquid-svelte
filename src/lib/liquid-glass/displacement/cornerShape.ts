import type { CornerShape } from '../liquidGlass.types.js';
import { CORNER_K_MAX, CORNER_K_MIN } from '../runtime/glassTokens.js';

/**
 * The bridge between the CSS `corner-shape` property and the distance field.
 *
 * CSS defines a superelliptical corner as `x^(2K) + y^(2K) = 1`, `K` being the
 * argument to `superellipse()`. So the keyword `round` is `superellipse(1)` — an
 * ordinary quarter-ellipse, exponent 2 — and `squircle` is `superellipse(2)`,
 * exponent 4. Everything here exists so the exponent the field is *built* with and
 * the token the browser *clips* with come from one value and cannot drift apart.
 *
 * That is not a tidiness argument. `backdrop-filter` output is clipped by the
 * element's own corner, so a field built for a circle sitting inside a squircle
 * clip has its refraction sliced off at four corners, and a squircle field inside
 * a circular clip leaves four crescents of unrefracted backdrop — the exact seam
 * the corner SDF exists to avoid (see `roundedBoxSdf.ts`).
 */

/** `superellipse()` arguments for the keywords this library accepts. */
const KEYWORD_K = {
	round: 1,
	squircle: 2
} as const;

/**
 * Clamp a `superellipse()` argument into the range the field can actually model.
 *
 * The lower bound is the circle. Below `K = 1` the corner flattens towards `bevel`
 * at 0 and turns *concave* below it (`scoop`, `notch`) — and neither the p-norm
 * level set in `roundedBoxSdf.ts` nor the specular rim's normal-against-light ramp
 * survives a corner whose outward normal stops rotating monotonically. Those shapes
 * need a different field rather than a different exponent, so they are clamped away
 * instead of rendered wrong.
 *
 * The upper bound is where a superellipse stops being distinguishable from a square
 * corner; past it the exponent buys nothing and only costs `Math.pow` precision.
 */
function resolveK(shape: CornerShape): number {
	if (typeof shape !== 'number') return KEYWORD_K[shape];
	if (Number.isNaN(shape)) return KEYWORD_K.round;
	const clamped = Math.min(CORNER_K_MAX, Math.max(CORNER_K_MIN, shape));
	/*
	 * Rounded here, once, rather than when either output is formatted. `LiquidMenu`
	 * eases K per frame, so an unrounded value would emit
	 * `superellipse(1.4000000000000001)` — harmless in itself, but rounding only the
	 * CSS side would let the token and the field's exponent describe curves that
	 * differ in the fourth decimal, and this file's entire contract is that they
	 * cannot differ at all. Four decimals is far below one device pixel of outline.
	 */
	return Math.round(clamped * 1e4) / 1e4;
}

/**
 * Exponent `n` in `|x|ⁿ + |y|ⁿ = rⁿ`, which is `2K`. This is what the field wants;
 * `K` is what CSS wants.
 */
export function cornerExponent(shape: CornerShape): number {
	return resolveK(shape) * 2;
}

/**
 * The matching `corner-shape` value.
 *
 * Keywords are emitted for the two common cases rather than `superellipse(1)` and
 * `superellipse(2)`, so the computed style stays legible in devtools.
 */
export function cornerShapeCss(shape: CornerShape): string {
	const k = resolveK(shape);
	if (k === KEYWORD_K.round) return 'round';
	if (k === KEYWORD_K.squircle) return 'squircle';
	return `superellipse(${k})`;
}
