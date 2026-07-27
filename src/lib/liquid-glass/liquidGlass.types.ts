import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Height profile of the glass surface across the bezel.
 *
 * The profile is sampled on `x ∈ [0, 1]` where `0` is the outer edge of the
 * element and `1` is the inner boundary of the bezel. Its *slope* — not its
 * height — drives the refraction magnitude, which is why a flat centre
 * (slope 0) stays perfectly stable.
 */
export type SurfaceProfile = 'convex-squircle' | 'convex-circle' | 'concave' | 'lip';

/**
 * Shape of the corner *outline*, mirroring the CSS `corner-shape` property.
 *
 * Orthogonal to {@link SurfaceProfile}, which shapes the glass surface inside the
 * bezel. This one shapes the silhouette: `round` is the quarter-ellipse of plain
 * `border-radius`, `continuous` is Apple's continuous corner curve — the one iOS
 * menus, cards and sheets actually use, a superellipse at `K = 1.3` to within a
 * third of a percent of the radius (measured against the SDK; see
 * `displacement/cornerShape.ts`) — and `squircle` is the quartic superellipse of
 * CSS `corner-shape: squircle`, which is distinctly squarer than anything iOS
 * draws. A number is CSS's `superellipse()` argument `K` directly — `1` is
 * `round`, `1.3` is `continuous`, `2` is `squircle`, larger is squarer, and
 * values are clamped to `[1, 10]`.
 *
 * Concave corners (`bevel`, `scoop`, `notch`, i.e. `K ≤ 0`) are not supported;
 * see `displacement/cornerShape.ts` for why they need a different field rather
 * than a different exponent.
 *
 * Anything other than `round` requires the browser to support `corner-shape`
 * (Chromium 139+). Where it does not, `LiquidGlass` falls back to `round` for the
 * generated maps *and* the stylesheet together, so the two can never disagree.
 */
export type CornerShape = 'round' | 'continuous' | 'squircle' | number;

/**
 * Quality preset. Trades displacement-map resolution and SVG filter
 * complexity against per-frame GPU cost. See `QUALITY_PRESETS`.
 */
export type GlassQuality = 'low' | 'medium' | 'high';

/**
 * Material variant, mirroring iOS 26's two `Glass` materials.
 *
 * `regular` is what the platform builds its *controls* out of — buttons,
 * toolbars, menus: a heavy frost with a milky luminance lift, under which the
 * backdrop survives only as colour and motion. `clear` is the transparent
 * material iOS reserves for surfaces floating over media, where the backdrop
 * itself is the point and legibility is delegated to a dimming layer behind
 * the content.
 *
 * The variant supplies *defaults* for `blur`, `opacity` and `saturation` (see
 * `MATERIAL_VARIANTS`); any of those props set explicitly still wins, which is
 * what keeps the droplet morphs — whose endpoints drive all three per frame —
 * entirely outside this switch.
 */
export type GlassVariant = 'regular' | 'clear';

/**
 * Rendering tier actually used by a glass surface.
 *
 * - `full` — SVG displacement map inside `backdrop-filter` (Chromium only).
 * - `degraded` — plain `backdrop-filter: blur() saturate()`, no distortion.
 * - `flat` — no backdrop filtering at all; denser tint keeps content legible.
 */
export type GlassTier = 'full' | 'degraded' | 'flat';

/** Same as {@link GlassTier} plus `auto`, which defers to capability detection. */
export type GlassMode = 'auto' | GlassTier;

/** Geometry + optics that fully determine a displacement map. */
export interface DisplacementMapParams {
	/** Element width in CSS pixels. */
	width: number;
	/** Element height in CSS pixels. */
	height: number;
	/** Effective corner radius in CSS pixels (clamped to `min(w, h) / 2`). */
	radius: number;
	/** Corner outline. Defaults to `round`, the plain `border-radius` corner. */
	cornerShape?: CornerShape;
	/** Thickness of the refracting rim in CSS pixels (clamped to `min(w, h) / 2`). */
	bezel: number;
	profile: SurfaceProfile;
	/** Map resolution multiplier — `1` renders one map pixel per CSS pixel. */
	resolution: number;
}

/** Geometry that fully determines a specular rim map. */
export interface SpecularMapParams {
	width: number;
	height: number;
	radius: number;
	/**
	 * Corner outline. Must match the displacement map's, or the hairline stops
	 * following the silhouette at the corners.
	 */
	cornerShape?: CornerShape;
	/** Width of the bright hairline in CSS pixels. */
	rimWidth: number;
	/**
	 * Device pixels per CSS pixel, used to pick a supersampling factor so the rim
	 * is not upscaled by `feImage`. Defaults to `1`; pass
	 * `devicePixelRatio.current` to keep it correct across zoom.
	 */
	pixelRatio?: number;
}

