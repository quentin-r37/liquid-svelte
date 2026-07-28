import type {
	CornerShape,
	GlassQuality,
	GlassVariant,
	LiquidGlassProps,
	SurfaceProfile
} from '../liquidGlass.types.js';

/**
 * Every tunable constant of the library lives here so that no magic number is
 * scattered across components.
 */

/** Default prop values for {@link LiquidGlassProps}. */
export const GLASS_DEFAULTS = {
	borderRadius: 28,
	/**
	 * The continuous corner, matching iOS — literally, not by reputation. This was
	 * `squircle` (K = 2) on the folk belief that iOS draws quartic squircles; measured
	 * against the SDK's own curve it missed by 19% of the radius and read visibly
	 * squarer than any iOS panel. Apple's continuous curve fits `superellipse(1.3)`
	 * to a third of a percent — see `KEYWORD_K` in `displacement/cornerShape.ts` for
	 * the measurement.
	 *
	 * This is the default rather than an opt-in because it does not mean "make
	 * everything a superellipse". `LiquidGlass` demotes it to `round` for any surface
	 * whose radius saturates at half its box — every button, switch knob, slider
	 * thumb and pill tab in the library — because a capsule and a superellipse cannot
	 * both be had (see `isCapsule` there). And that demotion is itself faithful: iOS
	 * uses true circular capsules where the radius saturates. What is left is
	 * precisely the set iOS gives continuous corners to: cards, sheets, panels,
	 * context menus.
	 *
	 * So one default expresses the whole convention, and a consumer only reaches for
	 * the prop to opt *out* or to push K towards square.
	 *
	 * Browsers without `corner-shape` (anything but Chromium 139+) fall back to
	 * `round` together with their maps, so the silhouette degrades rather than tearing
	 * — the cost being that a card's corner does depend on the engine. That is the
	 * trade this default accepts, and it is the same one `backdrop-filter: url()`
	 * already forces on the refraction itself. It is also mild here: at K = 1.3 the
	 * round fallback is within ~1.4% of the radius of the real curve, so the tear
	 * between engines is a fraction of what the squircle default cost.
	 */
	cornerShape: 'continuous' as CornerShape,
	bezel: 24,
	/**
	 * Peak refraction offset in CSS pixels. `undefined` means "derive it from the
	 * bezel" — see {@link DISPLACEMENT_PER_BEZEL}, which is almost always what you
	 * want, because a fixed pixel figure looks wrong as soon as the bezel changes.
	 */
	displacement: undefined,
	/**
	 * `regular`, because that is what iOS builds its controls from. `blur`,
	 * `opacity` and `saturation` have no entries here — their defaults come from
	 * {@link MATERIAL_VARIANTS} through this — and the components that animate
	 * them (every droplet morph) pass all three explicitly, so they never see the
	 * variant at all.
	 */
	variant: 'regular' as GlassVariant,
	chromaticAberration: 0.04,
	/**
	 * Much lower than the 0.8 this library launched with. Matched by eye against
	 * iOS 26 screenshots on /borders: the reference rim is barely there at rest —
	 * nearer 0.3 than 0.8 — and the hover boost (+0.25) is what brightens it under
	 * the pointer. Raising this back up is the single fastest way to make every
	 * surface read heavier than the platform it is imitating.
	 */
	specularIntensity: 0.35,
	shadowIntensity: 0.5,
	profile: 'convex-squircle' as SurfaceProfile,
	quality: 'medium' as GlassQuality
} satisfies Partial<LiquidGlassProps>;

/** The optics a {@link GlassVariant} supplies as defaults. */
export interface MaterialVariant {
	/** `feGaussianBlur` stdDeviation applied to the backdrop before refraction. */
	blur: number;
	/** Tint layer opacity. */
	opacity: number;
	/** Backdrop saturation multiplier. */
	saturation: number;
}

/**
 * The two materials, matched against iOS 26 rendered in the simulator on an
 * identical backdrop (same gradient, same text lines — see the comparison the
 * numbers were tuned from).
 *
 * `regular` is the frost. Apple's version lifts the backdrop's luminance toward
 * a milky veil until only colour and large shapes survive — and it is the veil
 * doing the obliterating, not the radius.
 *
 * The blur figure here is the *control* frost, not the panel one, and that
 * distinction is the whole reason it moved. iOS 26 runs two σ under one name.
 * Measured on /compare-ios/ab in the iOS 26.5 simulator (2026-07-28, 25–75%
 * edge walk across the stripe boundaries running under a glyph-free surface,
 * against a pixel-identical no-glass capture): `.glassEffect(.regular)` on a
 * button capsule blurs at σ ≈ 1.8pt and on a segmented rail at σ ≈ 1.7–2.1,
 * while a `UIMenu` panel of the same material blurs at σ ≈ 5–7. Both wear the
 * same ~65–68% white veil and the same saturation collapse (0.64→0.28 on the
 * button). `.buttonStyle(.glass)` measures identically to the raw effect —
 * 65% veil, sat→0.28, σ 2.2 — so this really is one material with two frosts,
 * and the small one is what every control on the platform wears.
 *
 * This constant carried the panel's σ until that measurement, because the panel
 * is what it was first tuned against: 12 at launch, 6 once the frosted menu
 * flattened its veil, 5 at the bottom of the panel band. Every button, bar and
 * toolbar inherited a menu's frost and read as ~2.7x too soft — legible
 * structure that survives under the platform's veil turned to milk under ours,
 * at a veil that already matched (68% measured against Apple's 67%). 2 is the
 * measured control figure. The panel keeps its own, explicitly, at
 * {@link PANEL_FROST}.
 *
 * The frost is still not decoration at this size: every ripple in the bezel band
 * is smoothed before it is displaced, which is what lets the edge refraction
 * read as *liquid* rather than as noise. Below ~1.5 that starts showing.
 *
 * The tint stays well under the measured veil because the scheme boost
 * (`--lg-tint-boost`) and the edge layers stack on top of it — 0.24 measured out
 * to a 61% effective veil on the settled panel, 0.27 to 68% on the panel and
 * 66.8% on a button capsule, against Apple's 66.9%. The stack is nonlinear in
 * the alpha, so tune this by measuring on /compare-ios/ab, never by scaling.
 *
 * Saturation stays the mild figure a blur warrants — colours bleed into each
 * other under a Gaussian and wash out, so a little goes back — and deliberately
 * does *not* carry the veil's chroma compensation, which is much larger and
 * belongs to the veil. A white tint at this alpha drags chroma out along with the
 * contrast: uncompensated, the backdrop came through at 0.18 saturation where the
 * platform's came through at 0.28. What closes that is `--lg-chroma-boost` in
 * liquidGlass.css, ×1.5 in light and ×0.85 in dark, because how much chroma a
 * veil destroys depends on the veil's *colour* — compositing toward white
 * destroys it, compositing toward near-black is a multiplication and preserves
 * it — and the colour is scheme-owned, which a token cannot see. The menu panel
 * turns the compensation off entirely; see {@link PANEL_FROST}.
 *
 * `clear` carries the platform's frost rather than this library's history: 1.7
 * is the native `.glassEffect(.clear)` σ, measured the same way as `regular`'s
 * — the figure {@link MENU_GLASS}'s settled clear panel has carried since it
 * was measured, now promoted to the material itself. It shipped at 0.5, the
 * default from when the whole library was clear glass, and 0.5 under a frost of
 * 6 was a ×12 step where the platform takes ×3: the variant switch read as a
 * blur toggle, which is not what the two materials are. On iOS the
 * frost barely moves between them and the *veil* moves enormously — 5% against
 * a measured 68% — so the veil is what has to carry the switch, which is also
 * why the variant now picks the veil's shape (see `.lg[data-variant]` in
 * liquidGlass.css). At 1.7 the backdrop stays legible through the glass and the
 * distortion still does the visual work. iOS reserves this material for
 * controls floating over media — photos, video — with a dimming layer behind
 * the content; anything with small text sitting directly on busy content wants
 * `regular`.
 *
 * `clear`'s veil and saturation come from the same /compare-ios/ab pass. Native
 * `.glassEffect(.clear)` on a button capsule lifts luminance by 16% and hands
 * the backdrop's saturation back essentially untouched (0.65→0.66) — it is a
 * lens, not a tint. At 0.05 the tint lifted only 6% and, with saturation at 1.3,
 * *raised* chroma to 0.76: a juicier backdrop than the one behind it, which is
 * the one thing a clear material must never do. 0.105 is the 16% lift measured
 * back (the same nonlinear stack as `regular`'s, so measured rather than
 * scaled). Saturation stays at the same mild 1.05 and, as with `regular`, the
 * veil's own compensation lives in CSS — ×1.3 rather than ×1.5, a fraction of
 * the correction because there is a fraction of the veil to correct for, and
 * scheme-independent because `clear`'s veil is (see the
 * `.lg[data-variant='clear']` rule). The settled pair measures a 16.2% lift and
 * 0.62→0.67 against the platform's 16.2% and 0.65→0.66, and 15.1% / 0.62→0.64 in
 * dark against a platform that measures the same figures in both schemes.
 *
 * These are *default sources*, not clamps: any surface may set `blur`,
 * `opacity` or `saturation` explicitly and the variant leaves that prop alone.
 */
