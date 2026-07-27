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

/**
 * `superellipse()` arguments for the keywords this library accepts.
 *
 * `continuous` is the odd one out: it is not a CSS keyword but Apple's
 * `.continuous` corner curve, the one every iOS menu, card and sheet is drawn
 * with. That curve is a fixed chain of three cubic Béziers per corner, not a
 * superellipse — but measured against the SDK output
 * (`RoundedRectangle(cornerRadius:style:.continuous)`, macOS 26 SDK), a
 * superellipse at `K = 1.3` with the radius scaled by ~1.24 sits within 0.33% of
 * the radius of it, at every scale tested (r = 13…120, rects 250×44…400×400).
 * Sub-pixel below ~180px of radius, which is everything this library draws.
 *
 * The number people expect here is 2 — "iOS uses squircles" — and it is wrong in
 * a specific, measurable way: Apple's curve spreads its transition over 1.5287·r
 * of edge but cuts the 45° diagonal back by only 0.4123·r, which is a hair less
 * than a plain circle's 0.4142·r. Same corner depth as a circle, much longer
 * ease-in. A quartic squircle at the same radius misses it by 19% of the radius
 * and reads distinctly squarer; even radius-compensated through
 * {@link matchedRadius} it fits no better than the circle does (~1.5%).
 *
 * The keyword deliberately encodes only the exponent. The ×1.24 radius factor is
 * {@link matchedRadius}'s job (its analytic ×1.2517 lands within 1% of the
 * fitted factor), and the primitive's contract that `borderRadius` means the
 * radius holds for this keyword like any other.
 */
const KEYWORD_K = {
	round: 1,
	continuous: 1.3,
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
 * The radius at which `shape` looks as rounded as a `round` corner of `radius`.
 *
 * A superellipse hugs the box edges for longer than a circle does and then turns
 * harder near the diagonal, so at equal radius it reads as *less* rounded, not
 * more. Measuring the outline's cutback from the box corner along the 45° diagonal
 * gives `√2 · (1 − 2^(−1/n))` per unit of radius — `0.414 r` for a circle against
 * `0.225 r` for a quartic squircle. The ratio of those is the factor here: ×1.25
 * for `continuous`, ×1.84 for `squircle`, ×2.68 for `superellipse(3)`.
 *
 * For `continuous` this compensation is also what makes the keyword *fit*: the
 * best-fit superellipse to Apple's curve is `K = 1.3` at ×1.2375 the nominal
 * radius, and this formula's ×1.2517 lands within 1% of that — so
 * `matchedRadius(r, 'continuous')` reproduces an iOS corner of radius `r` to a
 * third of a percent without a dedicated factor (see {@link KEYWORD_K}).
 *
 * Which is why swapping the keyword in and leaving the radius alone looks like the
 * property did nothing, or made the corner squarer. It is also why iOS icons carry
 * a radius near half their side: a squircle needs a big radius to read as curved at
 * all.
 *
 * Not applied by the primitive — `borderRadius` means the radius, and quietly
 * multiplying it would make the prop lie. Components that own their own geometry
 * token call this themselves; see `LiquidMenu`. Note the result can exceed
 * `min(w, h) / 2`, in which case the usual clamp takes over and no compensation is
 * possible — which is the case for every pill and circle in the library, since
 * their radius already saturates.
 */
export function matchedRadius(radius: number, shape: CornerShape): number {
	const n = cornerExponent(shape);
	if (n === 2) return radius;
	return (radius * (1 - 2 ** -0.5)) / (1 - 2 ** (-1 / n));
}

/**
 * The matching `corner-shape` value.
 *
 * Keywords are emitted for the two CSS-native cases rather than `superellipse(1)`
 * and `superellipse(2)`, so the computed style stays legible in devtools.
 * `continuous` has no CSS keyword and comes out as `superellipse(1.3)`.
 */
export function cornerShapeCss(shape: CornerShape): string {
	const k = resolveK(shape);
	if (k === KEYWORD_K.round) return 'round';
	if (k === KEYWORD_K.squircle) return 'squircle';
	return `superellipse(${k})`;
}
