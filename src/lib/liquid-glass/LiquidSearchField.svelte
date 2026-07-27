<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality, GlassVariant } from './liquidGlass.types.js';
	import {
		BUTTON_CIRCLE_SIZES,
		GLASS_DEFAULTS,
		SEARCH_BEZEL_RATIO
	} from './runtime/glassTokens.js';
	import { HOVER_SPECULAR_BOOST } from './runtime/motionTokens.js';

	/**
	 * Deliberately the button's own size scale: the field is laid out at
	 * {@link BUTTON_CIRCLE_SIZES}' heights so it rows up with the circular buttons
	 * it shares a bar with. See {@link SEARCH_BEZEL_RATIO} for why that identity
	 * is a decision rather than a reuse of convenience.
	 */
	export type SearchFieldSize = keyof typeof BUTTON_CIRCLE_SIZES;

	interface Props extends Omit<
		HTMLInputAttributes,
		'class' | 'style' | 'size' | 'type' | 'value' | 'onsubmit'
	> {
		/** Current text. Bindable. */
		value?: string;
		size?: SearchFieldSize;
		/**
		 * Material variant — `regular` (default) is the frosted material; `clear` for
		 * a field floating over media. See {@link GlassVariant}.
		 */
		variant?: GlassVariant;
		quality?: GlassQuality;
		mode?: GlassMode;
		disabled?: boolean;
		/** Show the clear affordance while the field holds text. */
		clearable?: boolean;
		/**
		 * Accessible name of the input. Falls back to `placeholder`, which is the
		 * common case for a search field — pass this when the placeholder is absent
		 * or too cute to announce.
		 */
		label?: string;
		/** Called with the current text when Enter is pressed. */
		onsubmit?: (value: string) => void;
		/** Called after the field is emptied via the clear button or Escape. */
		onclear?: () => void;
		/** Bindable reference to the host element. */
		element?: HTMLElement | null;
		/** Bindable reference to the native input, for imperative focus. */
		input?: HTMLInputElement | null;
		class?: string;
		style?: string;
		/** Replaces the default magnifier. Sized by `--lg-icon-size` like every glyph. */
		icon?: Snippet;
	}

	let {
		value = $bindable(''),
		size = 'md',
		variant = GLASS_DEFAULTS.variant,
		quality = GLASS_DEFAULTS.quality,
		mode = 'auto',
		disabled = false,
		clearable = true,
		label,
		placeholder,
		onsubmit,
		onclear,
		element = $bindable(null),
		input = $bindable(null),
		class: className = '',
		style = '',
		icon,
		// Pulled out so the component's own handler composes with the consumer's
		// instead of one silently replacing the other.
		onkeydown,
		...rest
	}: Props = $props();

	/**
	 * `height × 0.26`, the flat-centre law. The height itself is not passed to the
	 * primitive — it lives in the per-size CSS below, so the box is right in the
	 * server render — but the bezel has to be derived from the same figure or the
	 * rim and the layout disagree about where the flat centre is.
	 */
	const bezel = $derived(BUTTON_CIRCLE_SIZES[size] * SEARCH_BEZEL_RATIO);

	let highlighted = $state(false);

	/**
	 * The same affordance as `LiquidButton`'s: hover or focus brightens the SVG rim.
	 * A text field gets no press or hover *transform* — it is a place, not a control
	 * that reacts by moving — so the rim light and the pointer glow are the whole of
	 * its liveliness, which is also how the platform treats its fields.
	 */
	const specularIntensity = $derived(
		GLASS_DEFAULTS.specularIntensity + (highlighted && !disabled ? HOVER_SPECULAR_BOOST : 0)
	);

	/**
	 * The whole pill is the target, exactly like the native control — but the host
	 * is a `div`, not a `label`. A label would do this for free and would also be
	 * invalid: the clear affordance is a real `<button>`, and HTML forbids
	 * interactive content inside a label. `preventDefault` keeps the press from
	 * moving focus (or starting a selection on the icon) before the input takes it.
	 */
	function focusFromHost(event: PointerEvent): void {
		if (disabled) return;
		const target = event.target as HTMLElement;
		if (target === input || target.closest('.lg-search-clear')) return;
		event.preventDefault();
		input?.focus();
	}

	/**
	 * Clearing keeps focus in the field, as the platform does — a cleared search is
	 * the start of the next one, not the end of this one. The clear button's own
	 * `pointerdown` is prevented below so focus never visibly leaves on the way.
	 */
	function clear(): void {
		value = '';
		onclear?.();
		input?.focus();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			onsubmit?.(value);
		} else if (event.key === 'Escape' && value !== '') {
			// Consumed: Escape empties a non-empty field, and must not also dismiss
			// whatever surface the field is sitting in. An already-empty field lets
			// the key through, so the second press still closes the sheet.
			event.stopPropagation();
			clear();
		}
		onkeydown?.(event as never);
	}
</script>

