<script lang="ts">
	import { animate } from 'motion';
	import type { Snippet } from 'svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { acquireGlassTransform, applyHover, type GlassTransform } from './runtime/glassMotion.js';
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

	const metrics = $derived(
		size === 'sm' ? { width: 44, height: 26, padding: 3 } : { width: 58, height: 34, padding: 4 }
	);
	const thumbSize = $derived(metrics.height - metrics.padding * 2);
	const travel = $derived(metrics.width - metrics.padding * 2 - thumbSize);

	let switchElement = $state<HTMLButtonElement | null>(null);
	let thumbElement = $state<HTMLElement | null>(null);
	let thumbTransform = $state<GlassTransform | null>(null);

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
	 * No `will-change` here. It is a hint for *anticipated* changes, and a toggle
	 * cannot be anticipated — by the time we know, the animation has already
	 * started. It is reserved for continuous gestures (hover, press, drag), where
	 * there is a real begin and end to bracket.
	 */
	$effect(() => {
		const transform = thumbTransform;
		if (!transform) return;

		const animation = animate(
			transform.x,
			checked ? travel : 0,
			springFor('elastic', reducedMotion.current)
		);

		return () => animation.stop();
	});

	$effect(() => {
		if (!switchElement) return;
		return applyHover(switchElement, { reduced: reducedMotion.current, disabled });
	});

	function toggle() {
		if (disabled) return;
		checked = !checked;
		onchange?.(checked);
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
		onclick={toggle}
	>
		<span class="lg-switch-track"></span>

		<LiquidGlass
			bind:element={thumbElement}
			width={thumbSize}
			height={thumbSize}
			borderRadius={thumbSize / 2}
			bezel={thumbSize / 2}
			saturation={2.4}
			opacity={0.1}
			specularIntensity={0.95}
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
	 * one backdrop-filter inside another does not compose — the inner one would
	 * only ever see the outer one's output — and a thumb sliding over a still track
	 * is what reads as a switch anyway.
	 */
	.lg-switch {
		position: relative;
		display: inline-flex;
		align-items: center;
		box-sizing: border-box;
		border: 0;
		background: none;
		cursor: pointer;
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
		/* Purely decorative colour change, so a CSS transition is appropriate. The
		   thumb's travel — the actual movement — is driven by Motion. */
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
