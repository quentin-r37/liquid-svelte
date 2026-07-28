import type { SurfaceProfile } from '../liquidGlass.types.js';
import {
	BEZEL_THICKNESS_RATIO,
	DERIVATIVE_DELTA,
	GLASS_IOR,
	LUT_SAMPLES
} from '../runtime/glassTokens.js';

/**
 * Surface height functions, normalised on `x ∈ [0, 1]`.
 *
 * `x = 0` is the outer edge of the glass, `x = 1` the inner boundary of the
 * bezel where the surface becomes flat. Both the height *and* its slope matter:
 * the slope sets how far the ray is bent, the height sets how much glass it then
 * has to travel through.
 */
type HeightFunction = (x: number) => number;

/** Smootherstep (Perlin's C2-continuous variant), used to blend profiles. */
function smootherstep(x: number): number {
	const t = Math.min(Math.max(x, 0), 1);
	return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Spherical dome. Sharper refraction right at the edge. */
const convexCircle: HeightFunction = (x) => Math.sqrt(Math.max(0, 1 - (1 - x) ** 2));

/**
 * Quartic squircle — the default.
 *
 * `y = ⁴√(1 − (1 − x)⁴)` has a gentler flat→curve transition than a circle,
 * so the refraction gradient stays smooth across the bezel instead of banding
 * at its inner boundary.
 */
const convexSquircle: HeightFunction = (x) => Math.pow(Math.max(0, 1 - (1 - x) ** 4), 0.25);

/** Bowl-shaped depression; rays diverge outwards instead of converging. */
const concave: HeightFunction = (x) => 1 - convexCircle(x);

/** Raised rim blended into a shallow central dip. */
const lip: HeightFunction = (x) => {
	const t = smootherstep(x);
	return convexSquircle(x) * (1 - t) + concave(x) * t;
};

const HEIGHT_FUNCTIONS: Record<SurfaceProfile, HeightFunction> = {
	'convex-squircle': convexSquircle,
	'convex-circle': convexCircle,
	concave,
	lip
};

/**
 * Lateral travel of a vertical ray crossing the glass, in units of the centre
 * glass thickness.
 *
 * This is Snell's law in vector form. Given the inward surface normal `n` and
 * `η = 1 / ior`, the refracted direction is
 * `η·i − (η·cosθ + √k)·n` with `k = 1 − η²(1 − cos²θ)`; `k < 0` means total
 * internal reflection and no transmitted ray at all. The lateral offset is then
 * the ray's horizontal/vertical component ratio times the distance it travels.
 *
 * Doing the full vector refraction rather than a small-angle approximation
 * matters at the rim, where convex profiles have an *infinite* slope: the exact
 * form saturates at a finite offset (≈1.12 thicknesses for ior 1.5) instead of
 * blowing up, which is what keeps the profile a smooth ramp rather than a
 * one-pixel spike.
 */
function lateralOffset(slope: number, height: number): number {
	const eta = 1 / GLASS_IOR;
	const length = Math.hypot(slope, 1);

	// Normal pointing down into the glass.
	const normalX = -slope / length;
	const normalY = -1 / length;

	const cosTheta = normalY;
	const k = 1 - eta * eta * (1 - cosTheta * cosTheta);
	if (k < 0) return 0;

	const f = eta * cosTheta + Math.sqrt(k);
	const rayX = -f * normalX;
	const rayY = eta - f * normalY;
	if (rayY === 0) return 0;

	// Thickness grows from the rim towards the flat centre.
	return (rayX / rayY) * (1 + height * BEZEL_THICKNESS_RATIO);
}

const lutCache = new Map<SurfaceProfile, Float32Array>();
const reachCache = new Map<SurfaceProfile, { inward: number; outward: number }>();

/**
 * Signed, normalised refraction magnitude versus normalised depth into the bezel.
 *
 * The sign carries the direction along the edge normal. Values are normalised so
 * the peak absolute magnitude is exactly 1, which makes the filter's `scale`
 * attribute the single knob for refraction strength.
 *
 * The LUT depends only on the profile — never on the element's size — so it is
 * built at most once per profile for the whole page. That is what makes resizing
 * cheap: only the per-pixel SDF has to be re-evaluated.
 */
export function getMagnitudeLut(profile: SurfaceProfile): Float32Array {
	const cached = lutCache.get(profile);
	if (cached) return cached;

	const f = HEIGHT_FUNCTIONS[profile];
	const lut = new Float32Array(LUT_SAMPLES);
	let peak = 0;

	for (let i = 0; i < LUT_SAMPLES; i += 1) {
		const x = i / LUT_SAMPLES;
		const height = f(x);
		// Forward difference: a central difference would step outside [0, 1] at the
		// rim, exactly where the profile is steepest and accuracy matters most.
		const slope = (f(Math.min(1, x + DERIVATIVE_DELTA)) - height) / DERIVATIVE_DELTA;
		const magnitude = lateralOffset(slope, height);

		lut[i] = magnitude;
		peak = Math.max(peak, Math.abs(magnitude));
	}

	if (peak > 0) {
		for (let i = 0; i < LUT_SAMPLES; i += 1) lut[i] /= peak;
	}

	lutCache.set(profile, lut);
	return lut;
}

/**
 * How far a profile throws a sample, split by direction, as a fraction of the
 * peak offset.
 *
 * The filter has to know this to size the one pass it cannot bound by the
 * border-box — the source blur, which has to have produced a pixel wherever a
 * refraction pass will read one. The obvious bound is "the peak offset, in every
 * direction", and that is what the filter used before this existed. It is also
 * roughly four times too generous for the default profile, because the direction
 * is not free: `createDisplacementMap` moves the sample point along the *negated*
 * outward normal, so a positive LUT value pulls inwards, towards the element's
 * middle, and a convex profile is positive everywhere. Its samples cannot leave
 * the box at all, and the pass was being sized for an excursion that the optics
 * make impossible.
 *
 * Not a per-profile constant, and deliberately not: `concave` diverges outwards
 * and `lip` does both within one bezel, so a hand-written table would be a
 * second source of truth for a number the LUT already contains, and one that
 * would rot silently the first time a height function is retuned. Reading it off
 * the LUT costs one pass over `LUT_SAMPLES` floats, once per profile per page,
 * on a LUT that was just built anyway.
 *
 * `inward` is capped at the element's own dimension by the caller, not here — a
 * sample thrown further inwards than the element is wide leaves through the far
 * side, which is a real excursion and one the filter still has to cover.
 */
export function getProfileReach(profile: SurfaceProfile): { inward: number; outward: number } {
	const cached = reachCache.get(profile);
	if (cached) return cached;

	const lut = getMagnitudeLut(profile);
	let inward = 0;
	let outward = 0;

	for (let i = 0; i < lut.length; i += 1) {
		inward = Math.max(inward, lut[i]);
		outward = Math.max(outward, -lut[i]);
	}

	const reach = { inward, outward };
	reachCache.set(profile, reach);
	return reach;
}

/** Linearly interpolated LUT lookup for `t ∈ [0, 1]`. */
export function sampleLut(lut: Float32Array, t: number): number {
	if (t <= 0) return lut[0];
	if (t >= 1) return lut[LUT_SAMPLES - 1];

	const position = t * (LUT_SAMPLES - 1);
	const index = Math.floor(position);
	const fraction = position - index;
	return lut[index] * (1 - fraction) + lut[index + 1] * fraction;
}
