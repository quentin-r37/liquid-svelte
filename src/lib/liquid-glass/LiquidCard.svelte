<script lang="ts">
	import type { Snippet } from 'svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { CornerShape, GlassMode, GlassQuality, GlassVariant } from './liquidGlass.types.js';
	import { CARD_GEOMETRY, GLASS_DEFAULTS } from './runtime/glassTokens.js';

	/**
	 * A resting glass container: the primitive with a card's layout instead of a
	 * control's.
	 *
	 * Deliberately thin. `LiquidGlass` already *is* a card optically — this
	 * component exists because the primitive lays out as a centring inline-flex
	 * (right for every control in the library, wrong for prose), carries no
	 * padding, and leaves the header/body/footer arrangement to be reinvented by
	 * every consumer. What a card adds is layout and nothing else, so anything
	 * optical here is a default the props can override, never a behaviour.
	 *
	 * The one liberty taken is the bezel (see {@link CARD_GEOMETRY}): a container
	 * wants its refraction in a rim around a flat centre the content sits on,
	 * which is the menu panel's argument at card scale.
	 */
	interface Props {
		/** Fixed width in CSS pixels. Omit to size from content / CSS. */
		width?: number;
		/** Fixed height in CSS pixels. Omit to size from content / CSS. */
		height?: number;
		borderRadius?: number;
		cornerShape?: CornerShape;
		bezel?: number;
		variant?: GlassVariant;
		/** Track the pointer for the rim glow. Off by default: a card is not a control. */
		interactive?: boolean;
		quality?: GlassQuality;
		mode?: GlassMode;
		/** Host element tag — `article`, `section`, … Defaults to `div`. */
		tag?: keyof HTMLElementTagNameMap;
		/** Bindable reference to the host element. */
		element?: HTMLElement | null;
		class?: string;
		style?: string;
		/** Above the body, styled as a title row. */
		header?: Snippet;
		children?: Snippet;
		/** Below the body, dimmer — actions and fine print live here. */
		footer?: Snippet;
	}

	let {
		width,
		height,
		borderRadius = CARD_GEOMETRY.radius,
		cornerShape = GLASS_DEFAULTS.cornerShape,
		bezel = CARD_GEOMETRY.bezel,
		variant = GLASS_DEFAULTS.variant,
		interactive = false,
		quality = GLASS_DEFAULTS.quality,
		mode = 'auto',
		tag = 'div',
		element = $bindable(null),
		class: className = '',
		style = '',
		header,
		children,
		footer
	}: Props = $props();
</script>

<LiquidGlass
	bind:element
	{width}
	{height}
	{borderRadius}
	{cornerShape}
	{bezel}
	{variant}
	{interactive}
	{quality}
	{mode}
	{tag}
	class={`lg-card ${className}`}
	{style}
>
	<div class="lg-card-inner">
		{#if header}
			<header class="lg-card-header">{@render header()}</header>
		{/if}
		{#if children}
			<div class="lg-card-body">{@render children()}</div>
		{/if}
		{#if footer}
			<footer class="lg-card-footer">{@render footer()}</footer>
		{/if}
	</div>
</LiquidGlass>

<style>
	/*
	 * A block, overriding the primitive's centring inline-flex — the same override
	 * the menu panel makes, for the same reason: a card is content filling its
	 * box, not a label centred in a pill.
	 */
	:global(.lg-card) {
		display: block;
	}

	:global(.lg-card > .lg-content) {
		display: block;
	}

	.lg-card-inner {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		box-sizing: border-box;
		/* The fallback mirrors CARD_GEOMETRY.padding — duplicated the way
		   BUTTON_CIRCLE_SIZES is mirrored in CSS, so the padding exists in the
		   server render. The custom property is the consumer override. */
		padding: var(--lg-card-padding, 20px);
		text-align: left;
	}

	.lg-card-header {
		font-weight: 600;
		font-size: 1rem;
		line-height: 1.3;
	}

	.lg-card-body {
		min-width: 0;
	}

	.lg-card-footer {
		font-size: 0.85rem;
		opacity: 0.72;
	}
</style>
