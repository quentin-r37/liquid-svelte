/**
 * Liquid Glass — public API.
 *
 * ```svelte
 * <script lang="ts">
 *   import { LiquidGlass } from 'liquid-svelte';
 * </script>
 *
 * <LiquidGlass width={280} height={140} borderRadius={48} bezel={26} interactive>
 *   <p>Refracted content</p>
 * </LiquidGlass>
 * ```
 *
 * `displacement` is intentionally left unset above: it defaults to four times the
 * bezel, which is what the effect actually needs. See `glassTokens.ts`.
 */

export { default as LiquidGlass } from './LiquidGlass.svelte';
export { default as LiquidGlassFilter } from './LiquidGlassFilter.svelte';

export type {
	DisplacementMapParams,
	GlassMap,
	GlassMapStats,
	GlassMode,
	GlassQuality,
	GlassTier,
	LiquidGlassProps,
	SpecularMapParams,
	SurfaceProfile
} from './liquidGlass.types.js';

export { getDisplacementMap } from './displacement/createDisplacementMap.js';
export { getSpecularMap, specularWidthFor } from './displacement/createSpecularMap.js';
export { clearGlassMapCaches, getGlassMapStats, quantiseSize } from './displacement/mapCache.js';
export { getMagnitudeLut, sampleLut } from './displacement/surfaceProfiles.js';
export { sampleRoundedBox } from './displacement/roundedBoxSdf.js';
export type { EdgeSample } from './displacement/roundedBoxSdf.js';

export {
	glassSupport,
	reducedMotion,
	resolveGlassSupport,
	resolveTier,
	setGlassModeOverride
} from './runtime/capabilities.svelte.js';

export { DISPLACEMENT_PER_BEZEL, GLASS_DEFAULTS, QUALITY_PRESETS } from './runtime/glassTokens.js';
export type { QualityPreset } from './runtime/glassTokens.js';

export { applyGlassStyle } from './runtime/applyGlassStyle.js';
export { trackPointer } from './runtime/pointerTracking.js';
export type { PointerTrackingOptions } from './runtime/pointerTracking.js';
export { observeSize } from './runtime/sharedResizeObserver.js';
