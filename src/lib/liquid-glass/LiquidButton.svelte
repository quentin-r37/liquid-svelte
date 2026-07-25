<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality, LiquidGlassProps } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { applyHover, applyPress } from './runtime/glassMotion.js';
	import { GLASS_DEFAULTS } from './runtime/glassTokens.js';
	import { HOVER_SPECULAR_BOOST } from './runtime/motionTokens.js';

	interface Props extends Omit<HTMLButtonAttributes, 'class' | 'style'> {
		/** Visual weight. `prominent` reads as a primary action. */
		tone?: 'plain' | 'prominent';
		size?: 'sm' | 'md' | 'lg';
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

	/** Small buttons need a proportionally thinner bezel, or the refraction eats the label. */
	const resolvedBezel = $derived(bezel ?? { sm: 10, md: 14, lg: 20 }[size]);

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
	class={`lg-button lg-button-${size} lg-button-${tone} ${className}`}
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
