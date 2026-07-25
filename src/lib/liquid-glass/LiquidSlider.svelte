<script lang="ts">
	import { animate } from 'motion';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { DropletMorph } from './runtime/dropletMorph.svelte.js';
	import {
		acquireGlassTransform,
		applyStretch,
		type GlassTransform
	} from './runtime/glassMotion.js';
	import { DROPLET_ACTIVE } from './runtime/glassTokens.js';
	import { springFor } from './runtime/motionTokens.js';
	import { observeSize } from './runtime/sharedResizeObserver.js';

	interface Props {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		/** Accessible name. Required unless `labelledBy` is given. */
		label?: string;
		labelledBy?: string;
		/** Formats the value for `aria-valuetext` and the optional readout. */
		format?: (value: number) => string;
		/** Show the formatted value next to the track. */
		showValue?: boolean;
		quality?: GlassQuality;
		mode?: GlassMode;
		class?: string;
		style?: string;
		oninput?: (value: number) => void;
		onchange?: (value: number) => void;
	}

	let {
		value = $bindable(50),
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		label,
		labelledBy,
		format = (v) => String(Math.round(v)),
		showValue = false,
		quality = 'high',
		mode = 'auto',
		class: className = '',
		style = '',
		oninput,
		onchange
	}: Props = $props();

	const THUMB_SIZE = 30;

	let trackElement = $state<HTMLElement | null>(null);
	let trackWidth = $state(0);
	let thumbElement = $state<HTMLElement | null>(null);
	let thumbTransform = $state<GlassTransform | null>(null);

	const fraction = $derived(max === min ? 0 : (value - min) / (max - min));
	const travel = $derived(Math.max(0, trackWidth - THUMB_SIZE));

	$effect(() => {
		if (!trackElement) return;
		let last = -1;
		return observeSize(trackElement, (width) => {
			const rounded = Math.round(width);
			if (rounded === last) return;
			last = rounded;
			trackWidth = rounded;
		});
	});

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
	 * The thumb follows the value with a stiff spring rather than tracking the
	 * pointer directly. That keeps a single code path for pointer drags, arrow keys,
	 * Home/End and programmatic changes — and a stiff enough spring is
	 * indistinguishable from direct tracking while dragging.
	 */
	$effect(() => {
		const transform = thumbTransform;
		if (!transform) return;

		const animation = animate(
			transform.x,
			fraction * travel,
			springFor('track', reducedMotion.current)
		);
		return () => animation.stop();
	});

	/** Squash the thumb along its travel when the value is moving fast. */
	let lastPosition = 0;
	let lastTime = 0;

	function updateStretch() {
		const transform = thumbTransform;
		if (!transform) return;

		const now = performance.now();
		const position = fraction * travel;
		const elapsed = now - lastTime;

		if (lastTime > 0 && elapsed > 0) {
			applyStretch(
				transform,
				((position - lastPosition) / elapsed) * 1000,
				0,
				reducedMotion.current
			);
		}
		lastPosition = position;
		lastTime = now;
	}

	function onInput(event: Event & { currentTarget: HTMLInputElement }) {
		value = event.currentTarget.valueAsNumber;
		updateStretch();
		oninput?.(value);
	}

	/**
	 * Grabbing the knob melts it into a droplet, and releasing it freezes it back.
	 *
	 * This is the behaviour the effect actually has on iOS 26: the knob is an opaque
	 * tinted blob until you touch it, and only then does it swell, clear up and start
	 * refracting. A knob that is permanently glass reads as a smudge at this size —
	 * the transition is what makes it a droplet.
	 *
	 * `will-change` is bracketed here too: a drag or a held arrow key is exactly the
	 * "anticipated change" the hint exists for. Guarded by a boolean rather than
	 * leaning on `setActive`'s counter, because these are called from several
	 * overlapping events (pointer, key, focus, change) and an unbalanced pair would
	 * leave the hint stuck on.
	 */
	const droplet = new DropletMorph();
	$effect(() => droplet.setReduced(reducedMotion.current));
	$effect(() => () => droplet.destroy());

	let engaged = false;

	function engage() {
		if (engaged) return;
		engaged = true;

		const transform = thumbTransform;
		transform?.setActive(true);
		droplet.engage();
		// The swell goes through a transform channel, not a CSS variable: Svelte
		// rewrites the whole `style` attribute when it changes, which would wipe
		// Motion's transform once per frame.
		if (transform) {
			animate(
				transform.pressScale,
				DROPLET_ACTIVE.scale,
				springFor('droplet', reducedMotion.current)
			);
		}
	}

	function relax() {
		const transform = thumbTransform;
		if (!transform) return;

		lastTime = 0;
		applyStretch(transform, 0, 0, reducedMotion.current);

		if (!engaged) return;
		engaged = false;
		droplet.release();
		animate(transform.pressScale, 1, springFor('settle', reducedMotion.current));
		transform.setActive(false);
	}
