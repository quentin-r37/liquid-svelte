<script lang="ts">
	import { animate } from 'motion';
	import type { Snippet } from 'svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { DropletMorph } from './runtime/dropletMorph.svelte.js';
	import {
		acquireGlassTransform,
		applyDrag,
		applyHover,
		type GlassTransform
	} from './runtime/glassMotion.js';
	import { DROPLET_ACTIVE } from './runtime/glassTokens.js';
	import { springFor } from './runtime/motionTokens.js';

	interface Props {
		checked?: boolean;
		disabled?: boolean;
		/** Accessible name. Required unless `labelledBy` is given. */
		label?: string;
		labelledBy?: string;
		size?: 'sm' | 'md';
		quality?: GlassQuality;
		mode?: GlassMode;
		class?: string;
		style?: string;
		onchange?: (checked: boolean) => void;
		/** Optional visible label, rendered after the control. */
		children?: Snippet;
	}

	let {
		checked = $bindable(false),
		disabled = false,
		label,
		labelledBy,
		size = 'md',
		quality = 'high',
		mode = 'auto',
		class: className = '',
		style = '',
		onchange,
		children
	}: Props = $props();

	const uid = $props.id();
	const labelId = `${uid}-label`;

	/** Pointer travel below which a gesture counts as a tap, not a drag. */
	const TAP_THRESHOLD = 3;

	const metrics = $derived(
		size === 'sm' ? { width: 46, height: 28, padding: 3 } : { width: 62, height: 36, padding: 4 }
	);
	const thumbSize = $derived(metrics.height - metrics.padding * 2);
	const travel = $derived(metrics.width - metrics.padding * 2 - thumbSize);

	let switchElement = $state<HTMLButtonElement | null>(null);
	let thumbElement = $state<HTMLElement | null>(null);
	let thumbTransform = $state<GlassTransform | null>(null);
	let dragging = $state(false);

	/** Set when a gesture moved far enough to be a drag, so the click is swallowed. */
	let suppressClick = false;

	const droplet = new DropletMorph();
	$effect(() => droplet.setReduced(reducedMotion.current));
	$effect(() => () => droplet.destroy());

	/**
	 * Melting the knob into a droplet, and swelling it.
	 *
	 * The swell goes through the transform's `pressScale` channel rather than a CSS
	 * variable on the `style` attribute: Svelte rewrites that attribute wholesale
	 * when it changes, which would wipe Motion's `transform` and the pointer
	 * properties once per frame.
	 */
	function melt(active: boolean) {
		if (active) droplet.engage();
		else droplet.release();

		const transform = thumbTransform;
		if (!transform) return;
		animate(
			transform.pressScale,
			active ? DROPLET_ACTIVE.scale : 1,
			springFor(active ? 'droplet' : 'settle', reducedMotion.current)
		);
	}

	/*
	 * Acquisition is kept in its own effect, separate from the travel animation.
	 * Releasing and re-acquiring on every toggle would tear down the shared
	 * transform and snap the thumb back to zero mid-flight.
	 */
	$effect(() => {
		if (!thumbElement) return;
		const transform = acquireGlassTransform(thumbElement);
		thumbTransform = transform;
		return () => {
			thumbTransform = null;
			transform.release();
		};
	});

	/**
	 * The thumb travels by animating the transform's `x` channel rather than a CSS
	 * `left` transition: an elastic spring interrupted mid-travel carries its
	 * velocity into the new direction, which a CSS transition cannot do.
	 *
	 * Skipped while a drag is in flight — there the finger owns the position.
	 *
	 * No `will-change` here either. It is a hint for *anticipated* changes, and a
	 * toggle cannot be anticipated; by the time we know, the animation has started.
	 * It is reserved for continuous gestures, which `applyDrag` brackets itself.
	 */
	$effect(() => {
		const transform = thumbTransform;
		if (!transform || dragging) return;

		const animation = animate(
			transform.x,
			checked ? travel : 0,
			springFor('elastic', reducedMotion.current)
		);

		return () => animation.stop();
	});

	/**
	 * The thumb is draggable, not just tappable — that is how the control behaves on
	 * iOS 26, and it is the interaction that makes the droplet legible: you push it
	 * across and it deforms as it goes.
	 *
	 * `restScale: 1` because the droplet morph owns the scale here; `applyDrag`'s
	 * default pick-up shrink would fight it.
	 */
	$effect(() => {
		const element = thumbElement;
		if (!element || disabled) return;

		const limit = travel;

		return applyDrag(element, {
			axis: 'x',
			reduced: reducedMotion.current,
			restScale: 1,
			keyboard: false,
			bounds: () => ({ minX: 0, maxX: limit, minY: 0, maxY: 0 }),

			snap: ({ x, velocityX, distance }) => {
				// A flick wins over position, so a short fast push still crosses over.
				const next = Math.abs(velocityX) > 220 ? velocityX > 0 : x > limit / 2;
				// A tap is not a drag: leave the position alone and let `onclick` toggle.
				return { x: distance < TAP_THRESHOLD ? (checked ? limit : 0) : next ? limit : 0, y: 0 };
			},

			onStart: () => {
				dragging = true;
				melt(true);
			},

			onEnd: ({ x, distance }) => {
				dragging = false;
				melt(false);

				if (distance < TAP_THRESHOLD) return;

				suppressClick = true;
				const next = x > limit / 2;
				if (next !== checked) {
					checked = next;
					onchange?.(checked);
				}
			},

			onCancel: () => {
				dragging = false;
				melt(false);
				suppressClick = true;
			}
		});
	});

	$effect(() => {
		if (!switchElement) return;
		return applyHover(switchElement, { reduced: reducedMotion.current, disabled });
	});

	function onClick() {
		// A completed drag ends with a click on the button; swallow that one.
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		if (disabled) return;

		checked = !checked;
		onchange?.(checked);
	}

	/** Space and Enter come through as clicks, so only the morph needs wiring. */
	function onKeyDown(event: KeyboardEvent) {
		if (event.key === ' ' || event.key === 'Enter') melt(true);
	}
