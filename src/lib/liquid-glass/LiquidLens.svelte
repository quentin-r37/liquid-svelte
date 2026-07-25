<script lang="ts">
	import type { Snippet } from 'svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality, SurfaceProfile } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { applyDrag, type DragBounds } from './runtime/glassMotion.js';

	interface Props {
		width?: number;
		height?: number;
		borderRadius?: number;
		bezel?: number;
		displacement?: number;
		profile?: SurfaceProfile;
		quality?: GlassQuality;
		mode?: GlassMode;
		disabled?: boolean;
		/**
		 * Constrain the lens to a container's box. Must be the lens's `offsetParent`
		 * — i.e. a positioned ancestor — which is the normal setup for an absolutely
		 * positioned lens.
		 */
		container?: HTMLElement | null;
		/** Accessible name — this is a real control, so it needs one. */
		label?: string;
		class?: string;
		style?: string;
		onmove?: (x: number, y: number) => void;
		/** Content rendered on top of the glass, e.g. a magnification label. */
		children?: Snippet;
	}

	let {
		width = 200,
		height = 140,
		borderRadius = 70,
		bezel = 30,
		displacement,
		profile = 'convex-squircle',
		quality = 'high',
		mode = 'auto',
		disabled = false,
		container = null,
		label = 'Draggable lens',
		class: className = '',
		style = '',
		onmove,
		children
	}: Props = $props();

	let element = $state<HTMLElement | null>(null);

	/**
	 * Bounds are computed lazily on each drag start and each key press rather than
	 * cached, so the lens keeps behaving after the container is resized. Reading
	 * layout here is safe: it happens once per gesture, never per frame.
	 *
	 * Everything is expressed with `offset*`, which — unlike
	 * `getBoundingClientRect` — is unaffected by the live transform. That matters
	 * because the drag *is* a transform: measuring the transformed box would fold
	 * the current offset back into the limits and let the lens creep out of bounds.
	 */
	function bounds(): DragBounds | null {
		if (!container || !element) return null;

		const left = element.offsetLeft;
		const top = element.offsetTop;

		return {
			minX: -left,
			maxX: container.clientWidth - element.offsetWidth - left,
			minY: -top,
			maxY: container.clientHeight - element.offsetHeight - top
		};
	}

	$effect(() => {
		if (!element) return;
		return applyDrag(element, {
			reduced: reducedMotion.current,
			disabled,
			bounds,
			keyboard: true,
			onMove: onmove
		});
	});
</script>

<!--
	`role="application"` would be wrong and `role="slider"` misleading — a lens has
	no value. It is exposed as a focusable, named group instead, and the arrow-key
	handling in `applyDrag` makes it operable without a pointer. Escape abandons a
	pointer drag and restores the starting position.
-->
<LiquidGlass
	bind:element
	{width}
	{height}
	{borderRadius}
	{bezel}
	{displacement}
	{profile}
	{quality}
	{mode}
	{disabled}
	opacity={0.04}
	blur={0.4}
	saturation={1.35}
	specularIntensity={0.9}
	shadowIntensity={0.8}
	interactive
	class={`lg-lens ${className}`}
	{style}
	role="group"
	aria-label={label}
	aria-roledescription="draggable lens"
	aria-disabled={disabled ? 'true' : undefined}
	tabindex={disabled ? -1 : 0}
>
	{@render children?.()}
</LiquidGlass>

<style>
	/*
	 * A lens is an overlay, so it is taken out of flow: left in flow it would
	 * reserve a box and push the very content it is supposed to float over. Its
	 * `left`/`top` are set by the consumer, and `offsetLeft`/`offsetTop` — which the
	 * bounds calculation reads — resolve against the nearest positioned ancestor,
	 * i.e. the `container`.
	 */
	:global(.lg-lens) {
		position: absolute;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		cursor: grab;
	}

	:global(.lg-lens:active) {
		cursor: grabbing;
	}

	:global(.lg-lens:focus-visible) {
		outline: 2px solid rgb(255 255 255 / 0.9);
		outline-offset: 4px;
	}

	:global(.lg-lens[aria-disabled='true']) {
		cursor: not-allowed;
	}
</style>