</script>

<!--
	A real <input type="range"> does the work, stretched invisibly over the track.
	It brings pointer dragging, arrow keys, PageUp/PageDown, Home/End, the correct
	`slider` role and value announcements — all of which a div with `role="slider"`
	would have to reimplement, usually incompletely.
-->
<div class={`lg-slider ${className}`} {style} data-disabled={disabled ? 'true' : undefined}>
	<div class="lg-slider-track" bind:this={trackElement}>
		<span class="lg-slider-rail"></span>
		<span class="lg-slider-fill" style:width={`${fraction * 100}%`}></span>

		<LiquidGlass
			bind:element={thumbElement}
			width={THUMB_SIZE}
			height={THUMB_SIZE}
			borderRadius={THUMB_SIZE / 2}
			bezel={THUMB_SIZE / 2}
			displacement={(THUMB_SIZE / 2) * droplet.visual.displacementRatio}
			opacity={droplet.visual.opacity}
			saturation={droplet.visual.saturation}
			blur={droplet.visual.blur}
			specularIntensity={droplet.visual.specularIntensity}
			shadowIntensity={0.7}
			{quality}
			{mode}
			{disabled}
			class="lg-slider-thumb"
		/>

		<input
			type="range"
			{min}
			{max}
			{step}
			{value}
			{disabled}
			aria-label={labelledBy ? undefined : label}
			aria-labelledby={labelledBy}
			aria-valuetext={format(value)}
			oninput={onInput}
			onchange={() => {
				relax();
				onchange?.(value);
			}}
			onpointerdown={engage}
			onkeydown={engage}
			onpointerup={relax}
			onpointercancel={relax}
			onkeyup={relax}
			onblur={relax}
		/>
	</div>

	{#if showValue}
		<output class="lg-slider-value">{format(value)}</output>
	{/if}
</div>

<style>
	.lg-slider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.lg-slider-track {
		position: relative;
		flex: 1;
		min-width: 0;
		height: 30px;
		display: flex;
		align-items: center;
	}

	.lg-slider-rail,
	.lg-slider-fill {
		position: absolute;
		left: 0;
		height: 10px;
		border-radius: 5px;
		pointer-events: none;
	}

	.lg-slider-rail {
		right: 0;
		background: rgb(255 255 255 / 0.12);
		box-shadow:
			inset 0 1px 2px rgb(0 0 0 / 0.24),
			inset 0 0 0 1px rgb(255 255 255 / 0.12);
	}

	.lg-slider-fill {
		background: linear-gradient(90deg, rgb(120 200 255 / 0.5), rgb(90 250 200 / 0.65));
		box-shadow: 0 0 12px rgb(120 220 255 / 0.3);
	}

	/*
	 * The thumb is positioned at the left edge and moved entirely by Motion's
	 * transform channel, so nothing here competes with the animation.
	 */
	.lg-slider-track :global(.lg-slider-thumb) {
		position: absolute;
		left: 0;
		pointer-events: none;
	}

	/*
	 * The input stays a real, focusable control: it is made transparent rather than
	 * hidden, so it still receives pointer events across the whole track and keeps
	 * its native keyboard behaviour.
	 */
	input[type='range'] {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		appearance: none;
		background: none;
		cursor: grab;
	}

	input[type='range']:active {
		cursor: grabbing;
	}

	input[type='range']:disabled {
		cursor: not-allowed;
	}

	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: transparent;
	}

	input[type='range']::-moz-range-thumb {
		width: 30px;
		height: 30px;
		border: 0;
		border-radius: 50%;
		background: transparent;
	}

	/*
	 * The focus ring goes on the visible thumb, not the invisible input. `:has` is
	 * required rather than a sibling combinator: the input is painted *after* the
	 * thumb in the DOM so it can sit on top of it.
	 */
	.lg-slider-track:has(input:focus-visible) :global(.lg-slider-thumb) {
		outline: 2px solid rgb(255 255 255 / 0.85);
		outline-offset: 3px;
	}

	.lg-slider-value {
		min-width: 3ch;
		font-variant-numeric: tabular-nums;
		font-size: 0.85rem;
		text-align: right;
		opacity: 0.85;
	}

	/*
	 * Dimmed part by part. Putting `opacity` on the wrapper would make it a backdrop
	 * root and silently kill the thumb's refraction.
	 */
	.lg-slider[data-disabled='true'] .lg-slider-rail,
	.lg-slider[data-disabled='true'] .lg-slider-fill,
	.lg-slider[data-disabled='true'] .lg-slider-value {
		opacity: 0.45;
	}
</style>
