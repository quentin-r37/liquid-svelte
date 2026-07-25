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
 * Quality preset. Trades displacement-map resolution and SVG filter
 * complexity against per-frame GPU cost. See `QUALITY_PRESETS`.
 */
export type GlassQuality = 'low' | 'medium' | 'high';

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
	/** Width of the bright hairline in CSS pixels. */
	rimWidth: number;
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
	/** Thickness of the refracting rim in CSS pixels. Refraction is concentrated here. */
	bezel?: number;
	/**
	 * Peak refraction offset in CSS pixels at the outer edge. Leave unset to derive
	 * it from `bezel` (×4), which is what keeps the effect looking right across
	 * sizes. Expect large numbers — a 24px bezel wants ~96px.
	 */
	displacement?: number;
	/**
	 * Backdrop blur radius in pixels, applied *before* refraction. Keep it under
	 * ~1.5: liquid glass is clear, and frosting swallows the distortion.
	 */
	blur?: number;
	/** Opacity of the tint layer, `0`–`1`. */
	opacity?: number;
	/** Backdrop saturation multiplier — `1` leaves colours untouched. */
	saturation?: number;
	/** Per-channel displacement spread, `0`–`0.2`. `0` disables the 3-pass chain. */
	chromaticAberration?: number;
	/** Strength of the specular highlight, `0`–`1`. */
	specularIntensity?: number;
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
