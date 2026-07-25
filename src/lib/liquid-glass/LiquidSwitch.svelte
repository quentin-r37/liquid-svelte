<script lang="ts">
	import { animate } from 'motion';
	import type { Snippet } from 'svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality } from './liquidGlass.types.js';
	import { setGlassProperties } from './runtime/applyGlassStyle.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { DropletMorph } from './runtime/dropletMorph.svelte.js';
	import {
		acquireGlassTransform,
		applyDrag,
		applyHover,
		type GlassTransform
	} from './runtime/glassMotion.js';
	import { SWITCH_SIZES, SWITCH_THUMB, type SwitchSize } from './runtime/glassTokens.js';
	import { springFor } from './runtime/motionTokens.js';

	interface Props {
		checked?: boolean;
		disabled?: boolean;
		/** Accessible name. Required unless `labelledBy` is given. */
		label?: string;
		labelledBy?: string;
		size?: SwitchSize;
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

	/**
	 * Everything is derived from the knob's *idle* footprint, because that is the box
	 * the user sees riding the track — the element is laid out larger and scaled down
	 * (see {@link SWITCH_THUMB}), so the laid-out box is never what anything lines up
	 * against.
	 *
	 * The track's width is derived rather than tabulated: idle knob, plus its travel,
	 * plus the padding at each end. Tabulating it would let it drift out of agreement
	 * with the knob the moment a proportion changes.
	 *
	 * One consequence, shared with the slider: the idle scale lives on a Motion
	 * channel, so server-rendered markup shows the knob at its full laid-out size —
	 * overhanging the track — until the transform is acquired on the first client
	 * effect. It is set there imperatively rather than animated, so this resolves in a
	 * frame instead of shrinking into place.
	 */
	const geometry = $derived.by(() => {
		const { height, padding } = SWITCH_SIZES[size];

		// The idle knob fills the track's inner height; its laid-out box is therefore
		// larger by the idle scale, and it is that box the glass rasterises for.
		const restHeight = height - padding * 2;
		const thumbHeight = Math.round(restHeight / SWITCH_THUMB.restScale);
		const thumbWidth = Math.round(thumbHeight * SWITCH_THUMB.aspect);
		const restWidth = thumbWidth * SWITCH_THUMB.restScale;
		const width = Math.round(padding * 2 + restWidth + height * SWITCH_THUMB.travelRatio);

		return {
			height,
			width,
			thumbWidth,
			thumbHeight,
			travel: width - padding * 2 - restWidth,
			/**
			 * The knob is pulled left by half its idle slack, so at `checked = false`
			 * its visible left rim sits on the padding rather than inset by the slack.
			 * When it swells it grows past both ends of its travel and past the track's
			 * top and bottom — which is the reference behaviour, and why nothing from
			 * here up may clip.
			 */
			inset: padding - (thumbWidth - restWidth) / 2,
			bezel: Math.max(1, Math.round(thumbHeight * SWITCH_THUMB.bezelRatio))
		};
	});

	let switchElement = $state<HTMLButtonElement | null>(null);
	let thumbElement = $state<HTMLElement | null>(null);
	let thumbTransform = $state<GlassTransform | null>(null);
	let dragging = $state(false);

	/** Set when a gesture moved far enough to be a drag, so the click is swallowed. */
	let suppressClick = false;

	const droplet = new DropletMorph();
	$effect(() => droplet.setReduced(reducedMotion.current));
	$effect(() => () => {
		droplet.destroy();
		if (meltTimer !== null) clearTimeout(meltTimer);
	});

	/** Whether the knob is currently melted, so repeat engagements are no-ops. */
	let melted = false;
	let meltedAt = 0;
	/** Set while a release is waiting out {@link SWITCH_THUMB.meltFloorMs}. */
	let meltTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Melting the knob into a droplet, and swelling it from its idle scale up to its
	 * full laid-out size.
	 *
	 * The swell goes through the transform's `pressScale` channel rather than a CSS
	 * variable on the `style` attribute: Svelte rewrites that attribute wholesale
	 * when it changes, which would wipe Motion's `transform` and the pointer
	 * properties once per frame.
	 *
	 * Idempotent in both directions, because the same gesture reaches this from more
	 * than one place — a press on the knob melts it from the drag's `onStart` *and*
	 * from the button's own pointer handler, and a held key repeats `keydown`. Left
	 * unguarded each of those restarts the spring from wherever it had got to, which
	 * re-seeds it with the velocity it had at that instant and stretches the rise out
	 * over as many restarts as arrive.
	 *
	 * The release is floored at {@link SWITCH_THUMB.meltFloorMs} — see there for why
	 * a click otherwise only ever showed part of the swell. Not floored under reduced
	 * motion: the springs are instant there, so the delay would be the only thing
	 * left of the animation.
	 */
	function melt(active: boolean) {
		if (active) {
			if (meltTimer !== null) {
				clearTimeout(meltTimer);
				meltTimer = null;
			}
			if (melted) return;
			melted = true;
			meltedAt = performance.now();
			droplet.engage();
			swell(SWITCH_THUMB.activeScale, 'droplet');
			return;
		}

		// A release already waiting out the floor stays queued; re-arming it here
		// would push the knob's return back by a fresh floor on every stray pointerup.
		if (!melted || meltTimer !== null) return;

		const remaining = SWITCH_THUMB.meltFloorMs - (performance.now() - meltedAt);
		if (remaining > 0 && !reducedMotion.current) {
			meltTimer = setTimeout(() => {
				meltTimer = null;
				melt(false);
			}, remaining);
			return;
		}

		melted = false;
		droplet.release();
		swell(SWITCH_THUMB.restScale, 'settle');
	}

	function swell(scale: number, spring: 'droplet' | 'settle') {
		const transform = thumbTransform;
		if (!transform) return;
		animate(transform.pressScale, scale, springFor(spring, reducedMotion.current));
	}

	/*
	 * Acquisition is kept in its own effect, separate from the travel animation.
	 * Releasing and re-acquiring on every toggle would tear down the shared
	 * transform and snap the thumb back to zero mid-flight.
	 *
	 * `pressScale` carries the whole idle ↔ droplet swell, so it starts at the idle
	 * scale rather than at 1. Set imperatively, not animated: this is a static state,
	 * and animating it here would make the knob shrink into place on mount.
	 */
	$effect(() => {
		if (!thumbElement) return;
		const transform = acquireGlassTransform(thumbElement);
		transform.pressScale.set(SWITCH_THUMB.restScale);
		thumbTransform = transform;
		return () => {
			thumbTransform = null;
			transform.pressScale.set(1);
			transform.release();
		};
	});

	/**
	 * The track's tint follows the knob's actual position rather than the `checked`
	 * flag, which is what the reference does and what makes a drag legible: the track
	 * flips under your finger as the knob crosses the midpoint, and lets go with it if
	 * you drag back. A tap crossfades over exactly the travel spring too, so there is
	 * no second duration to keep in sync — and under reduced motion, where that spring
	 * is instant, the colour is instant with it.
	 *
	 * `setProperty` rather than a `style:` directive: the directive would only write
	 * when `checked` changed and would then fight the per-frame value written here.
	 */
	$effect(() => {
		const transform = thumbTransform;
		const element = switchElement;
		if (!transform || !element) return;

		const limit = geometry.travel;
		const write = (x: number) => {
			const progress = limit > 0 ? Math.min(1, Math.max(0, x / limit)) : 0;
			setGlassProperties(element, { '--lg-switch-progress': String(progress) });
		};

		write(transform.x.get());
		return transform.x.on('change', write);
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
			checked ? geometry.travel : 0,
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
	 *
	 * `overshoot` gives the two ends a little give. Pushed hard against either stop
	 * the knob keeps following the finger for a few pixels and then refuses, which
	 * reads as an end of travel; clamped dead it reads as a dropped gesture.
	 */
	$effect(() => {
		const element = thumbElement;
		if (!element || disabled) return;

		const limit = geometry.travel;

		return applyDrag(element, {
			axis: 'x',
			reduced: reducedMotion.current,
			restScale: 1,
			keyboard: false,
			bounds: () => ({ minX: 0, maxX: limit, minY: 0, maxY: 0 }),
			overshoot: reducedMotion.current ? 0 : limit * SWITCH_THUMB.overshootRatio,

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

	/**
	 * Hover goes on the **knob**, not on the button around it.
	 *
	 * This is the one place inside the library where the transformed-ancestor trap
	 * bites: `applyHover` puts a live `transform` on whatever it is given, and in
	 * Chromium a transformed *ancestor* drops a descendant's `backdrop-filter`
	 * entirely (crbug 1194050). Attached to the button, the hover lift would therefore
	 * switch the droplet's refraction off for as long as the pointer was over the
	 * control — which is exactly when it is supposed to be at its strongest. On the
	 * knob itself the transform and the filter share one element, which is fine.
	 *
	 * Hovering the bare track gets a plain colour cue from CSS instead.
	 *
	 * `lift: 0` because the knob is constrained to its groove: it travels on X and
	 * nowhere else, and floating it up on hover reads as the knob coming loose. The
	 * swell and the specular boost carry the hover on their own, which is also what
	 * the reference does — the knob grows under the pointer, it does not rise.
	 */
	$effect(() => {
		if (!thumbElement) return;
		return applyHover(thumbElement, { reduced: reducedMotion.current, disabled, lift: 0 });
	});

	/**
	 * A press anywhere on the control melts the knob, not just a press on the knob
	 * itself.
	 *
	 * `applyDrag` is attached to the knob and only knows about gestures that start on
	 * it, but the track is the larger target and most clicks land there — and those
	 * used to slide the knob across without it ever melting, which is the one moment
	 * the droplet is supposed to be visible. This runs alongside the drag rather than
	 * instead of it: a press on the knob reaches both, and `melt` is idempotent.
	 *
	 * The release listener goes on the window because the gesture does not have to end
	 * on the button — a press that slides off, or a drag whose pointer capture ends
	 * elsewhere, still has to let the droplet go.
	 */
	function onPointerDown(event: PointerEvent) {
		if (disabled || event.button !== 0) return;
		melt(true);

		const release = () => {
			melt(false);
			window.removeEventListener('pointerup', release);
			window.removeEventListener('pointercancel', release);
		};
		window.addEventListener('pointerup', release);
		window.addEventListener('pointercancel', release);
	}

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
		style:width={`${geometry.width}px`}
		style:height={`${geometry.height}px`}
		style:border-radius={`${geometry.height / 2}px`}
		style:--lg-switch-inset={`${geometry.inset}px`}
		style:--lg-switch-rise={`${-geometry.thumbHeight / 2}px`}
		onpointerdown={onPointerDown}
		onclick={onClick}
		onkeydown={onKeyDown}
		onkeyup={() => melt(false)}
		onblur={() => melt(false)}
	>
		<span class="lg-switch-track"></span>

		<!--
			A capsule, not a circle, and laid out taller than the track it rides — see
			SWITCH_THUMB. The bezel is a fifth of its height rather than half, so a flat
			clear centre is ringed by a thin band of strong refraction; a fully bezelled
			knob refracts everywhere and reads as a smudge.
		-->
		<LiquidGlass
			bind:element={thumbElement}
			width={geometry.thumbWidth}
			height={geometry.thumbHeight}
			borderRadius={geometry.thumbHeight / 2}
			bezel={geometry.bezel}
			displacement={geometry.bezel * droplet.visual.displacementRatio}
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
		display: inline-block;
		box-sizing: border-box;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
		/* No `overflow` and no clipping anywhere on this element: the swollen droplet
		   deliberately bulges past all four rims. */
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
		transition: background-color 200ms ease;
	}

	/*
	 * The hover cue for the track is a colour change and nothing else. It cannot be a
	 * lift or a scale, because those would have to sit on the button — an ancestor of
	 * the knob — and a transformed ancestor drops the knob's refraction in Chromium.
	 * The knob has its own hover, on itself, where a transform is safe.
	 */
	.lg-switch:not(:disabled):hover .lg-switch-track {
		background: rgb(255 255 255 / 0.16);
	}

	/*
	 * The "on" tint is a second layer faded in over the first rather than a
	 * background-colour transition, because its opacity is driven per frame by the
	 * knob's position (`--lg-switch-progress`) and a transition would fight that.
	 *
	 * Safe despite the CLAUDE.md rule on `opacity`: a backdrop root has to be an
	 * *ancestor* of the refracting element, and this is the knob's sibling — painted
	 * below it, which is exactly what makes the track show up refracted through it.
	 *
	 * The fallback in each `var()` is what the server renders and what a no-JS client
	 * keeps: correct for both states before the property exists, overridden by the
	 * property in both directions once it does.
	 */
	.lg-switch-track::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: rgb(64 220 150 / 0.55);
		box-shadow:
			inset 0 1px 2px rgb(0 0 0 / 0.18),
			inset 0 0 0 1px rgb(255 255 255 / 0.28),
			0 0 14px rgb(64 220 150 / 0.35);
		opacity: var(--lg-switch-progress, 0);
	}

	.lg-switch-on .lg-switch-track::after {
		opacity: var(--lg-switch-progress, 1);
	}

	.lg-switch:focus-visible {
		outline: 2px solid rgb(255 255 255 / 0.85);
		outline-offset: 3px;
	}

	/*
	 * Parked at the left end of the travel and moved entirely by Motion's transform
	 * channel, so nothing here competes with the animation. `margin-top` rather than a
	 * `translateY(-50%)` for the vertical centring, for the same reason: the transform
	 * belongs to `glassTransform.ts`.
	 */
	.lg-switch :global(.lg-switch-thumb) {
		position: absolute;
		top: 50%;
		left: var(--lg-switch-inset);
		margin-top: var(--lg-switch-rise);
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
