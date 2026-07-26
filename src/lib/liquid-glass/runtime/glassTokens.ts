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
 * Diameter of a circular button per size, in CSS pixels.
 *
 * Mirrored by width/height rules in `LiquidButton.svelte`, and that duplication is
 * deliberate rather than an oversight. The box has to have its size in the *server*
 * render: a circle carries no padding, so a diameter that only arrives with the
 * client effect that writes the glass custom properties would let the button
 * collapse to the width of its glyph and then jump. CSS is the layout; these
 * numbers are what the bezel is computed from. Change one, change the other.
 *
 * The sizes are the icon-button sizes, not the pill sizes: a circle has to be
 * comfortably tappable at its narrowest, which is every direction.
 */
export const BUTTON_CIRCLE_SIZES = {
	sm: 30,
	md: 38,
	lg: 46
} as const;

/**
 * Refracting rim of a circular button, as a fraction of its diameter.
 *
 * The same argument as {@link SLIDER_THUMB.bezel}, and it bites harder here. A
 * circle's radius *is* half its size, so the per-size button bezels — 10px on
 * what would be a 30px circle — leave a 5px clear centre and the glyph sits in
 * continuous distortion. Anything that refracts everywhere reads as a smudge
 * rather than as a lens. At 0.26 the rim is a band with a flat middle wide enough
 * to hold a glyph, which is what makes it read as a piece of glass with something
 * *behind* it.
 */
export const BUTTON_CIRCLE_BEZEL_RATIO = 0.26;

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
 * The scroll edge effect: a band of *progressive blur* pinned to one edge of a
 * scroller, strongest at the edge and gone a few dozen pixels in.
 *
 * This is what iOS actually does at the top of a scrolling view, and it is worth
 * being precise about what it is not. It is not a bar made of glass. There is no
 * rim, no drop shadow, no refracting bezel and no boundary of any kind — nothing
 * that would read as an *object* laid over the content. It is the content itself
 * losing definition as it approaches the edge, so that whatever chrome is pinned
 * there stays legible. The glass in that arrangement is reserved for the
 * controls: the capsules and round buttons that float on top of the band, and
 * those are real, discrete objects with real rims.
 *
 * Getting this backwards — a glass slab spanning the width, with plain buttons on
 * it — is the single most recognisable way to look almost right and be wrong.
 *
 * ## How the ramp is built
 *
 * `backdrop-filter` blurs uniformly; a gradient mask on a single blurred layer
 * only ramps its *alpha*, which cross-fades between sharp and uniformly-blurred
 * and still shows a defined blur boundary. A true gradient of blur *radius* needs
 * layers: {@link SCROLL_EDGE.layers} of them, each blurred by the same amount and
 * each masked to hold from the pinned edge to a different depth. They stack, so
 * the pixel at the edge is blurred by all of them and the pixel at the far side
 * by none, with one fewer at each step. Stacked Gaussians add in quadrature, so
 * the per-layer radius is the peak over √n — see `LiquidScrollEdge.svelte`.
 */
export const SCROLL_EDGE = {
	/**
	 * Stacked backdrop layers.
	 *
	 * Each one is a separate composited pass over the band, so this is the effect's
	 * whole cost. Four is where the steps stop being visible against real content
	 * at these radii; the difference between four and eight is not perceptible and
	 * doubles the fill rate.
	 */
	layers: 4,
	/** Peak blur at the pinned edge, in CSS pixels. */
	blur: 12,
	/**
	 * Backdrop saturation under the band.
	 *
	 * Mild, and applied only to the widest layer so it ramps with everything else.
	 * Blur washes colour out; a little saturation puts back what it took, which is
	 * why a blurred iOS edge still looks like the photograph underneath it rather
	 * than like fog.
	 */
	saturation: 1.35,
	/**
	 * Alpha of the legibility scrim at the pinned edge.
	 *
	 * Blur destroys detail but not luminance: white content stays white, and a
	 * label sitting on it disappears however much it is blurred. This is the floor
	 * that stops that, and it is deliberately near-invisible on anything else.
	 */
	scrim: 0.1,
	/**
	 * Scrim alpha on the `flat` tier, where there is no backdrop filtering at all
	 * and the scrim is the only thing carrying legibility. Same role as the tint
	 * boost `.lg` applies on that tier, and about as heavy.
	 */
	flatScrim: 0.6
} as const;