/** A generated, cacheable texture fed to `<feImage href>`. */
export interface GlassMap {
	/** `data:image/png;base64,…` */
	url: string;
	/** Map width in pixels (may be smaller than the element; `feImage` stretches it). */
	width: number;
	/** Map height in pixels. */
	height: number;
}

/** Counters exposed for the debug panel, to prove maps are not rebuilt per frame. */
export interface GlassMapStats {
	/** Maps actually rasterised since page load, across all generators. */
	generations: number;
	/** Cache hits served without rasterising. */
	hits: number;
	/** Entries currently held across the LRU caches. */
	cacheSize: number;
}

export interface LiquidGlassProps extends Omit<HTMLAttributes<HTMLElement>, 'style' | 'class'> {
	/** Fixed width in CSS pixels. Omit to size from content and measure via `ResizeObserver`. */
	width?: number;
	/** Fixed height in CSS pixels. Omit to size from content and measure via `ResizeObserver`. */
	height?: number;
	/** Corner radius in CSS pixels. Large values are clamped to a pill shape. */
	borderRadius?: number;
	/**
	 * Corner outline — `round` (default) or `squircle`, or a `superellipse()` `K`.
	 * Silently stays `round` where the browser has no `corner-shape` support, since
	 * the generated maps and the CSS clip have to describe the same silhouette.
	 */
	cornerShape?: CornerShape;
	/** Thickness of the refracting rim in CSS pixels. Refraction is concentrated here. */
	bezel?: number;
	/**
	 * Material variant — `regular` (default) is the frosted, milky material iOS
	 * builds its controls from; `clear` is the transparent one it floats over
	 * media. Supplies the defaults for `blur`, `opacity` and `saturation`;
	 * setting any of those explicitly overrides the variant's value for it.
	 */
	variant?: GlassVariant;
	/**
	 * Peak refraction offset in CSS pixels at the outer edge. Leave unset to derive
	 * it from `bezel` (×4), which is what keeps the effect looking right across
	 * sizes. Expect large numbers — a 24px bezel wants ~96px.
	 */
	displacement?: number;
	/**
	 * Backdrop blur radius in pixels, applied *before* refraction. Defaults from
	 * the `variant` — heavy frost for `regular`, ~0.5 for `clear`. On a `clear`
	 * surface keep explicit values under ~1.5: past that the frost swallows the
	 * distortion that makes the material read as liquid.
	 */
	blur?: number;
	/** Opacity of the tint layer, `0`–`1`. Defaults from the `variant`. */
	opacity?: number;
	/**
	 * Backdrop saturation multiplier — `1` leaves colours untouched. Defaults
	 * from the `variant`.
	 */
	saturation?: number;
	/** Per-channel displacement spread, `0`–`0.2`. `0` disables the 3-pass chain. */
	chromaticAberration?: number;
	/** Strength of the specular highlight, `0`–`1`. */
	specularIntensity?: number;
	/**
	 * Width of the generated specular rim in CSS pixels. Leave unset to derive it
	 * from `bezel` (×0.09, clamped 1.5–4), which tracks the reference look. Unlike
	 * `specularIntensity` this is part of the specular map's cache key — geometry,
	 * not a live filter attribute — so set it, don't animate it.
	 */
	specularWidth?: number;
	/** Strength of the outer drop shadow, `0`–`1`. */
	shadowIntensity?: number;
	profile?: SurfaceProfile;
	quality?: GlassQuality;
	/** Force a rendering tier. `auto` (default) uses capability detection. */
	mode?: GlassMode;
	/** Track the pointer and expose `--pointer-*` / `--highlight-*` custom properties. */
	interactive?: boolean;
	disabled?: boolean;
	/** Host element tag — `button`, `label`, … so wrappers keep native semantics. */
	tag?: keyof HTMLElementTagNameMap;
	/**
	 * Forwarded to the host element. Declared explicitly because the base type is
	 * `HTMLAttributes<HTMLElement>`, which has no `type` — and a glass surface
	 * rendered with `tag="button"` needs one to avoid defaulting to `submit`.
	 */
	type?: 'button' | 'submit' | 'reset';
	/** Bindable reference to the host element. */
	element?: HTMLElement | null;
	class?: string;
	style?: string;
	children?: Snippet;
}
