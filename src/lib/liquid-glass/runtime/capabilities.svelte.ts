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
	}
};

/**
 * Run capability detection. Idempotent and client-only; call it from an
 * `$effect` so the initial render still matches the server output.
 */
export function resolveGlassSupport(): void {
	if (detected === null) detected = detect();
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
