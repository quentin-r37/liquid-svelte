<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality, LiquidGlassProps } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { applyHover, applyPress } from './runtime/glassMotion.js';
	import {
		BUTTON_CIRCLE_BEZEL_RATIO,
		BUTTON_CIRCLE_SIZES,
		GLASS_DEFAULTS
	} from './runtime/glassTokens.js';
	import { HOVER_SPECULAR_BOOST } from './runtime/motionTokens.js';

	/** Layout of the host box. */
	export type ButtonShape = 'pill' | 'circle';

	interface Props extends Omit<HTMLButtonAttributes, 'class' | 'style'> {
		/** Visual weight. `prominent` reads as a primary action. */
		tone?: 'plain' | 'prominent';
		size?: 'sm' | 'md' | 'lg';
		/**
		 * `pill` hugs its label; `circle` is a fixed square box for a single glyph.
		 *
		 * A circle is not a pill with equal padding — it is laid out at an explicit
		 * diameter (see {@link BUTTON_CIRCLE_SIZES}) and given a proportional rim, both
		 * of which a text button derives from its content instead. Give one an
		 * `aria-label`: a glyph is not an accessible name.
		 */
		shape?: ButtonShape;
		borderRadius?: number;
		bezel?: number;
		quality?: GlassQuality;
		mode?: GlassMode;
		disabled?: boolean;
		/**
		 * Bindable reference to the host button. Forwarded from the primitive so a
		 * composing component can focus it or measure it — `LiquidMenu` needs it to
		 * return focus to its trigger on close.
		 */
		element?: HTMLElement | null;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let {
		tone = 'plain',
		size = 'md',
		shape = 'pill',
		borderRadius = 999,
		bezel,
		quality = GLASS_DEFAULTS.quality,
		mode = 'auto',
		disabled = false,
		element = $bindable(null),
		type = 'button',
		class: className = '',
		style = '',
		children,
		// Pulled out so the component's own handlers compose with the consumer's
		// instead of one silently replacing the other.
		onpointerenter,
		onpointerleave,
		onfocusin,
		onfocusout,
		...rest
	}: Props = $props();

	/**
	 * The residual button attributes are forwarded verbatim to the host element.
	 *
	 * Both casts here bridge the same gap: `LiquidGlass` types its host as a generic
	 * `HTMLElement`, while this component's public API — quite correctly — promises
	 * `HTMLButtonElement`. They are sound because `tag="button"` below guarantees the
	 * host really is a button. The alternative, making the primitive generic over its
	 * tag, is a large amount of machinery for this one bridge, and asking TypeScript
	 * to reconcile the two ~450-member attribute types directly overflows its union
	 * complexity limit.
	 */
	const forwarded = $derived(rest as unknown as LiquidGlassProps);

	function forward<E>(handler: ((event: E) => void) | null | undefined, event: unknown): void {
		handler?.(event as E);
	}

	/**
	 * The circle's diameter, for the bezel below. Its *layout* comes from the
	 * stylesheet rather than from here — see {@link BUTTON_CIRCLE_SIZES}.
	 */
	const diameter = $derived(shape === 'circle' ? BUTTON_CIRCLE_SIZES[size] : undefined);

	/**
	 * Small buttons need a proportionally thinner bezel, or the refraction eats the
	 * label. A circle's is a fraction of its own diameter rather than a per-size
	 * constant, because its radius *is* half its size and a fixed figure turns the
	 * whole disc into rim.
	 */
	const resolvedBezel = $derived(
		bezel ??
			(diameter !== undefined
				? diameter * BUTTON_CIRCLE_BEZEL_RATIO
				: { sm: 10, md: 14, lg: 20 }[size])
	);

	let highlighted = $state(false);

	/**
	 * Wired imperatively against the host element rather than through attachments,
	 * because the element belongs to `LiquidGlass`. `applyHover` and `applyPress`
	 * animate separate channels of a shared transform, so they compose cleanly.
	 */
	$effect(() => {
		if (!element) return;
		const reduced = reducedMotion.current;
		const stopHover = applyHover(element, { reduced, disabled });
		const stopPress = applyPress(element, { reduced, disabled });
		return () => {
			stopHover();
			stopPress();
		};
	});

	/**
	 * Brightening the *SVG* rim needs a real prop change, since its intensity is a
	 * filter attribute rather than a CSS variable. Only the `feFuncA` slope is
	 * rewritten — no map is regenerated. Focus counts as well, so keyboard users get
	 * the same affordance.
	 */
	const specularIntensity = $derived(
		(tone === 'prominent' ? 0.95 : 0.8) + (highlighted && !disabled ? HOVER_SPECULAR_BOOST : 0)
	);
</script>

<LiquidGlass
	tag="button"
	bind:element
	{borderRadius}
	bezel={resolvedBezel}
	opacity={tone === 'prominent' ? 0.14 : GLASS_DEFAULTS.opacity}
	{specularIntensity}
	{quality}
	{mode}
	{disabled}
	interactive
	class={`lg-button lg-button-${size} lg-button-${tone} lg-button-${shape} ${className}`}
	{style}
	type={type ?? 'button'}
	{...forwarded}
	onpointerenter={(event) => {
		highlighted = true;
		forward(onpointerenter, event);
	}}
	onpointerleave={(event) => {
		highlighted = false;
		forward(onpointerleave, event);
	}}
	onfocusin={(event) => {
		highlighted = true;
		forward(onfocusin, event);
	}}
	onfocusout={(event) => {
		highlighted = false;
		forward(onfocusout, event);
	}}
>
	{@render children?.()}
</LiquidGlass>

<style>
	/*
	 * Sizing and typography only — every glass surface style lives in
	 * liquidGlass.css. Global because the classes land on a child component's
	 * element.
	 */
	:global(.lg-button) {
		font-weight: 600;
		letter-spacing: 0.01em;
		white-space: nowrap;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.28);
	}

	:global(.lg-button-sm) {
		padding: 0.4rem 0.9rem;
		font-size: 0.8125rem;
	}

	:global(.lg-button-md) {
		padding: 0.6rem 1.35rem;
		font-size: 0.9375rem;
	}

	:global(.lg-button-lg) {
		padding: 0.85rem 1.9rem;
		font-size: 1.0625rem;
	}

	/*
	 * A circle is sized here rather than through the primitive's `width`/`height`
	 * props, which are written by an effect and so are absent from the server render.
	 * A pill survives that — its size comes from padding, which is in the stylesheet —
	 * but a circle has no padding, so it would render at the width of its glyph and
	 * jump to its real diameter on hydration. These must stay in step with
	 * `BUTTON_CIRCLE_SIZES`, which is what the bezel is derived from.
	 *
	 * Compound selectors so they beat the per-size padding on specificity rather than
	 * on source order.
	 */
	:global(.lg-button-circle.lg-button-sm) {
		--lg-button-icon: 14px;
		width: 30px;
		height: 30px;
		padding: 0;
		line-height: 1;
		font-size: 0.875rem;
	}

	:global(.lg-button-circle.lg-button-md) {
		--lg-button-icon: 18px;
		width: 38px;
		height: 38px;
		padding: 0;
		line-height: 1;
		font-size: 1.0625rem;
	}

	:global(.lg-button-circle.lg-button-lg) {
		--lg-button-icon: 22px;
		width: 46px;
		height: 46px;
		padding: 0;
		line-height: 1;
		font-size: 1.25rem;
	}

	/*
	 * Inline SVG content — a Lucide icon, or anything shaped like one.
	 *
	 * A pill gets `1em`: it has no fixed box, so the icon simply matches the cap
	 * height of the label beside it and there is nothing to align to.
	 *
	 * ## A circle gets a literal, and its parity is the whole point
	 *
	 * The icon is centred by flex in a box of a known diameter, so the offset it
	 * lands at is `(diameter − icon) / 2`. That has to come out whole. An odd
	 * difference puts the glyph on a half CSS pixel, and while a static half pixel is
	 * merely soft, an *animated* one is not: hover re-rasters the button at
	 * scale 1.025 and shifted 2px, the inner half-pixel rounds the other way, and the
	 * icon jumps a pixel against the button carrying it — the button rises and the
	 * glyph appears to sink. It is invisible above 100% zoom, where the same half
	 * pixel is a fifth of a device pixel rather than half of one, which is what makes
	 * it look like a compositing fault rather than arithmetic.
	 *
	 * So each figure below is the largest *even* integer under `d × 0.48` — the flat
	 * centre {@link BUTTON_CIRCLE_BEZEL_RATIO} leaves, beyond which the glyph would
	 * straddle the refracting rim. The two constraints happen to agree on all three
	 * sizes: 14, 18, 22.
	 *
	 * `--lg-icon-size` stays the consumer's override and is read *first*, so setting
	 * it anywhere up the tree still wins — these rules would otherwise beat Lucide's
	 * own `size` prop, which lands as a presentation attribute that any stylesheet
	 * outranks.
	 *
	 * `display: block` is not redundant with the flex centring: it stops the SVG's
	 * inline baseline from reserving descender space in any context where the content
	 * box is not a flex container.
	 *
	 * No `filter` here, either. The label gets a `text-shadow` for separation from a
	 * busy backdrop and the obvious way to give a stroked path the same is
	 * `drop-shadow()`, but a filter earns the element its own render surface inside
	 * one that Motion transforms on every hover and press, and there is no reason to
	 * hand the compositor a second surface to keep in step with the first. That is a
	 * precaution rather than a recorded bug — the misalignment this comment was first
	 * written for turned out to be the half pixel above, and survived the filter's
	 * removal. `text-shadow` raises no such question: it paints into its element's
	 * own layer.
	 */
	:global(.lg-button .lg-content svg) {
		display: block;
		flex: 0 0 auto;
		width: var(--lg-icon-size, var(--lg-button-icon, 1em));
		height: var(--lg-icon-size, var(--lg-button-icon, 1em));
	}

	/* Only ever visible when a label sits beside an icon. */
	:global(.lg-button > .lg-content) {
		gap: 0.45em;
	}

	:global(.lg-button:focus-visible) {
		outline: 2px solid rgb(255 255 255 / 0.85);
		outline-offset: 3px;
	}

	/*
	 * Dimming the *content*, never the host. `opacity < 1` on the glass root would
	 * create a backdrop root and silently kill the refraction underneath.
	 */
	:global(.lg-button[data-disabled='true'] .lg-content) {
		opacity: 0.5;
	}
</style>
