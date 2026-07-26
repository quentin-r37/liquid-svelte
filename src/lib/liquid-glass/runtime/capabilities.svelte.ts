import { MediaQuery } from 'svelte/reactivity';
import type { GlassMode, GlassTier } from '../liquidGlass.types.js';

/**
 * Which rendering tier the current browser can actually deliver, plus the
 * `prefers-reduced-motion` preference.
 *
 * ## Why this is a heuristic, and not a feature test
 *
 * Only Chromium renders an SVG filter referenced from `backdrop-filter`.
 * Firefox and WebKit parse `backdrop-filter: url(#id)` as valid — so
 * `CSS.supports()` returns `true` — and then paint nothing, leaving the glass
 * completely unstyled. A real functional test would mean rendering a known
 * pattern behind the filter and reading the composited pixels back, which no web
 * API allows (short of `getDisplayMedia`, and asking for screen-capture
 * permission to draw a button is obviously not an option).
 *
 * So detection combines the syntax check with an engine check, and every
 * consumer gets an escape hatch: the `mode` prop per component, or
 * {@link setGlassModeOverride} globally.
 */

/** Tier assumed during SSR. Renders an attractive, fully usable surface. */
const SSR_TIER: GlassTier = 'degraded';

/**
 * Minimal shape of the User-Agent Client Hints API. Declared locally because it
 * is still absent from the DOM lib typings, and it is optional at runtime.
 */
interface UserAgentBrand {
	brand: string;
	version: string;
}
type NavigatorWithUaData = Navigator & { userAgentData?: { brands?: UserAgentBrand[] } };

let detected = $state<GlassTier | null>(null);
let override = $state<GlassTier | null>(null);
let cornerShape = $state(false);

function supportsBackdropFilter(): boolean {
	return (
		CSS.supports('backdrop-filter', 'blur(2px)') ||
		CSS.supports('-webkit-backdrop-filter', 'blur(2px)')
	);
}

/**
 * True only for Chromium-family engines.
 *
 * `navigator.userAgentData.brands` is the reliable signal: the `Chromium` brand
 * is emitted by Chromium builds only, and the whole API is absent from Firefox
 * and WebKit. The UA-string branch is the fallback for Chromium builds that do
 * not expose UA-CH; it has to reject `CriOS`/`FxiOS`, which are WebKit shells
 * that put `Chrome`/`Firefox` in the UA string.
 */
function isChromium(): boolean {
	const brands = (navigator as NavigatorWithUaData).userAgentData?.brands;
	if (brands?.length) {
		return brands.some((entry) => /chromium/i.test(entry.brand));
	}

	const ua = navigator.userAgent;
	if (/Firefox|FxiOS|CriOS|EdgiOS|OPiOS/.test(ua)) return false;
	return /Chrome|Chromium|Edg\/|OPR\//.test(ua);
}

function detect(): GlassTier {
	if (typeof CSS === 'undefined' || typeof navigator === 'undefined') return SSR_TIER;
	if (!supportsBackdropFilter()) return 'flat';
	if (CSS.supports('backdrop-filter', 'url(#liquid-glass-probe)') && isChromium()) return 'full';
	return SSR_TIER;
}

/**
 * Whether `corner-shape` is honoured, which is what gates a non-round `cornerShape`.
 *
 * This one *is* a real feature test, unlike the tier detection above, and the
 * difference is worth being explicit about. `backdrop-filter: url()` is a lie in
 * two engines because referencing an SVG filter is a rendering capability they
 * parse but never implement. `corner-shape` is an ordinary paint-time property
 * with no such split: an engine that parses it clips to it, and one that does not
 * drops the declaration and leaves the corner round. So the syntax check answers
 * exactly the question that matters — will the element's own clip match the field
 * we are about to rasterise.
 *
 * Note the check is deliberately *not* gated on the tier. A `degraded` surface has
 * no displacement map to keep in sync, but it still has a silhouette, and there is
 * no reason for it to be squarer than a `full` one on the same browser.
 */
function detectCornerShape(): boolean {
	if (typeof CSS === 'undefined') return false;
	return CSS.supports('corner-shape', 'squircle');
}

export const glassSupport = {
	/**
	 * The tier to render. `degraded` until {@link resolveGlassSupport} runs on the
	 * client, so server and client markup agree during hydration.
	 */
	get tier(): GlassTier {
		return override ?? detected ?? SSR_TIER;
	},

	/** The detected tier, ignoring any override. `null` before detection runs. */
	get detected(): GlassTier | null {
		return detected;
	},

	get override(): GlassTier | null {
		return override;
	},

	/**
	 * Whether a non-round `cornerShape` will actually be clipped to. `false` until
	 * detection runs — and therefore during SSR, which is what keeps the server's
	 * round outline agreeing with the first client render.
	 */
	get cornerShape(): boolean {
		return cornerShape;
	}
};

/**
 * Run capability detection. Idempotent and client-only; call it from an
 * `$effect` so the initial render still matches the server output.
 */
export function resolveGlassSupport(): void {
	if (detected !== null) return;
	detected = detect();
	cornerShape = detectCornerShape();
}

/** Force a tier for the whole page, or pass `null` to return to detection. */
export function setGlassModeOverride(mode: GlassMode | null): void {
	override = mode === null || mode === 'auto' ? null : mode;
}

/** Resolve a component's `mode` prop against detection. */
export function resolveTier(mode: GlassMode | undefined): GlassTier {
	if (mode && mode !== 'auto') return mode;
	return glassSupport.tier;
}

/**
 * Reactive `prefers-reduced-motion`. SSR-safe (falls back to `false`) and
 * shared, so a page full of glass registers one media-query listener.
 */
export const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