<LiquidGlass
	bind:element
	borderRadius={999}
	{bezel}
	{variant}
	{specularIntensity}
	{quality}
	{mode}
	{disabled}
	interactive
	class={`lg-search lg-search-${size} ${className}`}
	{style}
	onpointerdown={focusFromHost}
	onpointerenter={() => (highlighted = true)}
	onpointerleave={() => (highlighted = false)}
	onfocusin={() => (highlighted = true)}
	onfocusout={() => (highlighted = false)}
>
	<span class="lg-search-icon" aria-hidden="true">
		{#if icon}
			{@render icon()}
		{:else}
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.35-4.35" />
			</svg>
		{/if}
	</span>
	<input
		bind:this={input}
		bind:value
		type="search"
		aria-label={label ?? placeholder}
		{placeholder}
		{disabled}
		onkeydown={handleKeydown}
		{...rest}
	/>
	{#if clearable && value !== '' && !disabled}
		<button
			type="button"
			class="lg-search-clear"
			aria-label="Clear search"
			onpointerdown={(event) => event.preventDefault()}
			onclick={clear}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
			>
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>
	{/if}
</LiquidGlass>

<style>
	/*
	 * Sizing and typography only — every glass surface style lives in
	 * liquidGlass.css. Global because the classes land on a child component's
	 * element.
	 */
	:global(.lg-search) {
		display: flex;
		width: 100%;
		cursor: text;
	}

	/*
	 * Heights mirror BUTTON_CIRCLE_SIZES for the same SSR reason the circles state
	 * theirs in CSS: the primitive's width/height props are written by an effect and
	 * absent from the server render, and a field with no laid-out height would render
	 * as a text line and jump on hydration. These must stay in step with the token,
	 * which is what the bezel is derived from. Font sizes are the pill buttons', so a
	 * field and the button beside it type at the same scale.
	 */
	:global(.lg-search-sm) {
		--lg-search-icon: 13px;
		height: 30px;
		font-size: 0.8125rem;
	}

	:global(.lg-search-md) {
		--lg-search-icon: 16px;
		height: 38px;
		font-size: 0.9375rem;
	}

	:global(.lg-search-lg) {
		--lg-search-icon: 18px;
		height: 46px;
		font-size: 1.0625rem;
	}

	:global(.lg-search > .lg-content) {
		flex: 1 1 auto;
		justify-content: flex-start;
		gap: 0.4em;
		height: 100%;
		min-width: 0;
		padding: 0 0.9em;
	}

	:global(.lg-search-icon) {
		display: flex;
		flex: 0 0 auto;
		/* Secondary, like the placeholder it introduces — the field's content is the
		   text, and a full-strength glyph competes with it. */
		opacity: 0.55;
	}

	:global(.lg-search-icon svg) {
		display: block;
		width: var(--lg-icon-size, var(--lg-search-icon));
		height: var(--lg-icon-size, var(--lg-search-icon));
	}

	:global(.lg-search input) {
		flex: 1 1 auto;
		min-width: 0;
		height: 100%;
		appearance: none;
		background: transparent;
		border: 0;
		margin: 0;
		padding: 0;
		font: inherit;
		color: inherit;
		/* The ring is drawn on the pill (see :has below); a second one inside it
		   would outline the text area against the glass it is supposed to be part of. */
		outline: none;
	}

	/* Scheme-agnostic: whatever colour the text inherits, the placeholder is a
	   fainter run of the same ink. */
	:global(.lg-search input::placeholder) {
		color: inherit;
		opacity: 0.55;
	}

	/* The native × — this component draws its own, so it can keep focus in the
	   field and carry an accessible name. */
	:global(.lg-search input::-webkit-search-cancel-button),
	:global(.lg-search input::-webkit-search-decoration) {
		-webkit-appearance: none;
		appearance: none;
	}

	/* The focus ring belongs to the pill, not the input: the pill is the control
	   the user sees, and it is what a keyboard user needs outlined. */
	:global(.lg-search:has(input:focus-visible)) {
		outline: 2px solid rgb(255 255 255 / 0.85);
		outline-offset: 3px;
	}

	:global(.lg-search-clear) {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		width: 1.3em;
		height: 1.3em;
		border: 0;
		margin: 0;
		padding: 0;
		border-radius: 999px;
		/*
		 * iOS's systemGray fill, scheme-constant on purpose: on glass the backdrop
		 * behind the button is unknowable, and a mid-grey at moderate alpha is the one
		 * fill that reads as a chip on both a white veil and a smoked one. Deriving it
		 * from --lg-shade would vanish it against dark glass.
		 */
		background: rgb(120 120 128 / 0.4);
		color: #fff;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	:global(.lg-search-clear svg) {
		display: block;
		width: 0.62em;
		height: 0.62em;
	}

	:global(.lg-search-clear:focus-visible) {
		outline: 2px solid rgb(255 255 255 / 0.85);
		outline-offset: 2px;
	}

	/*
	 * Dimming the *content*, never the host. `opacity < 1` on the glass root would
	 * create a backdrop root and silently kill the refraction underneath.
	 */
	:global(.lg-search[data-disabled='true'] .lg-content) {
		opacity: 0.5;
	}
</style>