export const MATERIAL_VARIANTS: Record<GlassVariant, MaterialVariant> = {
	regular: { blur: 2, opacity: 0.27, saturation: 1.05 },
	clear: { blur: 1.7, opacity: 0.105, saturation: 1.05 }
};

/**
 * The `regular` material as a *panel* wears it, as opposed to a control.
 *
 * One material, two settings — see {@link MATERIAL_VARIANTS}. A menu or popover
 * covers a page rather than floating on one, and iOS treats what it covers
 * accordingly: σ ≈ 5–7pt against a control's ~2, and a chroma collapse to 0.17
 * against a control's 0.28 from the same 0.64. Both figures were measured on
 * /compare-ios/menu behind an auto-opened `UIMenu`, and both are what the panel
 * matched at before the material was split — 5 is the bottom of the σ band,
 * where it has sat since the frosted panel flattened its own veil dip and
 * stopped needing radius to compensate.
 *
 * The saturation figure is the material's own and looks like it says nothing;
 * what carries the panel's harder chroma collapse is the *absence* of the veil
 * compensation every control gets — `.lg-menu-panel` pins `--lg-chroma-boost` to
 * 1 in LiquidMenu's stylesheet. Stated there rather than as a token because it
 * is the same quantity the schemes vary, and it belongs wherever the veil it
 * compensates is decided.
 *
 * The veil itself does *not* differ between the two, which is why only these two
 * are here: the panel takes its tint from the material like everything else.
 *
 * Only {@link MENU_GLASS} reads this, and only at its settled end. A toolbar or
 * a tab rail is a control and inherits the material's figures, which is what the
 * platform's own bars measure at.
 */
export const PANEL_FROST = { blur: 5, saturation: 1.05 } as const;

/**
 * Floor applied to the backdrop blur on the `degraded` tier.
 *
 * With no refraction the blur is the only thing separating the glass from what
 * is behind it, so a `clear`-scale σ — 1.7, or a droplet's 0.05 — has to be
 * raised or the surface reads as a flat translucent rectangle. This used to be a
 * ×12 multiplier under a floor of 6, which reached the same 6 by another route
 * while `clear` sat at 0.5; against the measured 1.7 that multiplier lands on
 * 20px of fog, which is not a clear material by any reading. A floor states what
 * was meant all along: never less than this, never more than the material asked
 * for.
 *
 * It sits well above `regular`'s own frost and therefore raises that too, on
 * this tier only. Deliberate rather than an oversight to be tidied by tracking
 * the material: the figure `regular` wears is a *refracting* surface's, and here
 * there is no refraction to carry the material — the same argument that raises
 * `clear`, applied to a σ that used to be close to the floor and, since the
 * material took the platform's control frost of 2, no longer is. The gap grew;
 * the argument did not change. What a `degraded` surface has to look like is a
 * frosted pane, and 2px of blur under no displacement at all is a tinted
 * rectangle — which is exactly what this floor exists to prevent.
 */
export const DEGRADED_BLUR_FLOOR = 6;

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
	 * `feImage` stretches it, so 0.5 is visually near-identical to 1.0.
	 *
	 * This is *not* only a rasterisation cost, which is what this comment used to
	 * claim. `feImage` redraws its source into the filter region on every
	 * execution, so a larger map is paid for again on every frame the surface is
	 * refiltered. Measured on `/bench` — 48 tiles of 132×76 over a moving backdrop,
	 * `full` tier, identical four-primitive chains differing only in this number —
	 * 0.5 ran at 8.0ms per frame against 0.75's 12.1ms. Half the cost of the whole
	 * base chain, for a field the eye cannot tell apart.
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
	/**
	 * Run the post-refraction rim antialias — see
	 * {@link RIM_ANTIALIAS_PER_DISPLACEMENT} for what it cures.
	 *
	 * Four primitives out of a chain that is otherwise four long, so switching it
	 * off roughly halves the filter graph, and it pays twice more: the pad the
	 * refraction passes carry so the antialias can read past the border-box
	 * (`outputPad`) collapses to nothing, and the rim blur's own 3σ leaves the
	 * filter region. On a page carrying dozens of surfaces over a moving backdrop
	 * — every one of them refiltered every frame — that is the difference the
	 * `low` preset is for.
	 *
	 * It is, measurably, the most expensive thing in the chain, and by a margin
	 * nobody guessed: on `/bench` at 48 tiles, `medium`, `full` tier, it adds
	 * **12.0ms per frame** against the specular pass's 4.8ms — it alone takes the
	 * page from 82fps to 41. Two thirds of that is not its own blur but what the
	 * pad does to the passes above it: `outputPad` at 22 doubles what the
	 * displacement pass fills (176×120 against 132×76) and widens the source blur
	 * by a third.
	 *
	 * A preset flag rather than something derived from the geometry, deliberately:
	 * quality is fixed per surface, so the chain's *structure* never changes while
	 * a droplet morph is animating it. Deriving it from the displacement instead
	 * would add and remove primitives mid-morph, which is the same trap
	 * `DROPLET_REST.blur = 0.05` exists to avoid.
	 */
	rimAntialias: boolean;
}

