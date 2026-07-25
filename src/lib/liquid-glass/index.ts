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
export { default as LiquidButton } from './LiquidButton.svelte';
export { default as LiquidSwitch } from './LiquidSwitch.svelte';
export { default as LiquidSlider } from './LiquidSlider.svelte';
export { default as LiquidLens } from './LiquidLens.svelte';
export { default as LiquidTabs } from './LiquidTabs.svelte';
export type { LiquidTab } from './LiquidTabs.svelte';
export { default as LiquidMenu } from './LiquidMenu.svelte';
export type { LiquidMenuItem, MenuPlacement } from './LiquidMenu.svelte';

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

export {
	DISPLACEMENT_PER_BEZEL,
	DROPLET_ACTIVE,
	DROPLET_REST,
	GLASS_DEFAULTS,
	MENU_GLASS_OPEN,
	MENU_GLASS_REST,
	QUALITY_PRESETS
} from './runtime/glassTokens.js';
export type { DropletVisual, QualityPreset } from './runtime/glassTokens.js';

export { DropletMorph } from './runtime/dropletMorph.svelte.js';

export { setGlassProperties } from './runtime/applyGlassStyle.js';
export { trackPointer } from './runtime/pointerTracking.js';
export type { PointerTrackingOptions } from './runtime/pointerTracking.js';
export { observeSize } from './runtime/sharedResizeObserver.js';

export {
	acquireGlassTransform,
	applyDrag,
	applyHover,
	applyPress,
	applyStretch,
	draggable,
	hoverable,
	pressable
} from './runtime/glassMotion.js';
export type {
	DragBounds,
	DragOptions,
	DragRelease,
	GlassTransform,
	HoverOptions,
	PressOptions
} from './runtime/glassMotion.js';

export {
	REDUCED_MOTION_TRANSITION,
	SPRINGS,
	springFor,
	MAX_STRETCH
} from './runtime/motionTokens.js';
export type { SpringName } from './runtime/motionTokens.js';
