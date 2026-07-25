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

/**
 * A menu panel as a shallow puddle: milky, and with no lens at all.
 *
 * The same rest → liquid morph as the droplet, with endpoints suited to a large
 * sheet instead of a knob. A puddle 6% of its final height has no meaningful
 * thickness, so `displacementRatio: 0` is physical rather than decorative — the
 * refraction *grows* as the liquid deepens, which is most of why the opening reads
 * as a volume of liquid rather than a growing rectangle.
 *
 * `blur` again a hair above zero rather than at it, so `feGaussianBlur` never leaves
 * and re-enters the filter chain mid-animation.
 */
export const MENU_GLASS_REST: DropletVisual = {
	displacementRatio: 0,
	opacity: 0.3,
	saturation: 1,
	blur: 0.05,
	specularIntensity: 0.2,
	scale: 1
};

/**
 * The settled panel.
 *
 * Tinted and blurred more than any other surface in the library, and deliberately
 * so: this is the only one that has small text sitting directly on it, and a menu
 * that is *too* clear is unreadable over busy content. Still nowhere near frosted —
 * `blur: 1` is a tenth of what the degraded tier uses.
 */
export const MENU_GLASS_OPEN: DropletVisual = {
	displacementRatio: DISPLACEMENT_PER_BEZEL,
	opacity: 0.12,
	saturation: 1.7,
	blur: 1,
	specularIntensity: 0.9,
	scale: 1
};

/**
 * Menu panel geometry, in CSS pixels.
 *
 * The bezel is wide for the same reason the lens's is: refraction concentrated in a
 * broad rim, with a clear flat centre for the items to sit on. `gap` is the distance
 * from the trigger — enough for the panel's own shadow to separate the two.
 */
export const MENU_GEOMETRY = {
	radius: 22,
	bezel: 16,
	gap: 10,
	minWidth: 208
} as const;

/**
 * Slider knob geometry, in CSS pixels.
 *
 * The reference knob is not a circle: it is a wide capsule — 90×60 with a fully
 * rounded end — laid out at that size but drawn at scale 0.6 while idle, swelling
 * to its full geometry the instant it is grabbed. Those two facts carry most of
 * the effect's identity. A round knob that grows 18% reads as an ordinary slider
 * dot; a pill that visibly inflates under the finger reads as a droplet forming.
 * The numbers below are the reference's proportions (3:2, ×0.6) scaled down so the
 * default control still sits in an ordinary form row.
 *
 * The element is always *laid out* at full size and shrunk by the transform, never
 * resized: width and height are part of the displacement-map cache key, so
 * animating them would rasterise a fresh PNG every frame. Scaling is free.
 */
export const SLIDER_THUMB = {
	width: 60,
	height: 40,
	/**
	 * Idle scale. The knob spends nearly all of its life here, so 36×24 — not the
	 * 60×40 geometry — is the size the control actually reads as.
	 */
	restScale: 0.6,
	/**
	 * Grabbed. Exactly 1, because the swell is expressed as "up to the element's
	 * real size": going beyond it would magnify a displacement map rasterised for a
	 * smaller box and visibly soften the rim.
	 */
	activeScale: 1,
	/**
	 * Refracting band, measured inwards from the rim.
	 *
	 * Deliberately a quarter of the height rather than half. Half would make the
	 * whole capsule bezel — unavoidable for a circular knob, which is what the
	 * previous round thumb did — and the knob then refracts everywhere and reads as
	 * a smudge. The reference leaves a flat, clear centre (16px of bezel on a 60px
	 * knob) and it is that clear middle, ringed by a thin band of strong
	 * distortion, that reads as a lens.
	 */
	bezel: 10
} as const;

/**
 * Rail thickness, in CSS pixels.
 *
 * Sized against the knob rather than chosen on its own: the reference rail is half
 * the knob's idle height, which is what makes the knob read as sitting *on* the
 * track instead of *in* it.
 */
export const SLIDER_RAIL_HEIGHT = 12;

/**
 * Switch geometry — proportions rather than pixels, so `sm` and `md` are the same
 * control at two scales instead of two hand-tuned ones.
 *
 * The reference switch is not a circle sliding inside a pill. It is a wide capsule
 * — 146×92, radius 46 — riding a *shorter* 160×67 track, laid out at that full
 * size and drawn at 0.65 while idle, swelling to 0.9 the instant it is grabbed. At
 * rest that reads as an ordinary chunky knob inset in its track; grabbed, the
 * droplet visibly bulges past the track's rim at all four sides. That bulge is the
 * effect, and it is why nothing in the switch's markup may clip.
 *
 * As with {@link SLIDER_THUMB} the element is always laid out at full geometry and
 * shrunk by the transform, never resized — width and height are part of the
 * displacement-map cache key, so animating them would rasterise a fresh PNG every
 * frame, whereas scaling is free. The active end is therefore pinned at exactly 1
 * so no map is ever magnified past the size it was rasterised for, and the
 * reference's 0.65 → 0.9 is expressed as 0.72 → 1: the same 1.39× swell,
 * renormalised.
 */
export const SWITCH_THUMB = {
	/** Capsule width ÷ height. The reference's 146:92. */
	aspect: 1.59,
	/**
	 * Idle scale. The knob spends nearly all its life here, so this — not the
	 * laid-out geometry — is the size the control reads as.
	 */
	restScale: 0.72,
	/** Grabbed. See above for why this is exactly 1. */
	activeScale: 1,
	/**
	 * Refracting band, as a fraction of the laid-out height; the reference's 19px
	 * on 92px. Same reasoning as the slider's quarter-height bezel: a half-height
	 * bezel turns the entire capsule into bezel, and a knob that refracts
	 * everywhere reads as a smudge rather than as a lens with a clear centre.
	 */
	bezelRatio: 0.22,
	/**
	 * Travel as a multiple of the track height. The reference is 0.86, which would
	 * put the default switch at 84px wide; 0.7 keeps it at 78 and preserves the
	 * 26px of travel the previous round-knob switch had, which is what the label
	 * spacing and the demo layouts were built around.
	 */
	travelRatio: 0.7,
	/**
	 * How far past either end the knob may be pulled, as a fraction of the travel.
	 * The reference allows a comparable few pixels; see {@link DRAG_OVERSHOOT_DECAY}
	 * for why a bound needs *some* give rather than a hard stop.
	 */
	overshootRatio: 0.14
} as const;

/**
 * Track height and inner padding per size, in CSS pixels. The width is derived
 * from the knob's idle footprint plus its travel, so it cannot drift out of
 * agreement with {@link SWITCH_THUMB}.
 */
export const SWITCH_SIZES = {
	sm: { height: 28, padding: 3 },
	md: { height: 36, padding: 4 }
} as const;

export type SwitchSize = keyof typeof SWITCH_SIZES;

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
