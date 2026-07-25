/**
 * Liquid Glass — public API.
 *
 * ```svelte
 * <script lang="ts">
 *   import { LiquidGlass } from 'liquid-svelte';
 * </script>
 *
 * <LiquidGlass width={280} height={120} bezel={22} displacement={16} interactive>
 *   <p>Refracted content</p>
 * </LiquidGlass>
 * ```
 */

export { default as LiquidGlass } from './LiquidGlass.svelte';
export { default as LiquidGlassFilter } from './LiquidGlassFilter.svelte';

export type {
	DisplacementMap,
	DisplacementMapParams,
	DisplacementMapStats,
	GlassMode,
	GlassQuality,
	GlassTier,
	LiquidGlassProps,
	SurfaceProfile
} from './liquidGlass.types.js';

export {
	clearDisplacementMapCache,
	getDisplacementMap,
	getDisplacementMapStats,
	quantiseSize
} from './displacement/createDisplacementMap.js';

export {
	glassSupport,
	reducedMotion,
	resolveGlassSupport,
	resolveTier,
	setGlassModeOverride
} from './runtime/capabilities.svelte.js';

export { GLASS_DEFAULTS, QUALITY_PRESETS } from './runtime/glassTokens.js';
export type { QualityPreset } from './runtime/glassTokens.js';

export { applyGlassStyle } from './runtime/applyGlassStyle.js';
export { trackPointer } from './runtime/pointerTracking.js';
export type { PointerTrackingOptions } from './runtime/pointerTracking.js';
export { observeSize } from './runtime/sharedResizeObserver.js';
