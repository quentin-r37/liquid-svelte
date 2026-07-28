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
export type { ButtonShape } from './LiquidButton.svelte';
export { default as LiquidSwitch } from './LiquidSwitch.svelte';
export { default as LiquidSlider } from './LiquidSlider.svelte';
export { default as LiquidLens } from './LiquidLens.svelte';
export { default as LiquidTabs } from './LiquidTabs.svelte';
export type { LiquidTab } from './LiquidTabs.svelte';
export { default as LiquidMenu } from './LiquidMenu.svelte';
export type { LiquidMenuItem, MenuPlacement } from './LiquidMenu.svelte';
export { default as LiquidSearchField } from './LiquidSearchField.svelte';
export type { SearchAnchor, SearchFieldSize } from './LiquidSearchField.svelte';
export { default as LiquidToolbar } from './LiquidToolbar.svelte';
export type { LiquidToolbarItem, ToolbarAnchor } from './LiquidToolbar.svelte';
export { default as LiquidNavBar } from './LiquidNavBar.svelte';
export type { NavBarPosition } from './LiquidNavBar.svelte';
export { default as LiquidScrollEdge } from './LiquidScrollEdge.svelte';
export type { ScrollEdgeSide } from './LiquidScrollEdge.svelte';
export { default as LiquidCard } from './LiquidCard.svelte';
export { default as LiquidPopover } from './LiquidPopover.svelte';
export type { PopoverPlacement } from './LiquidPopover.svelte';
export { default as LiquidDialog } from './LiquidDialog.svelte';
export type { DialogPresentation } from './LiquidDialog.svelte';

export type {
	CornerShape,
	DisplacementMapParams,
	GlassMap,
	GlassMapStats,
	GlassMode,
	GlassQuality,
	GlassTier,
	GlassVariant,
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
export { cornerExponent, cornerShapeCss, matchedRadius } from './displacement/cornerShape.js';

export {
	glassSupport,
	reducedMotion,
	resolveGlassSupport,
	resolveTier,
	setGlassModeOverride
} from './runtime/capabilities.svelte.js';

export { devicePixelRatio, resolveDevicePixelRatio } from './runtime/devicePixelRatio.svelte.js';

export {
	CORNER_K_MAX,
	CORNER_K_MIN,
	DISPLACEMENT_PER_BEZEL,
	DROPLET_ACTIVE,
	DROPLET_REST,
	GLASS_DEFAULTS,
	BUTTON_CIRCLE_BEZEL_RATIO,
	BUTTON_CIRCLE_SIZES,
	CARD_GEOMETRY,
	DIALOG_GEOMETRY,
	DIALOG_SURFACE,
	MATERIAL_VARIANTS,
	MENU_GLASS,
	POPOVER_GEOMETRY,
	POPOVER_GLASS,
	NAVBAR_GEOMETRY,
	QUALITY_PRESETS,
	SCROLL_EDGE,
	SEARCH_BEZEL_RATIO,
	SPECULAR_SUPERSAMPLE_MAX,
	TABS_BUBBLE_ACTIVE,
	TABS_BUBBLE_REST,
	TABS_GLASS,
	TOOLBAR_BEZEL_RATIO,
	TOOLBAR_GLASS,
	TOOLBAR_SHADOW,
	TOOLBAR_SIZES
} from './runtime/glassTokens.js';
export type {
	DropletVisual,
	MaterialVariant,
	QualityPreset,
	ToolbarSize
} from './runtime/glassTokens.js';

export { DropletMorph } from './runtime/dropletMorph.svelte.js';

export { setGlassProperties } from './runtime/applyGlassStyle.js';
export { trackPointer } from './runtime/pointerTracking.js';
export type { PointerTrackingOptions } from './runtime/pointerTracking.js';
export { observeSize } from './runtime/sharedResizeObserver.js';
export { observeScroll } from './runtime/sharedScrollListener.js';

export {
	acquireGlassTransform,
	applyDrag,
	applyHover,
	applyPress,
	applyStretch,
	stepStretch,
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
	DIALOG_COLLAPSE,
	DIALOG_ENTER,
	MAX_STRETCH,
	POPOVER_COLLAPSE,
	POPOVER_PUDDLE,
	POPOVER_PUDDLE_ROUNDNESS,
	POPOVER_RISE_DELAY,
	SEARCH_COLLAPSE,
	SEARCH_MORPH_GATHER,
	SEARCH_MORPH_LEAD,
	SEARCH_MORPH_VOLUME,
	SHEET_COLLAPSE,
	TOOLBAR_COLLAPSE,
	TOOLBAR_ITEM_FADE,
	TOOLBAR_ITEM_RISE,
	TOOLBAR_MORPH_GATHER,
	TOOLBAR_MORPH_LEAD,
	TOOLBAR_MORPH_VOLUME
} from './runtime/motionTokens.js';
export type { SpringName } from './runtime/motionTokens.js';
