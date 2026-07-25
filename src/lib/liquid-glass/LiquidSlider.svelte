<script lang="ts">
	import { animate, cancelFrame, frame } from 'motion';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { DropletMorph } from './runtime/dropletMorph.svelte.js';
	import {
		acquireGlassTransform,
		stepStretch,
		type GlassTransform
	} from './runtime/glassMotion.js';
	import { SLIDER_RAIL_HEIGHT, SLIDER_THUMB } from './runtime/glassTokens.js';
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

	/**
	 * The knob idles smaller than it is laid out (see {@link SLIDER_THUMB}), so every
	 * position in this component is expressed against its *idle* footprint: that is
	 * the box the user sees sliding along the rail, and the box the native range
	 * input's own thumb has to match for the drag to track the pointer exactly.
	 *
	 * The element is therefore pulled left by half the difference, so at value = min
	 * its visible left edge sits on the rail's left edge rather than inset by the
	 * slack. When it swells it grows past both ends of its travel — which is exactly
	 * the reference behaviour, and why nothing here may clip.
	 */
	const REST_WIDTH = SLIDER_THUMB.width * SLIDER_THUMB.restScale;
	const REST_INSET = -(SLIDER_THUMB.width - REST_WIDTH) / 2;

	let trackElement = $state<HTMLElement | null>(null);
	let trackWidth = $state(0);
	let thumbElement = $state<HTMLElement | null>(null);
	let thumbTransform = $state<GlassTransform | null>(null);

	const fraction = $derived(max === min ? 0 : (value - min) / (max - min));
	const travel = $derived(Math.max(0, trackWidth - REST_WIDTH));

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

	/**
	 * `pressScale` carries the whole rest ↔ droplet swell, so it starts at the idle
	 * scale rather than at 1. It is set imperatively rather than animated because
	 * this is a static state, not a gesture — animating it here would make the knob
	 * shrink into place on mount.
	 */
	$effect(() => {
		if (!thumbElement) return;
		const transform = acquireGlassTransform(thumbElement);
		transform.pressScale.set(SLIDER_THUMB.restScale);
		thumbTransform = transform;
		return () => {
			thumbTransform = null;
			transform.pressScale.set(1);
			transform.release();
		};
	});

	/**
	 * The thumb follows the value with a stiff spring rather than tracking the
	 * pointer directly. That keeps a single code path for pointer drags, arrow keys,
	 * Home/End and programmatic changes — and a stiff enough spring is
	 * indistinguishable from direct tracking while dragging.
	 */
	let arrived = false;

	$effect(() => {
		const transform = thumbTransform;
		if (!transform) return;

		const animation = animate(
			transform.x,
			fraction * travel,
			springFor('track', reducedMotion.current)
		);
		// Any change of target means the thumb is about to move, whatever caused it.
		// Idempotent — the frame loop queues processes in a set — so re-arming on every
		// value change costs nothing, and `deform` disarms itself once the thumb settles.
		//
		// Except on the first run, which is not the thumb moving but the thumb arriving:
		// `x` starts at 0 and springs to wherever the initial value sits, which on a
		// half-way slider is half the track's width of travel. Deformation answers motion
		// the user caused, so a page full of sliders must not squash itself on load.
		if (arrived) frame.update(deform, true);
		arrived = true;

		return () => {
			animation.stop();
			cancelFrame(deform);
		};
	});

	/**
	 * Squash the thumb along its travel when it is moving fast.
	 *
	 * Read off the thumb's *own* animated velocity, once a frame, rather than measured
	 * between consecutive `input` events — which is what this used to do, and which was
	 * wrong three ways at once.
	 *
	 * It divided by the raw gap between two events with no floor on it. A stepped slider
	 * moves the thumb a whole step at a time (3px on a 300px track over 0–100), and a
	 * 1000Hz pointer can deliver two `input` events a fraction of a millisecond apart, so
	 * the reading was routinely thousands of px/s while the knob crawled — saturating the
	 * deformation cap outright.
	 *
	 * It also stopped dead whenever the value did. `input` only fires on a *change*, so a
	 * finger resting mid-drag, or held between two steps, emitted nothing and the
	 * deformation froze at whatever the last burst produced instead of decaying.
	 *
	 * And it sprang towards each new target with `applyStretch`, once per event, in an
	 * unbroken run — the divergence documented on {@link stepStretch}, which needs only
	 * two calls close together to leave for the float32 ceiling.
	 *
	 * The thumb's `x` is animated by the `track` spring, so `getVelocity()` is real here
	 * (unlike a dragged surface, whose position is `set`) and it already describes what
	 * the eye actually sees moving — including keyboard steps and programmatic changes,
	 * which all arrive through that same spring.
	 */
	function deform({ delta }: { delta: number }) {
		const transform = thumbTransform;
		if (!transform) return cancelFrame(deform);

		if (!stepStretch(transform, transform.x.getVelocity(), 0, delta, reducedMotion.current)) {
			cancelFrame(deform);
		}
	}

	function onInput(event: Event & { currentTarget: HTMLInputElement }) {
		value = event.currentTarget.valueAsNumber;
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
				SLIDER_THUMB.activeScale,
				springFor('droplet', reducedMotion.current)
			);
		}
	}

	function relax() {
		const transform = thumbTransform;
		if (!transform) return;

		// Nothing to unwind here. `deform` carries the deformation back to rest on its
		// own as the thumb's velocity decays, and springing it home from this side would
		// put an animation and the frame tick on the same two channels, each overwriting
		// the other once a frame for the length of the spring's tail.
		if (!engaged) return;
		engaged = false;
		droplet.release();
		animate(
			transform.pressScale,
			SLIDER_THUMB.restScale,
			springFor('settle', reducedMotion.current)
		);
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
	<div
		class="lg-slider-track"
		bind:this={trackElement}
		style:--lg-slider-rail={`${SLIDER_RAIL_HEIGHT}px`}
		style:--lg-slider-row={`${SLIDER_THUMB.height}px`}
		style:--lg-slider-knob={`${REST_WIDTH}px`}
		style:--lg-slider-inset={`${REST_INSET}px`}
	>
		<span class="lg-slider-rail"></span>
		<!--
			The fill stops under the knob's centre, not at a plain percentage of the
			rail: the knob's centre travels from half its own width to the rail's width
			minus that same half, so a percentage would drift away from it at both ends.
			Expressed in `calc` rather than from the measured width so it is already
			correct on the server, before any ResizeObserver has fired.
		-->
		<span
			class="lg-slider-fill"
			style:width={`calc(${fraction} * (100% - var(--lg-slider-knob)) + var(--lg-slider-knob) / 2)`}
		></span>

		<LiquidGlass
			bind:element={thumbElement}
			width={SLIDER_THUMB.width}
			height={SLIDER_THUMB.height}
			borderRadius={SLIDER_THUMB.height / 2}
			bezel={SLIDER_THUMB.bezel}
			displacement={SLIDER_THUMB.bezel * droplet.visual.displacementRatio}
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

	/*
	 * The row is as tall as the knob's *full* geometry, not its idle size, so the
	 * swell on grab has somewhere to go without shifting the layout around it.
	 */
	.lg-slider-track {
		position: relative;
		flex: 1;
		min-width: 0;
		height: var(--lg-slider-row);
		display: flex;
		align-items: center;
	}

	.lg-slider-rail,
	.lg-slider-fill {
		position: absolute;
		left: 0;
		height: var(--lg-slider-rail);
		border-radius: calc(var(--lg-slider-rail) / 2);
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
	 * The thumb is parked at the left edge and moved entirely by Motion's transform
	 * channel, so nothing here competes with the animation. The negative offset is
	 * the layout/idle size difference — see REST_INSET.
	 */
	.lg-slider-track :global(.lg-slider-thumb) {
		position: absolute;
		left: var(--lg-slider-inset);
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

	/*
	 * The invisible native thumb is sized to the *idle* knob, and that width is load
	 * bearing rather than cosmetic: the browser maps a pointer position to a value by
	 * treating the thumb's own width as the slack at each end. Leave it at some other
	 * size and the glass knob drifts away from the pointer towards the extremes.
	 */
	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: var(--lg-slider-knob);
		height: var(--lg-slider-row);
		border-radius: 50%;
		background: transparent;
	}

	input[type='range']::-moz-range-thumb {
		width: var(--lg-slider-knob);
		height: var(--lg-slider-row);
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
