import type { GlassQuality, LiquidGlassProps, SurfaceProfile } from '../liquidGlass.types.js';

/**
 * Every tunable constant of the library lives here so that no magic number is
 * scattered across components.
 */

/** Default prop values for {@link LiquidGlassProps}. */
export const GLASS_DEFAULTS = {
	borderRadius: 28,
	bezel: 24,
	/**
	 * Peak refraction offset in CSS pixels. `undefined` means "derive it from the
	 * bezel" — see {@link DISPLACEMENT_PER_BEZEL}, which is almost always what you
	 * want, because a fixed pixel figure looks wrong as soon as the bezel changes.
	 */
	displacement: undefined,
	/**
	 * Deliberately tiny. Real liquid glass is *clear* — the visual work is done by
	 * the distortion and the rim light, not by frosting. Anything above ~1.5px
	 * reads as ground glass and swallows the refraction.
	 */
	blur: 0.5,
	opacity: 0.05,
	saturation: 1.3,
	chromaticAberration: 0.04,
	specularIntensity: 0.8,
	shadowIntensity: 0.5,
	profile: 'convex-squircle' as SurfaceProfile,
	quality: 'medium' as GlassQuality
} satisfies Partial<LiquidGlassProps>;

/**
 * Peak refraction offset as a multiple of the bezel width, used when
 * `displacement` is left unset.
 *
 * This looks absurdly large — a 24px bezel yields a ~96px peak offset — but it
 * is what the effect actually requires, and it matches the reference
 * implementation almost exactly (a 30px bezel there peaks at 126px). The peak
 * only applies in a razor-thin band at the very outer edge: by 10% into the
 * bezel the magnitude is already down to 0.47, and by 50% it is 0.05. Set this
 * to something "reasonable" like 1 and the glass looks like flat plastic.
 */
export const DISPLACEMENT_PER_BEZEL = 4;

export interface QualityPreset {
	/**
	 * Displacement-map resolution multiplier. The refraction field is smooth and
	 * `feImage` stretches it, so 0.5 is visually near-identical to 1.0 while
	 * costing 4× less to rasterise.
	 *
	 * The *specular* map is always full resolution — a 2px rim cannot survive
	 * being generated at half scale and upscaled.
	 */
	resolution: number;
	/**
	 * Run the 3-pass per-channel chain that produces chromatic aberration. Each
	 * pass is a full displacement of the backdrop, so this roughly triples the
	 * per-frame GPU cost of the filter.
	 */
	chromatic: boolean;
	/** Generate and blend the specular rim map. */
	specular: boolean;
}

export const QUALITY_PRESETS: Record<GlassQuality, QualityPreset> = {
	low: { resolution: 0.5, chromatic: false, specular: false },
	medium: { resolution: 0.75, chromatic: false, specular: true },
	high: { resolution: 1, chromatic: true, specular: true }
};

/**
 * Endpoints of the rest → droplet morph used by slider and switch thumbs.
 * See `runtime/dropletMorph.svelte.ts` for why a knob is not glass at rest.
 */
export interface DropletVisual {
	/** Peak displacement as a multiple of the bezel. `0` disables refraction. */
	displacementRatio: number;
	opacity: number;
	saturation: number;
	blur: number;
	specularIntensity: number;
	/** Multiplier applied to the transform's scale channel. */
	scale: number;
}

/**
 * An opaque, tinted knob. Reads as a solid object, not as glass.
 *
 * `blur` is a hair above zero rather than exactly zero on purpose: the filter
 * chain omits `feGaussianBlur` entirely at zero, so crossing that boundary
 * mid-morph would add and remove a filter primitive every time the knob is
 * grabbed. 0.05 is visually indistinguishable from none and keeps the chain
 * structurally stable.
 */
export const DROPLET_REST: DropletVisual = {
	displacementRatio: 0,
	opacity: 0.92,
	saturation: 1,
	blur: 0.05,
	specularIntensity: 0.32,
	scale: 1
};

/** Fully liquid: clear, strongly refracting, swollen and brightly rimmed. */
export const DROPLET_ACTIVE: DropletVisual = {
	displacementRatio: DISPLACEMENT_PER_BEZEL,
	opacity: 0.06,
	saturation: 2.8,
	blur: 0.4,
	specularIntensity: 1,
	scale: 1.18
};

/** Samples in the 1-D magnitude LUT. 128 keeps a smooth gradient at 8-bit depth. */
export const LUT_SAMPLES = 128;

/** Forward-difference step used to differentiate the surface profile. */
export const DERIVATIVE_DELTA = 1e-4;

/** Refractive index of the glass. 1.5 is ordinary crown glass. */
export const GLASS_IOR = 1.5;

/**
 * Bezel width divided by centre glass thickness.
 *
 * The lateral travel of a refracted ray is `tan(deviation) × thickness`, and the
 * thickness under the bezel rises from the rim to the flat centre. This ratio is
 * what couples the two; it only reshapes the profile by ~20%, so it is a
 * constant rather than another prop.
 */
export const BEZEL_THICKNESS_RATIO = 0.2;

/**
 * Filter region margin, as a fraction of the element on each side.
 *
 * `0.5` gives the `-50% / 200%` region the effect needs: `feDisplacementMap`
 * samples well outside the element near the rim, and anything falling outside
 * the region reads as transparent black — a dead, washed-out edge. The output is
 * still clipped to the element's border-box by `backdrop-filter` itself, so a
 * generous region costs fill rate but never bleeds visually.
 */
export const FILTER_REGION_MARGIN = 0.5;

/**
 * Width of the specular rim in CSS pixels, as a fraction of the bezel, clamped.
 * The reference uses a flat 1.5px; scaling it slightly keeps large surfaces from
 * looking wiry.
 */
export const SPECULAR_WIDTH_PER_BEZEL = 0.09;
export const SPECULAR_WIDTH_MIN = 1.5;
export const SPECULAR_WIDTH_MAX = 4;

/** Light direction for the specular rim, in radians from the +x axis. */
export const SPECULAR_LIGHT_ANGLE = Math.PI / 3;

/**
 * Geometry is rounded to this many CSS pixels before it becomes a cache key, so
 * a continuous resize only rebuilds the maps when it crosses a step.
 */
export const SIZE_QUANTUM = 2;

/** Maximum entries held in each map LRU cache. */
export const MAP_CACHE_LIMIT = 24;

/** Hard ceiling on either map dimension, to bound worst-case rasterisation cost. */
export const MAX_MAP_DIMENSION = 1024;

/** Below this size a map carries no useful signal, so generation is skipped. */
export const MIN_MAP_DIMENSION = 4;

/**
 * `feDisplacementMap` shifts a pixel by `scale × (channel / 255 − 0.5)`, so a
 * fully saturated channel only reaches `scale / 2`. Maps are generated
 * normalised (peak magnitude → channel 255), hence the ×2 to turn a desired
 * peak offset in pixels into the filter's `scale` attribute.
 */
export const DISPLACEMENT_SCALE_FACTOR = 2;

/** Clamp for `chromaticAberration`; beyond this the fringing reads as a bug. */
export const MAX_CHROMATIC_ABERRATION = 0.2;

/**
 * Pointer speed, in CSS pixels per second, that saturates the normalised
 * velocity custom properties at ±1. Roughly a brisk flick across a card.
 */
export const VELOCITY_REFERENCE = 1400;

/**
 * How far, in percent of the element, the specular highlight trails behind the
 * pointer at full velocity. Kept small on purpose — more reads as cartoonish.
 */
export const HIGHLIGHT_TRAVEL = 12;