/**
 * What the ladder buys, measured rather than assumed — A/B screenshots at all
 * three tiers, and the `/bench` route's tables, which is where the shape of this
 * ladder came from. Every figure below is 48 tiles of 132×76 over a moving
 * backdrop on the `full` tier, one primitive chain at a time.
 *
 * The ladder used to climb on three axes at once, and it was wrong about which
 * of them cost anything. Isolating them turned up a 2.5× spread nobody had
 * guessed: the rim antialias adds **12.0ms per frame**, the specular pass
 * **4.8ms**, and the map resolution — which the comment above used to call a
 * rasterisation cost — **4.1ms** between 0.5 and 0.75, because `feImage` redraws
 * its source every time the filter runs. Ordered by what they cost rather than
 * by what they are called, the ladder falls out on its own.
 *
 * `low` → `medium` adds the generated specular map and the rim antialias. The
 * specular is hard to see at control sizes, where the CSS edge layers already
 * carry the rim; it earns its keep on larger curved surfaces, where a line that
 * follows the normal reads and a gradient border does not. Both presets run the
 * map at half resolution: the refraction field is smooth and `feImage` stretches
 * it, so 0.75 bought nothing the eye could find and cost a third of the base
 * chain.
 *
 * The antialias sits on this rung rather than one higher, and it is by a wide
 * margin the expensive half of it — see `rimAntialias` for the 12.0ms and for
 * where that time actually goes, which is mostly the pad rather than the blur.
 * The argument for paying it at the default is that what it fixes is already
 * visible at one displacement pass. `feDisplacementMap` point-samples, so the
 * outer band of the bezel undersamples the backdrop; at one pass that is
 * monochrome speckle along the rim, and over a detailed backdrop — text, thin
 * lines — it crawls as the surface moves. `high`'s three passes at three scales
 * decorrelate the same artefact into the coloured sparkle the aberration gets
 * blamed for, which is worse, but it is a difference of degree and not the point
 * at which the artefact appears. See RIM_ANTIALIAS_PER_DISPLACEMENT.
 *
 * That places the cliff between `low` and `medium` rather than between `medium`
 * and `high`, which is a real cost and worth stating plainly: `medium` is now
 * nearer `high` than `low` in frame time, and a page carrying dozens of surfaces
 * over a moving backdrop wants `low`, not the default. The trade is that a
 * single surface — which is what most pages have — should look right without
 * asking for a non-default quality, and a page dense enough to feel the
 * difference is a page that should be picking its quality deliberately anyway.
 *
 * `medium` → `high` adds the chromatic aberration and full-resolution maps. It
 * remains what a lens over contrasty detail or a deep-bezel showcase tile asks
 * for, and remains what **no component defaults to**: three displacement passes
 * over the backdrop is enough to halve the frame rate of a large surface being
 * refiltered every frame.
 */
