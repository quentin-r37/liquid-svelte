import type { SurfaceProfile } from '../liquidGlass.types.js';
import { DERIVATIVE_DELTA, GLASS_IOR, LUT_SAMPLES } from '../runtime/glassTokens.js';

/**
 * Surface height functions, normalised on `x ∈ [0, 1]`.
 *
 * `x = 0` is the outer edge of the glass, `x = 1` the inner boundary of the
 * bezel where the surface becomes flat. Only the *slope* of these functions is
 * ever used, which is why a flat centre (slope 0) stays optically stable.
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
 * Lateral offset a vertical ray picks up crossing a surface tilted by `slope`,
 * per unit of glass thickness.
 *
 * Snell's law: a normal tilted `θ` from vertical refracts the ray by
 * `δ = θ − asin(sin θ / n)`, and the ray then travels laterally by `tan δ`.
 *
 * Using this instead of the raw derivative matters a lot in practice. Convex
 * profiles have an *infinite* slope at the outer edge (`⁴√` and `√` both do),
 * so normalising raw slopes would collapse the whole LUT into a one-pixel
 * spike. `tan δ` saturates at ~1.12 for `n = 1.5`, which yields a refraction
 * that decays smoothly across the bezel and reaches zero at the flat centre.
 */
function snellOffset(slope: number): number {
	const theta = Math.atan(Math.abs(slope));
	const deviation = theta - Math.asin(Math.sin(theta) / GLASS_IOR);
	return Math.tan(deviation);
}

const lutCache = new Map<SurfaceProfile, Float32Array>();

/**
 * Signed, normalised refraction magnitude versus normalised depth into the bezel.
 *
 * The sign carries the direction: positive pushes the sample point *outwards*
 * along the edge normal (convex glass compresses the surroundings into the
 * rim), negative pulls it inwards (concave). Values are normalised so the peak
 * absolute magnitude is exactly 1, which makes the SVG filter's `scale`
 * attribute the single knob for refraction strength.
 *
 * The LUT depends only on the profile — never on the element's size — so it is
 * built at most once per profile for the whole page. That is what makes
 * resizing cheap: only the per-pixel SDF has to be re-evaluated.
 */
export function getMagnitudeLut(profile: SurfaceProfile): Float32Array {
	const cached = lutCache.get(profile);
	if (cached) return cached;

	const f = HEIGHT_FUNCTIONS[profile];
	const lut = new Float32Array(LUT_SAMPLES);
	let peak = 0;

	for (let i = 0; i < LUT_SAMPLES; i += 1) {
		const x = i / (LUT_SAMPLES - 1);
		const slope = (f(x + DERIVATIVE_DELTA) - f(x - DERIVATIVE_DELTA)) / (2 * DERIVATIVE_DELTA);
		const magnitude = Math.sign(slope) * snellOffset(slope);
		lut[i] = magnitude;
		peak = Math.max(peak, Math.abs(magnitude));
	}

	if (peak > 0) {
		for (let i = 0; i < LUT_SAMPLES; i += 1) lut[i] /= peak;
	}

	lutCache.set(profile, lut);
	return lut;
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