/**
 * Nav bar geometry and scroll-edge thresholds, in CSS pixels unless stated.
 */
export const NAVBAR_GEOMETRY = {
	/** Minimum height of the title row, before any safe-area inset. */
	height: 52,
	/** Horizontal padding of the title row. */
	inset: 12,
	/**
	 * How far the blur band extends *past* the bottom of the row, as a fraction of
	 * the row height.
	 *
	 * The band has to end below the controls, not at them. Ending it flush with the
	 * row puts the last of the ramp exactly where the buttons are, so the eye reads
	 * the band's lower boundary and the row's as the same line — which is the
	 * boundary the whole effect exists to not have.
	 */
	bleedRatio: 0.55,
	/**
	 * Scroll distance over which the edge materialises — and, when a large title is
	 * tracked, the distance over which its bottom edge closes on the bar's.
	 *
	 * Short on purpose. This is not an entrance animation, it is a *state* the
	 * scroll position indexes into, so it has to be over almost as soon as the
	 * content starts moving; anything longer and the bar spends normal scrolling
	 * in a permanent half-materialised haze.
	 */
	fade: 24,
	/**
	 * Fraction of the materialisation the inline title sits out before it starts
	 * appearing.
	 *
	 * The two must not cross-fade together. The edge blurring is the background
	 * changing; the title arriving is a new object. Starting the second a third of
	 * the way into the first is what makes the title read as landing *on* something
	 * that is already there.
	 */
	titleDelay: 0.35,
	/** How far the inline title rises into place as it fades in. */
	titleRise: 8
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
 * so no map is ever magnified past the size it was rasterised for, which leaves the
 * whole swell living in how far below 1 the idle scale sits.
 *
 * That makes the choice of idle scale the choice of the bulge — and the bulge has to
 * be measured against the *track*, not against the knob's own idle size. Copying the
 * reference's 1.39× straight across (0.72 → 1) reads as nothing here, because our idle
 * knob starts smaller relative to its track than the reference's does: it is inset by
 * the track padding at 0.78 of the track height, where the reference's sits at 0.89.
 * The same ratio from a smaller starting point lands the grabbed knob at 1.08× the
 * track height against the reference's 1.24× — a 1.5px lip on a 36px track, which is
 * not a droplet bulging out of its groove, it is a rounding error.
 */
export const SWITCH_THUMB = {
	/** Capsule width ÷ height. The reference's 146:92. */
	aspect: 1.59,
	/**
	 * Idle scale. The knob spends nearly all its life here, so this — not the
	 * laid-out geometry — is the size the control reads as, and that idle size is
	 * held fixed by the track: this number only decides how much larger the laid-out
	 * box behind it is, i.e. how far it swells.
	 *
	 * 0.50 puts the grabbed knob at 1.25× the track height, which is the reference's
	 * bulge, at the price of a 1.6× swell from an idle knob that starts smaller than
	 * the reference's. Between matching the reference's ratio and matching what it
	 * looks like, this matches what it looks like.
	 *
	 * The track is unaffected: its width is derived from the knob's idle *width*
	 * (`thumbWidth × restScale`), which rounding keeps at 44.6px either way — so the
	 * default switch is still 78px wide with the same 25px of travel.
	 */
	restScale: 0.50,
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
	overshootRatio: 0.14,
	/**
	 * Floor on how long the droplet is held at full swell, in milliseconds.
	 *
	 * A click is over in about 80ms, and the droplet spring (ζ ≈ 0.58, ζω₀ = 10) is
	 * only two thirds of the way up by then — so the ordinary way this control is
	 * used saw roughly half the swell it was built for, and the knob looked like it
	 * had barely reacted. Only a *drag*, which holds the gesture open for as long as
	 * the finger is down, ever showed the whole thing.
	 *
	 * Holding the melt a beat past the release lets the spring arrive before the
	 * settle pulls it back. 180ms is where it reaches its target; longer and the knob
	 * starts to read as sticky rather than liquid.
	 */
	meltFloorMs: 180
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