</script>

<!--
	`role="switch"` on a real <button> rather than a checkbox input: it gives the
	correct announcement ("switch, on"), Space and Enter activation for free, and
	does not need a hidden input positioned under the glass.
-->
<div class={`lg-switch-row ${className}`} {style}>
	<button
		bind:this={switchElement}
		type="button"
		role="switch"
		aria-checked={checked}
		aria-label={labelledBy ? undefined : label}
		aria-labelledby={labelledBy ?? (children ? labelId : undefined)}
		{disabled}
		class="lg-switch"
		class:lg-switch-on={checked}
		style:width={`${metrics.width}px`}
		style:height={`${metrics.height}px`}
		style:border-radius={`${metrics.height / 2}px`}
		style:padding={`${metrics.padding}px`}
		onclick={onClick}
		onkeydown={onKeyDown}
		onkeyup={() => melt(false)}
		onblur={() => melt(false)}
	>
		<span class="lg-switch-track"></span>

		<LiquidGlass
			bind:element={thumbElement}
			width={thumbSize}
			height={thumbSize}
			borderRadius={thumbSize / 2}
			bezel={thumbSize / 2}
			displacement={(thumbSize / 2) * droplet.visual.displacementRatio}
			opacity={droplet.visual.opacity}
			saturation={droplet.visual.saturation}
			blur={droplet.visual.blur}
			specularIntensity={droplet.visual.specularIntensity}
			shadowIntensity={0.7}
			{quality}
			{mode}
			{disabled}
			class="lg-switch-thumb"
		/>
	</button>

	{#if children}
		<span id={labelId} class="lg-switch-label">{@render children()}</span>
	{/if}
</div>

<style>
	.lg-switch-row {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
	}

	/*
	 * The track is plain translucent CSS, not a second refracting surface. Nesting
	 * one backdrop-filter inside another does not compose — the inner one would only
	 * ever see the outer one's output — and a droplet sliding over a still track is
	 * what reads as a switch anyway.
	 */
	.lg-switch {
		position: relative;
		display: inline-flex;
		align-items: center;
		box-sizing: border-box;
		border: 0;
		background: none;
		cursor: pointer;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}

	.lg-switch:disabled {
		cursor: not-allowed;
	}

	.lg-switch-track {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: rgb(255 255 255 / 0.1);
		box-shadow:
			inset 0 1px 2px rgb(0 0 0 / 0.22),
			inset 0 0 0 1px rgb(255 255 255 / 0.14);
		/* Purely decorative colour change. The droplet's travel — the actual
		   movement — is driven by Motion. */
		transition:
			background-color 220ms ease,
			box-shadow 220ms ease;
	}

	.lg-switch-on .lg-switch-track {
		background: rgb(64 220 150 / 0.55);
		box-shadow:
			inset 0 1px 2px rgb(0 0 0 / 0.18),
			inset 0 0 0 1px rgb(255 255 255 / 0.28),
			0 0 14px rgb(64 220 150 / 0.35);
	}

	.lg-switch:focus-visible {
		outline: 2px solid rgb(255 255 255 / 0.85);
		outline-offset: 3px;
	}

	.lg-switch :global(.lg-switch-thumb) {
		position: relative;
		z-index: 1;
		cursor: grab;
	}

	.lg-switch :global(.lg-switch-thumb:active) {
		cursor: grabbing;
	}

	.lg-switch-label {
		font-size: 0.9rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.lg-switch-track {
			transition-duration: 0ms;
		}
	}
</style>