export const QUALITY_PRESETS: Record<GlassQuality, QualityPreset> = {
	low: { resolution: 0.5, chromatic: false, specular: false, rimAntialias: false },
	medium: { resolution: 0.5, chromatic: false, specular: true, rimAntialias: true },
	high: { resolution: 1, chromatic: true, specular: true, rimAntialias: true }
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
 * A solid flat knob, not glass at all. Reads as an object sitting *on* its
 * track, and only becomes glass through the melt.
 *
 * `opacity: 1` rather than the 0.92 this shipped with: the reference's knob —
 * switch and slider alike — is a fully opaque white capsule, and at 0.92, seen
 * through the default tint gradient whose midpoint runs at 0.6× the alpha, the
 * track (and the switch's "on" green) ghosted through the face, reading as a
 * translucent chip rather than a solid knob. The consumers flatten that
 * gradient to a uniform fill in CSS, exactly as the tabs bubble does — this
 * token carries the alphas, the flattening is theirs.
 *
 * `specularIntensity: 0` for {@link TABS_BUBBLE_REST}'s reason: a lit rim is
 * the single strongest "this is glass" cue, and at rest this is not glass. The
 * consumers also ride the value from CSS to fade their edge layers in with the
 * melt. Safe at exactly zero where zero *blur* is not — it is an `feFuncA`
 * slope, a live attribute, so the filter chain stays structurally stable.
 *
 * `blur` is a hair above zero rather than exactly zero on purpose: the filter
 * chain omits `feGaussianBlur` entirely at zero, so crossing that boundary
 * mid-morph would add and remove a filter primitive every time the knob is
 * grabbed. 0.05 is visually indistinguishable from none and keeps the chain
 * structurally stable.
 */
export const DROPLET_REST: DropletVisual = {
	displacementRatio: 0,
	opacity: 1,
	saturation: 1,
	blur: 0.05,
	specularIntensity: 0,
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
 * The menu panel's morph endpoints — a shallow puddle melting into the settled
 * panel — keyed by the material variant of the trigger.
 *
 * The same rest → liquid morph as the droplet, with endpoints suited to a large
 * sheet instead of a knob. A puddle 6% of its final height has no meaningful
 * thickness, so `displacementRatio: 0` at rest is physical rather than
 * decorative — the refraction *grows* as the liquid deepens, which is most of
 * why the opening reads as a volume of liquid rather than a growing rectangle.
 *
 * Keyed by variant because of what the rest state *is*: the patch of glass
 * standing where the trigger `LiquidButton` just was. The panel takes the
 * trigger's place on a frame, so any optical daylight between the two at that
 * moment is a visible pop — the patch has to wear the trigger's own material.
 *
 * `regular` takes its tint and saturation from {@link MATERIAL_VARIANTS} at both
 * ends — the rest patch has to be optically the trigger it replaces, and the
 * trigger is the stock material — but the two ends now disagree about frost, on
 * purpose. iOS runs one `regular` material at two σ: ~2pt behind a control,
 * ~5–7 behind a menu panel (see {@link PANEL_FROST}). The rest patch is a
 * control, so it wears the material's 2; the settled panel wears the panel's 5;
 * and the morph interpolates between them, which is the physically obvious
 * reading of the same animation — the puddle deepens into a slab, and a thicker
 * slab scatters more. It is also free: blur is a live filter attribute, not part
 * of the displacement map's cache key, so a σ that moves every frame costs
 * nothing (see CLAUDE.md's invariant). The panel end briefly carried an override
 * for the opposite reason — 8 against the variant's then-12, undercutting a
 * figure that was radius compensating for a veil dip — which is worth
 * remembering only because the override is back and means something different
 * now. Blur stays far from zero throughout either way, keeping `feGaussianBlur`
 * structurally in the chain; what the morph animates alongside it is the
 * refraction arriving and the rim lighting.
 *
 * `clear` keeps the hand-tuned tints the menu shipped with when the whole
 * library was clear glass. The rest tint runs *denser* than the settled
 * panel's, because a clear puddle with no lens in it yet has nothing else to be
 * visible with; the settled panel carries more tint and saturation than the
 * clear material itself because it is the one clear surface with small text
 * sitting directly on it. Its blur no longer does: the 1.7 measured here — the
 * native `.glassEffect(.clear)`, taken the same way as `regular`'s, and the
 * figure that showed an 11px line behind the panel staying fully legible at the
 * old 1 where the platform ghosts it — turned out to be the *material's* frost
 * rather than this panel's, and is where {@link MATERIAL_VARIANTS} reads it
 * from now. Both ends therefore take it from there, which also puts the rest
 * patch back in the trigger's material and keeps blur constant across the
 * morph, as `regular` already was.
 */
export const MENU_GLASS: Record<GlassVariant, { rest: DropletVisual; active: DropletVisual }> = {
	regular: {
		rest: {
			displacementRatio: 0,
			opacity: MATERIAL_VARIANTS.regular.opacity,
			saturation: MATERIAL_VARIANTS.regular.saturation,
			// The trigger's frost, because at rest this patch *is* the trigger.
			blur: MATERIAL_VARIANTS.regular.blur,
			specularIntensity: 0.2,
			scale: 1
		},
		active: {
			displacementRatio: DISPLACEMENT_PER_BEZEL,
			opacity: MATERIAL_VARIANTS.regular.opacity,
			// The panel's own material at the settled end: iOS crushes what a menu
			// covers harder than what a button covers, in σ *and* in chroma.
			saturation: PANEL_FROST.saturation,
			blur: PANEL_FROST.blur,
			// A settled panel, so it sits on the resting specular scale — brighter
			// than the 0.35 default because the rim is most of what separates the
			// panel from the page, but nowhere near the transient-grab 1.0.
			specularIntensity: 0.5,
			scale: 1
		}
	},
	clear: {
		rest: {
			displacementRatio: 0,
			opacity: 0.3,
			saturation: 1,
			blur: MATERIAL_VARIANTS.clear.blur,
			specularIntensity: 0.2,
			scale: 1
		},
		active: {
			displacementRatio: DISPLACEMENT_PER_BEZEL,
			opacity: 0.12,
			saturation: 1.7,
			blur: MATERIAL_VARIANTS.clear.blur,
			specularIntensity: 0.5,
			scale: 1
		}
	}
};

/**
 * The popover panel's morph endpoints, keyed by the trigger's material variant.
 *
 * {@link MENU_GLASS}'s figures restated, per the rule on TOOLBAR_MORPH_LEAD:
 * the popover plays the menu's puddle opening — a shallow spill with no
 * thickness to refract with, deepening into a settled panel — so the endpoints
 * are the same *figures*, but a panel of arbitrary consumer content could well
 * come to want a quieter rim or a denser rest tint than a list of menu items,
 * and the moment either is retuned the sharing would have been a bug.
 */
export const POPOVER_GLASS: Record<GlassVariant, { rest: DropletVisual; active: DropletVisual }> = {
	regular: {
		rest: {
			displacementRatio: 0,
			opacity: MATERIAL_VARIANTS.regular.opacity,
			saturation: MATERIAL_VARIANTS.regular.saturation,
			blur: MATERIAL_VARIANTS.regular.blur,
			specularIntensity: 0.2,
			scale: 1
		},
		active: {
			displacementRatio: DISPLACEMENT_PER_BEZEL,
			opacity: MATERIAL_VARIANTS.regular.opacity,
			saturation: MATERIAL_VARIANTS.regular.saturation,
			blur: MATERIAL_VARIANTS.regular.blur,
			specularIntensity: 0.5,
			scale: 1
		}
	},
	clear: {
		rest: {
			displacementRatio: 0,
			opacity: 0.3,
			saturation: 1,
			blur: MATERIAL_VARIANTS.clear.blur,
			specularIntensity: 0.2,
			scale: 1
		},
		active: {
			displacementRatio: DISPLACEMENT_PER_BEZEL,
			opacity: 0.12,
			saturation: 1.7,
			blur: MATERIAL_VARIANTS.clear.blur,
			specularIntensity: 0.5,
			scale: 1
		}
	}
};

/**
 * Card geometry, in CSS pixels.
 *
 * The bezel is shallower than {@link GLASS_DEFAULTS.bezel}, for the menu panel's
 * reason: a card is a container, so the refraction belongs in a rim around a flat
 * clear centre the content sits on. It is slightly *deeper* than the menu's 16
 * because a card is typically the largest resting surface on a page and a rim
 * proportioned for a 208px panel starts reading as a hairline on a 360px card.
 *
 * The radius restates {@link GLASS_DEFAULTS.borderRadius} rather than importing
 * it, per the rule on TOOLBAR_MORPH_LEAD: the default radius is "a glass
 * surface's corner" and this is "a card's corner" — the same figure today, not
 * the same quantity. A card is exactly the surface the `continuous` corner
 * convention exists for, so the shape needs no stating here at all.
 */
export const CARD_GEOMETRY = {
	radius: 28,
	bezel: 18,
	/** Inner padding of the content box. Mirrored in `LiquidCard.svelte`'s CSS. */
	padding: 20
} as const;

/**
 * Popover panel geometry, in CSS pixels.
 *
 * The menu's figures restated, not imported — the rule on TOOLBAR_MORPH_LEAD.
 * A popover is the same *class* of surface as a menu panel (a panel spilling
 * out of a trigger, sized by its content) but not the same surface: a menu is a
 * list with known row metrics, a popover holds arbitrary content, and the
 * moment one of them wants a different rim or resting radius the sharing would
 * have been a bug.
 */
export const POPOVER_GEOMETRY = {
	/** Radius of the *round* panel — matched through `matchedRadius` for other corners. */
	radius: 22,
	bezel: 16,
	gap: 10,
	minWidth: 208,
	/** Inner padding of the content box, mirrored in the component's CSS. Smaller
	 *  than the card's: popovers are dense. */
	padding: 14
} as const;

/**
 * Dialog geometry, in CSS pixels.
 *
 * `radius` runs past every other surface's because a dialog is the largest
 * discrete object the library draws, and iOS scales its continuous corners with
 * the sheet — a 22px corner on a 400px panel reads as a rounded rectangle, not
 * as the platform's sheet silhouette. `bezel` follows the card's argument at
 * dialog scale.
 *
 * `inset` is the floating margin: the sheet presentation floats clear of the
 * viewport edges rather than docking flush, which is what keeps all four
 * corners — and therefore one uniform radius the displacement map can be built
 * for — instead of the docked sheet's two, which would need per-corner radii
 * the primitive deliberately does not have.
 *
 * The pixel figures are mirrored in `LiquidDialog.svelte`'s CSS, the way
 * {@link BUTTON_CIRCLE_SIZES} is mirrored in its component: the layout has to
 * exist in the server render.
 */
export const DIALOG_GEOMETRY = {
	radius: 34,
	bezel: 20,
	/** Width ceiling of the centered presentation. */
	maxWidth: 400,
	/** Width ceiling of the sheet presentation. */
	sheetMaxWidth: 560,
	/** Margin between any panel edge and the viewport. */
	inset: 16,
	padding: 20
} as const;

/**
 * The dialog panel's resting optics.
 *
 * No morph endpoints, deliberately — see the entrance note in
 * `LiquidDialog.svelte`: the panel enters at ~94% of its size, not from a
 * puddle, so there is no "not yet glass" state for a `DropletMorph` to animate
 * out of. The rim sits at the settled-panel 0.5 every settled panel in the
 * library wears ({@link MENU_GLASS}), and the shadow runs above the default 0.5
 * because a modal floats above everything on the page and its elevation is most
 * of what says so.
 */
export const DIALOG_SURFACE = {
	specularIntensity: 0.5,
	shadowIntensity: 0.85
} as const;

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
 * Tint opacity of a `prominent` button's accent fill.
 *
 * An absolute where its predecessor (`BUTTON_PROMINENT_TINT_BOOST`) was a
 * delta over the variant's veil, because prominent is no longer a denser patch
 * of the same material — it is the platform's accent-filled button. macOS 26
 * renders `.glassProminent` as a near-solid sheet of accent colour with the
 * glass surviving only at the edges, and it looks the same over `regular` and
 * `clear` alike, so the variant's own opacity has nothing to contribute. 0.75
 * rather than 1 keeps a breath of the blurred backdrop in the fill — fully
 * opaque, the surface stops being glass at all — and the dark scheme's 1.3
 * tint boost carries it to ~0.98, matching how much more solid the native
 * button reads there.
 */
export const BUTTON_PROMINENT_TINT = 0.75;

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
	/**
	 * Radius of the *round* panel, and the reference the other corner shapes are
	 * matched against rather than a figure they share.
	 *
	 * A superellipse at a given radius reads as less rounded than a circle at the
	 * same one, so `LiquidMenu` scales this through `matchedRadius` — a squircle panel
	 * ends up near 40. Copying 22 across unchanged is what makes a squircle menu look
	 * squarer than the round one it replaced.
	 */
	radius: 22,
	bezel: 16,
	gap: 10,
	minWidth: 208
} as const;

/**
 * Toolbar geometry per size, in CSS pixels.
 *
 * Three numbers per size, and two arithmetic laws between them that the whole
 * component rests on.
 *
 * **`padding × 2 + well = height`, and `height` is {@link BUTTON_CIRCLE_SIZES}.**
 * The collapsed toolbar is a circular `LiquidButton` and the expanded one is a
 * capsule; they morph into each other by scaling on *one* axis, which is only true
 * if the two boxes are exactly the same height. Break this and the shell has a
 * vertical scale to cover as well — at which point the collapsed patch is not the
 * trigger's box, the swap is visible, and the corner compensation has two axes of
 * error rather than one. It is checked at runtime in dev; see the component.
 *
 * **`well − icon` is even.** The same parity argument as `LiquidButton`'s circles,
 * for the same reason: the glyph is flex-centred in the well, so an odd difference
 * puts it on a half CSS pixel, and a half pixel that is *animated* — the wells ride
 * a counter-scale for the whole unroll — rounds one way on one frame and the other
 * way on the next. 24/14, 30/18, 36/22.
 *
 * The `gap` is between wells, not between glyphs: the visible spacing is
 * `gap + (well − icon)`, so 2px of gap reads as 14px of air at `md`. The wells are
 * hit targets and want to stay adjacent; iOS spaces the *glyphs*, not the taps.
 */
export const TOOLBAR_SIZES = {
	sm: { height: 30, padding: 3, well: 24, icon: 14, gap: 2 },
	md: { height: 38, padding: 4, well: 30, icon: 18, gap: 2 },
	lg: { height: 46, padding: 5, well: 36, icon: 22, gap: 3 }
} as const satisfies {
	/*
	 * The first law above, enforced by the compiler rather than by this comment: the
	 * height is typed as the *literal* diameter `LiquidButton` lays its circle out at,
	 * so a table that drifts out of agreement stops type-checking instead of shipping a
	 * toolbar whose collapsed patch is not the trigger's box. `npm run check` is the
	 * only automated gate this repo has; this is how a geometric invariant gets to use
	 * it.
	 */
	[K in keyof typeof BUTTON_CIRCLE_SIZES]: {
		height: (typeof BUTTON_CIRCLE_SIZES)[K];
		padding: number;
		well: number;
		icon: number;
		gap: number;
	};
};

export type ToolbarSize = keyof typeof TOOLBAR_SIZES;

/**
 * Refracting rim of the toolbar shell, as a fraction of its height.
 *
 * Deliberately the same figure as {@link BUTTON_CIRCLE_BEZEL_RATIO}, restated rather
 * than imported, because the two are the same *law* arrived at independently and
 * either could move without the other. The law is that the flat centre the rim
 * leaves — `height × (1 − 2 × 0.26)`, i.e. `height × 0.48` — has to be the glyph
 * well, or the icon sits in continuous distortion and reads as a smudge instead of
 * as something seen *through* a lens.
 *
 * It holds at all three sizes and that is not luck: {@link TOOLBAR_SIZES} picks its
 * icons at the largest even integer under `height × 0.48`, which is the same
 * constraint `LiquidButton` solves for its circles. 30 × 0.48 = 14.4 against an 18px
 * glyph in a 30px well — the *well* is what the rim has to clear, and the glyph
 * inside it has room to spare.
 */
export const TOOLBAR_BEZEL_RATIO = 0.26;

/**
 * The toolbar's morph endpoints — collapsed shell to unrolled bar — keyed by the
 * material variant of the trigger.
 *
 * `displacementRatio: 0` at rest is not a stylistic choice, it is the one thing
 * that makes the morph legal, in both variants. The displacement and specular
 * maps are rasterised for the *expanded* capsule — that is the whole point, since
 * geometry in the cache key must never be animated — and the collapsed patch
 * draws that same texture squeezed to a seventh of its width. The top and bottom
 * bezel bands survive it (they are unchanged in Y), but the two end caps do not:
 * their arcs compress into vertical smears. So the lens fades in *with* the
 * unroll, and by the time the ends are wide enough to be read as arcs they are
 * being drawn at close to the width they were baked for.
 *
 * Everything else is pinned to what the trigger `LiquidButton` looks like in the
 * same variant, because the collapsed state is a *resting, visible, long-lived*
 * state that has to pass as an ordinary glass button — it is swapped for a real
 * one on the frame the morph begins.
 *
 * `regular` is {@link MATERIAL_VARIANTS}' figures at both ends: under that frost
 * the missing lens is barely visible, so the material's own tint is the match,
 * and the unroll animates only the lens and the rim (0.35 — the plain
 * button's resting `GLASS_DEFAULTS.specularIntensity` — up to 0.5, the settled
 * scale). Constant optics also mean the retract drains nothing: the bar simply
 * becomes the button again.
 *
 * `clear` keeps the tints the toolbar shipped with as clear glass: rest tint
 * 0.14 against the clear button's 0.05 was the compensation for having no
 * refraction — a clear button's lens is most of its presence — and the bar
 * settles at 0.06 with a saturation boost doing the legibility work the frost
 * does in `regular`. Its blur is the material's rather than a literal, for the
 * paragraph above: the collapsed patch has to pass as the clear button it is
 * swapped for, and it carried a hard 0.5 that stopped being that button the day
 * the material was retuned to the measured native 1.7.
 *
 * `blur` is equal at both ends of each variant, so `feGaussianBlur` neither
 * enters nor leaves the chain mid-morph. Same precaution as the droplet, arrived
 * at from the other side: there is no reason for a toolbar to change its
 * frosting.
 */
export const TOOLBAR_GLASS: Record<GlassVariant, { rest: DropletVisual; active: DropletVisual }> = {
	regular: {
		rest: {
			displacementRatio: 0,
			opacity: MATERIAL_VARIANTS.regular.opacity,
			saturation: MATERIAL_VARIANTS.regular.saturation,
			blur: MATERIAL_VARIANTS.regular.blur,
			specularIntensity: 0.35,
			scale: 1
		},
		active: {
			displacementRatio: DISPLACEMENT_PER_BEZEL,
			opacity: MATERIAL_VARIANTS.regular.opacity,
			saturation: MATERIAL_VARIANTS.regular.saturation,
			blur: MATERIAL_VARIANTS.regular.blur,
			specularIntensity: 0.5,
			scale: 1
		}
	},
	clear: {
		rest: {
			displacementRatio: 0,
			opacity: 0.14,
			saturation: 1.5,
			blur: MATERIAL_VARIANTS.clear.blur,
			specularIntensity: 0.35,
			scale: 1
		},
		active: {
			displacementRatio: DISPLACEMENT_PER_BEZEL,
			opacity: 0.06,
			saturation: 1.9,
			blur: MATERIAL_VARIANTS.clear.blur,
			specularIntensity: 0.5,
			scale: 1
		}
	}
};

/**
 * Drop shadow at either end of the unroll.
 *
 * A collapsed patch standing in for a button carries the button's elevation; the
 * unrolled bar is a larger object floating further off the page and casts more.
 * Riding the unroll rather than being switched is what makes the bar look like it
 * lifts as it extends.
 */
export const TOOLBAR_SHADOW = { rest: 0.5, open: 0.65 } as const;

/**
 * Refracting rim of the search field, as a fraction of its height.
 *
 * The third restatement of the 0.26 law ({@link BUTTON_CIRCLE_BEZEL_RATIO},
 * {@link TOOLBAR_BEZEL_RATIO}), and restated rather than imported for the reason
 * those two give: the same figure arrived at independently, free to move without
 * the others. The law bites hardest here of the three. A button's label survives a
 * grazing refraction because it is a word the reader already expects; a search
 * field's content is *being typed*, so the flat centre the rim leaves —
 * `height × 0.48`, ~18px on the default field — has to hold the entire text line
 * and the caret, or the control is not decoratively smudged, it is unusable.
 *
 * The heights themselves are {@link BUTTON_CIRCLE_SIZES}, imported rather than
 * restated, because that identity is the point rather than a coincidence: the
 * field's natural habitat is a bar shared with circular icon buttons (iOS 26 puts
 * the search pill next to exactly such a button), and equal heights are what make
 * that row read as one piece of chrome instead of two controls that nearly line up.
 */
export const SEARCH_BEZEL_RATIO = 0.26;

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
 * Sized against the knob rather than chosen on its own: a quarter of the knob's
 * idle height. It used to be half, on the theory that a chunky rail made the knob
 * read as sitting *on* the track — in practice a rail that tall competes with the
 * knob for mass and the whole control reads as a progress bar with a bead on it.
 * The reference groove is a thin line the knob visibly dwarfs, and it is that
 * size contrast that makes the capsule read as the control.
 */
export const SLIDER_RAIL_HEIGHT = 6;

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
	restScale: 0.5,
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

/**
 * The segmented control's rail — and the reason it, rather than the selection
 * bubble, is the glass in this component.
 *
 * iOS puts the material on the *container* and the selection on a plain, lightly
 * tinted capsule riding inside it. That is not an aesthetic preference, it falls
 * out of the same constraint the switch's track does: nested `backdrop-filter`
 * does not compose, so only one of the two surfaces can refract, and it has to be
 * the one underneath. Making the bubble the glass — which is what this component
 * used to do — meant the rail could only ever be flat CSS, so the control as a
 * whole never read as a piece of material with something moving inside it; it read
 * as a lozenge of glass sliding on a painted groove.
 *
 * The bezel is a quarter of the rail's height rather than half, for the reason it
 * is everywhere else in this library: half turns the entire capsule into bezel and
 * a surface that refracts across its whole face reads as a smudge. At 0.26 the
 * distortion is a band along the top and bottom rims with a flat clear middle, and
 * the middle is exactly where the labels sit.
 */
export const TABS_RAIL = {
	/** Refracting band, as a fraction of the rail's measured height. */
	bezelRatio: 0.26,
	/** Floor on that band, in CSS pixels, so a very short control still has a rim. */
	bezelMin: 8
} as const;

/**
 * The selection bubble: the switch knob's mechanism at a segmented control's
 * proportions.
 *
 * It is the same object in every respect that matters. An opaque tinted tile at
 * rest that melts into a lens when grabbed (see `runtime/dropletMorph.svelte.ts`,
 * whose default endpoints this uses unchanged), laid out at its *swollen* size and
 * drawn scaled down, so the swell costs nothing — width and height are displacement
 * map cache keys, and animating them would rasterise a fresh PNG every frame,
 * whereas scaling is free.
 *
 * That layout trick is also what fixes the position: an element scaled about its
 * own centre sits half its slack to the right of where it was placed, so the bubble
 * is offset left by that half — exactly as {@link SWITCH_THUMB} makes the switch do
 * through `geometry.inset`.
 */
export const TABS_BUBBLE = {
	/**
	 * Idle scale, and therefore the whole size of the swell: the bubble spends
	 * nearly all its life here, so this is the size the selection actually reads as,
	 * and the number only decides how much larger the laid-out box behind it is.
	 *
	 * The knob's equivalent is 0.5 — it doubles when grabbed — and nothing like that
	 * is available here. A knob is a small object with empty track on all four sides;
	 * this is a tile in a row of tiles, and every pixel it gains sideways is a pixel
	 * of the neighbouring segment it covers.
	 *
	 * What sets the ceiling is therefore not taste but two measurable clearances, and
	 * 0.78 is where they run out together. On a default control — segments around
	 * 95×38, rail inset 4px, labels padded 1.15rem — a 28% swell puts the bubble
	 * ~13px onto each neighbouring cell, which is still inside that cell's own
	 * padding and so never reaches its text, and ~5px above and below, which clears
	 * the rail's rim by about a pixel. That lip is the knob's signature: the droplet
	 * is supposed to bulge out of its groove, and a swell that stays politely inside
	 * the container reads as a tile being resized rather than as something liquid
	 * being squeezed.
	 *
	 * Past this the horizontal edge starts landing on the neighbour's glyphs, which is
	 * the one thing a selection indicator may never do — so if it still wants to be
	 * bigger, the honest lever is the label padding in `LiquidTabs.svelte`, not this.
	 *
	 * Uniform rather than per-axis, though a taller-than-wider swell would spend the
	 * budget better — all of it on the axis with room. A capsule scaled uniformly
	 * stays a capsule, its saturated radius scaling with its box, whereas a
	 * non-uniform one needs the `--lg-radius-x` / `--lg-radius-y` compensation
	 * `LiquidMenu` carries, or the fully-rounded ends come out as flattened ellipses.
	 */
	restScale: 0.58,
	/**
	 * Grabbed. Exactly 1, for the reason {@link SWITCH_THUMB.activeScale} is: past it
	 * the displacement map rasterised for the laid-out box would be magnified, which
	 * visibly softens the rim.
	 */
	activeScale: 1,
	/**
	 * Refracting band, as a fraction of the laid-out height. The knob's ratio, and
	 * for the knob's reason: a half-height bezel turns the whole capsule into bezel,
	 * and a surface that refracts everywhere reads as a smudge rather than as a lens
	 * with a clear centre.
	 */
	bezelRatio: 0.22,
	/**
	 * Corner radius, as a fraction of the laid-out height. A half is a capsule, and the
	 * capsule is deliberate: the bubble matches the pill shape of the tabs it sits
	 * behind and of the rail around them, so the control is one shape at three scales
	 * rather than a rectangle rattling around inside a pill.
	 *
	 * This was briefly a third — a rounded rectangle, on the reading that a pill inside
	 * a pill reads as a slider rather than as one cell of a row being lit. On the page
	 * it did not: what it actually read as was a mismatch, because the tab hit areas it
	 * covers are pills too. Kept as a ratio rather than inlined so the shape is stated
	 * once and stays next to the argument for it.
	 *
	 * At exactly a half the primitive's `isCapsule` test fires, which forces the corner
	 * to `round` whatever `cornerShape` says — a capsule and a superellipse cannot both
	 * be had. So there is nothing to pass and nothing to compensate; see
	 * {@link matchedRadius} for what that compensation would have been.
	 */
	cornerRatio: 0.5,
	/**
	 * How far past the first and last segment the bubble may be pulled, as a
	 * fraction of one segment's width. See {@link DRAG_OVERSHOOT_DECAY} for why a
	 * bound wants give rather than a hard stop.
	 */
	overshootRatio: 0.3,
	/**
	 * How far a release velocity is projected before deciding which segment was
	 * aimed at, in seconds.
	 *
	 * Twice {@link DRAG_INERTIA_SECONDS}, deliberately. That figure is tuned for a
	 * free glide, where the projection *is* the resting place; here it only has to
	 * decide a winner between detents, and a flick has to be able to carry the
	 * bubble a whole segment or it is not a flick. At 0.12 a 900px/s push clears a
	 * ~110px segment, which is about the speed a deliberate throw lands at.
	 */
	flickSeconds: 0.12,
	/**
	 * Floor on how long the rail is held at full melt, in milliseconds. Same
	 * argument, and the same figure, as {@link SWITCH_THUMB.meltFloorMs}: an
	 * ordinary click is over in ~80ms and the droplet spring is nowhere near its
	 * target by then, so without this the common case shows half the effect.
	 */
	meltFloorMs: 180
} as const;

/**
 * The rail's morph endpoints, keyed by the material variant.
 *
 * Unlike a knob — which is an opaque tinted blob until you grab it, see
 * {@link DROPLET_REST} — a container is glass the whole time it is on screen, so
 * the refraction is at full strength at rest rather than at zero. The active
 * displacement then goes *past* {@link DISPLACEMENT_PER_BEZEL}, which is safe —
 * a live filter attribute, scaling the same map harder, not a geometry change —
 * and is what makes the rims visibly bow as the bubble travels.
 *
 * `regular` deliberately does *not* inherit {@link MATERIAL_VARIANTS}' figures,
 * though it keeps their shape — the material held constant across the morph,
 * the surface waking up being the lens deepening and the rim lighting. It sits
 * close to them now and did not always: the variant's blur/opacity were tuned
 * against the UIMenu panel, which is by far the frostiest surface iOS draws
 * (σ≈6–8pt), while the tab bar is a control. Measured in the iOS 26.5 simulator
 * over the /compare-ios stripes (2026-07-28), the native bar blurs at only
 * σ≈2.5–3pt — and `.glassEffect(.regular)` at segmented-control geometry at
 * σ≈1.7–2.1 — while crushing the backdrop under a ~65% white veil (luminance
 * 131→212 with the selected segment excluded, saturation 0.74→0.32). Apple's
 * frost is luminance compression with a small radius, not a large radius with a
 * light wash. The old inherited figures (blur 12, tint 0.24 ≈ a 34% effective
 * veil) had that exactly backwards: colours bled into each other while the
 * backdrop behind them stayed dark and saturated, which reads as wet glass
 * rather than the milky bar. Hence blur 2, and a tint measured — not derived —
 * because the stack of `--lg-tint-boost` and the edge layers is nonlinear in
 * the alpha: on the old lit-from-the-corner veil 0.24 landed at 34%, 0.44
 * overshot to 71%, and 0.38 interpolated onto 61%; on the flat veil the material
 * carries now (see `.lg[data-variant]` in liquidGlass.css), where 0.38 is an
 * opaque bar, 0.228 measured 52%, 0.30 overshot to 70.5%, and 0.26 landed on
 * 64.6% against the platform's 65.6%. Anything past this wants re-measuring on
 * /compare-ios/ab — and measuring it with the selection bubble excluded, since
 * that tile is a fill sitting on the rail, not the rail's material.
 *
 * Saturation runs a little above the material's 1.05, and only a little: the
 * veil's chroma compensation is not here but in `--lg-chroma-boost`
 * (liquidGlass.css), which multiplies this by 1.5 in light. What the extra 0.1
 * buys is the rail's own reading — under that boost it measures 0.31 of the
 * backdrop's colour against the platform's 0.32, where the material's bare
 * figure left it a step short. Raising *this* rather than the boost keeps the
 * correction where it belongs: the boost answers to the veil, which the rail
 * shares with every other control, and this answers to the rail.
 *
 * `clear` keeps the clear-glass shape — near-zero frost, a small resting tint,
 * saturation doing the legibility work, blur *rising* under the gesture
 * because a saturating backdrop needs the extra frost for the labels to stay
 * legible against it. The figures were pulled toward the same simulator
 * session: native `.glassEffect(.clear)` measures σ≈1pt, a ~17% luminance lift,
 * and a backdrop saturation it *preserves* (0.80→0.77) — where the old 1.5
 * resting boost pushed it up to 0.80 from a lower base, visibly juicier than the
 * platform. So rest tints at 0.09 (measured: 0.14 lifted 24%, 0.09 lands on
 * 17.7% against the reference's 17.4%) and saturates at 1.2, which under
 * `clear`'s ×1.3 veil compensation measures 0.80 against the platform's 0.77.
 * The melt keeps the shape it had around the new resting level: the tint thins
 * by the same third and the saturation spikes by the same half again, so the
 * gesture reads as it did.
 *
 * `scale` is pinned at 1 in every endpoint and never read: the rail is the
 * component's layout box, and scaling it would move the segments the bubble is
 * measured against out from under it.
 */
export const TABS_GLASS: Record<GlassVariant, { rest: DropletVisual; active: DropletVisual }> = {
	regular: {
		rest: {
			displacementRatio: DISPLACEMENT_PER_BEZEL,
			opacity: 0.26,
			saturation: 1.15,
			blur: 2,
			specularIntensity: 0.35,
			scale: 1
		},
		active: {
			displacementRatio: DISPLACEMENT_PER_BEZEL * 1.3,
			opacity: 0.26,
			saturation: 1.15,
			blur: 2,
			specularIntensity: 1,
			scale: 1
		}
	},
	clear: {
		rest: {
			displacementRatio: DISPLACEMENT_PER_BEZEL,
			opacity: 0.09,
			saturation: 1.2,
			blur: 0.4,
			specularIntensity: 0.35,
			scale: 1
		},
		active: {
			displacementRatio: DISPLACEMENT_PER_BEZEL * 1.3,
			opacity: 0.06,
			saturation: 1.9,
			blur: 0.6,
			specularIntensity: 1,
			scale: 1
		}
	}
};

/**
 * The selection bubble at rest: a quiet fill, not an opaque knob.
 *
 * This departs from {@link DROPLET_REST}, and the departure is the whole difference
 * between a switch and a segmented control. A knob at 0.92 reads as a solid white
 * object because that is what it is — the only thing on its track, with nothing
 * behind it worth seeing. A selection fill is a *state applied to one cell of a row*,
 * and at that alpha it stops looking like a marked segment and starts looking like a
 * white sticker laid over the control, bright enough to out-shout the rail it is
 * supposed to be sitting in.
 *
 * The tint colour is set per scheme by `LiquidTabs` rather than here, since a
 * `DropletVisual` carries alphas and not colours. It is the one surface in the
 * library tinted *against* its backdrop instead of with it — see `--lg-tint-color`
 * in `liquidGlass.css`.
 *
 * What is left to carry the melt is therefore not the tint. It is the refraction
 * arriving, the backdrop saturating, the rim lighting, and the 28% swell — which is
 * more than enough, and is arguably the more honest reading of the effect anyway:
 * glass appearing, rather than paint being wiped off.
 */
export const TABS_BUBBLE_REST: DropletVisual = {
	displacementRatio: 0,
	/*
	 * A *subtle* fill, matched against iOS's system fill greys (~0.12–0.16 alpha)
	 * rather than a tile you could name the colour of: the accent-coloured label
	 * carries most of the selection, and a fill much past this starts reading as a
	 * button laid on the rail instead of a state of one segment.
	 */
	opacity: 0.15,
	saturation: 1,
	blur: 0.05,
	/*
	 * Exactly zero, unlike every other rest state: at rest the pill is a flat
	 * fill, not glass, and a lit rim is the single strongest "this is glass" cue.
	 * Zero is safe where zero *blur* is not — the intensity is an `feFuncA` slope,
	 * a live attribute that scales the specular's alpha without adding or removing
	 * a filter primitive, so the chain stays structurally stable across the morph.
	 * `LiquidTabs` also rides this value from CSS to fade its edge layers in with
	 * the melt, which is what "glass only on activation" means there.
	 */
	specularIntensity: 0,
	scale: 1
};

/**
 * Grabbed: a real lens, and *only* a lens.
 *
 * `opacity: 0` where the standard droplet keeps 0.06 — the grey is a resting
 * fill, not part of the glass, so the melt clears it out entirely: what travels
 * under the finger is pure refraction with nothing painted on its face. Safe at
 * exactly zero, unlike `blur`, because the tint is a CSS background alpha and
 * touches no filter primitive.
 *
 * Less saturated than {@link DROPLET_ACTIVE}'s 2.8 because this one has a label
 * sitting on it and a knob does not — the same argument {@link MENU_GLASS}
 * makes. `blur` stays a hair above zero at both ends so `feGaussianBlur` never
 * leaves and re-enters the filter chain mid-morph.
 */
export const TABS_BUBBLE_ACTIVE: DropletVisual = {
	displacementRatio: DISPLACEMENT_PER_BEZEL,
	opacity: 0,
	saturation: 2.4,
	blur: 0.4,
	specularIntensity: 1,
	scale: 1
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
 * Bounds on the CSS `superellipse()` argument `K` accepted by `cornerShape`.
 *
 * `1` is the circle — the floor, because everything below it is a corner the
 * distance field cannot model (see `displacement/cornerShape.ts`). `10` is where
 * MDN notes a superellipse becomes visually indistinguishable from a square
 * corner, so past it the exponent only costs `Math.pow` precision in the inner
 * rasterisation loop.
 */
export const CORNER_K_MIN = 1;
export const CORNER_K_MAX = 10;

/**
 * Minimum filter region margin, as a fraction of the element on each side.
 *
 * `0.5` gives a `-50% / 200%` region: `feDisplacementMap` samples well outside
 * the element near the rim, and anything falling outside the region reads as
 * transparent black — a dead, washed-out edge, or a coloured hairline once the
 * chromatic passes fall off at different scales. This is a *floor*, because a
 * fractional margin scales with the box while the sample reach is absolute
 * pixels: `LiquidGlassFilter` grows each axis to cover the actual peak
 * displacement, which is what a ~40px-tall button with a ~56px reach needs. The
 * output is still clipped to the element's border-box by `backdrop-filter`
 * itself, so a generous region costs fill rate but never bleeds visually.
 */
export const FILTER_REGION_MARGIN = 0.5;

/**
 * Width of the specular rim in CSS pixels, as a fraction of the bezel, clamped.
 *
 * The reference uses a flat 1.5px, and after A/B-ing against iOS 26 screenshots
 * on /borders these values converge to it: every control-scale bezel (≤25px)
 * lands on the 1.5px floor, and only very deep bezels creep toward 2 so a large
 * panel does not look wiry-thin. Formerly 0.09 with a ceiling of 4 — which put
 * 2–4px of rim on everything and read distinctly heavier than the platform.
 */
export const SPECULAR_WIDTH_PER_BEZEL = 0.06;
export const SPECULAR_WIDTH_MIN = 1.5;
export const SPECULAR_WIDTH_MAX = 2;

/**
 * Light direction for the specular rim, in radians from the +x axis, y up.
 *
 * This is the CSS layers' light (`--lg-light-angle: 145deg` in liquidGlass.css)
 * restated in the map's convention — a CSS gradient angle θ has its bright start
 * at 270° − θ from +x, hence 125°. One shared light source puts the rim's bright
 * arcs on the same top-left / bottom-right diagonal as the tint gradient and the
 * CSS hairline under them, which is also where iOS puts its highlight. The rim
 * previously sat at 60° (top-right / bottom-left), quietly perpendicular to
 * every CSS layer it was blended over.
 */
export const SPECULAR_LIGHT_ANGLE = (125 / 180) * Math.PI;

/**
 * Brightness of the rim arc facing *away* from the light, as a fraction of the
 * lit arc.
 *
 * The map used to take `Math.abs` of the normal·light alignment, which lights
 * both opposing arcs equally — and an edge equally bright all the way round
 * reads as a stroked outline, not as an edge catching light. iOS's rim is
 * directional: the arc under the light is the highlight, the opposite arc keeps
 * a *faint* counter-shine (a real glass bead bounces some light out of its far
 * edge — killing it entirely makes the surface read as flat), and the two
 * perpendicular arcs fall to nothing between them.
 *
 * 0.4 of the lit arc's alignment, but the perceived asymmetry is stronger than
 * that: the map squares intensity into its alpha, so the counter-rim lands at
 * 0.16 of the highlight's alpha — present, and clearly subordinate.
 */
export const SPECULAR_COUNTER_RIM = 0.4;

/**
 * Ceiling on how many map texels the specular rim is rasterised at per CSS pixel.
 *
 * One texel per CSS pixel is the obvious choice and it is wrong on any display
 * whose device pixel ratio is not 1: `feImage` has to upscale, and a hairline
 * 1.5–4 px thick following a curve becomes a visible staircase. It is mild on a
 * 2× panel and unmissable under browser zoom, which is the case that actually
 * gets reported. Matching the ratio removes the upscale entirely.
 *
 * Capped at 3 because the cost is quadratic and the return is not: past three
 * texels per CSS pixel the residual error is below a device pixel on any display
 * that exists, while the rasterisation is already 9× the work of the 1× map. The
 * *displacement* map deliberately does not do this — it is a smooth field that
 * survives being stretched, which is why `QualityPreset.resolution` can go the
 * other way and generate it at half scale.
 */
export const SPECULAR_SUPERSAMPLE_MAX = 3;

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
 * Post-refraction antialiasing blur: stdDeviation per CSS pixel of
 * displacement, and its ceiling in CSS pixels.
 *
 * Chromium's `feDisplacementMap` point-samples its input — no bilinear, no
 * mip levels — and near the outline the field is steep enough that adjacent
 * output pixels sample the backdrop several pixels apart. That is sampling
 * below Nyquist, and any detail behind the rim shows it: a thin accent line
 * refracts into a dotted staircase, text into speckle. A single pass hides
 * some of it inside the distortion; the chromatic chain makes it worse, because
 * its three passes run at three scales and so alias *differently* per channel —
 * the noise decorrelates into coloured sparkle. A light backdrop is merely
 * where the contrast makes all of this easiest to see.
 *
 * The cure is the textbook one — low-pass what is undersampled — but it cannot
 * be the pre-refraction `blur`: that is a look (frosting), it applies to the
 * flat centre too, and the centre is meant to stay clear. So the smoothing runs
 * on the *output* of the refraction, masked to the bezel band by the
 * displacement map's blue channel, which encodes the field's own magnitude.
 * The mask is therefore exactly "where the sampling is unsafe", fading with the
 * LUT, and the flat centre never sees it. Nothing of value is lost inside the
 * band either: content there is already smeared by the lens, so a pixel of blur
 * removes the speckle and nothing else.
 *
 * Scaled with `displacement` rather than fixed so it breathes with the droplet
 * morph: a resting knob (displacement 0) filters nothing and must not carry a
 * frosted ring, and the smoothing arrives together with the refraction that
 * needs it.
 *
 * The ratio is sized against the sampling stride, not against taste. The LUT
 * sheds half its magnitude within the first tenth of the bezel, so between two
 * radially adjacent output pixels the sample point travels roughly half the
 * peak displacement — a 40px-peak knob samples ~20px apart at the outline. A
 * blur only suppresses noise below roughly its own stdDeviation of scale, so
 * the σ has to be commensurate with the stride: displacement/8 is the point
 * where the speckle dissolves into the smooth compressed streaks the rim shows
 * on the reference effect. It sounds destructive and is not — the mask fades
 * with the LUT, so σ this size only ever fully applies in the outermost band
 * where the imagery is 10–20× compressed already.
 */
export const RIM_ANTIALIAS_PER_DISPLACEMENT = 1 / 8;
export const RIM_ANTIALIAS_MAX = 6;

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
