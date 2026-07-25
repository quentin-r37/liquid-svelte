<script lang="ts">
	import type { Snippet } from 'svelte';
	import LiquidScrollEdge from './LiquidScrollEdge.svelte';
	import type { GlassMode } from './liquidGlass.types.js';
	import { NAVBAR_GEOMETRY } from './runtime/glassTokens.js';
	import { observeScroll } from './runtime/sharedScrollListener.js';
	import { observeSize } from './runtime/sharedResizeObserver.js';

	/** Where the bar sits. `static` hands positioning back to the consumer. */
	export type NavBarPosition = 'sticky' | 'fixed' | 'static';

	interface Props {
		/** Inline title, shown in the centre region. */
		title?: string;
		/**
		 * Leading region — a back button, a logo.
		 *
		 * Put `LiquidButton`s in here. The bar itself is not a glass surface — it is a
		 * layout box over a blur band — so a glass control in it is a discrete object
		 * on blurred content rather than a backdrop filter nested inside another one.
		 * That is the arrangement the effect is built around, and the reason the
		 * regions sit *beside* the band in the markup rather than inside it.
		 */
		leading?: Snippet;
		/** Trailing region — actions. Same as {@link Props.leading}. */
		trailing?: Snippet;
		/** Replaces the centre region entirely, ignoring `title`. */
		children?: Snippet;
		/**
		 * The large title living in the scrolled content.
		 *
		 * Bind your own heading to it (`<h1 bind:this={…}>`) and the bar takes its
		 * cue from that element's bottom edge closing on the bar's, rather than from
		 * an absolute scroll offset — which is what makes the inline title arrive
		 * exactly as the large one disappears underneath, at any content length and
		 * any font size. Leave it unset and the edge materialises over
		 * {@link NAVBAR_GEOMETRY.fade} pixels of scroll instead, with the inline title
		 * always visible.
		 *
		 * *Passing* the prop is what declares the intent, not the value in it. A
		 * `bind:this` is still `null` when the server renders and for the first tick
		 * after hydration, so a component that decided on the value would render its
		 * inline title, then blink it away the moment the binding landed. Read as
		 * "was this prop supplied at all", the answer is the same on both sides.
		 */
		titleTarget?: HTMLElement | null;
		/** Scroll container. Omit for the document scroller. */
		scroller?: HTMLElement | null;
		/** Materialise on scroll. `false` leaves the edge permanently blurred. */
		scrollEdge?: boolean;
		/** Scroll distance, in px, over which the edge materialises. */
		fade?: number;
		position?: NavBarPosition;
		/** Minimum height of the title row, excluding any safe-area inset. */
		height?: number;
		/** Peak blur at the edge, in px. */
		blur?: number;
		/** Forwarded to the band's scrim. See `LiquidScrollEdge`. */
		scheme?: 'light' | 'dark';
		/**
		 * Materialisation, `0`–`1`. Bindable, but as a *readout*: the component owns
		 * it whenever `scrollEdge` is on.
		 */
		progress?: number;
		mode?: GlassMode;
		/** Bindable reference to the host element. */
		element?: HTMLElement | null;
		class?: string;
		style?: string;
	}

	let {
		title,
		leading,
		trailing,
		children,
		// Deliberately left `undefined` rather than defaulted to `null` — see the prop's
		// documentation. `tracksTitle` below depends on being able to tell them apart.
		titleTarget,
		scroller = null,
		scrollEdge = true,
		fade = NAVBAR_GEOMETRY.fade,
		position = 'sticky',
		height = NAVBAR_GEOMETRY.height,
		blur,
		scheme,
		progress = $bindable(0),
		mode = 'auto',
		element = $bindable(null),
		class: className = '',
		style = ''
	}: Props = $props();

	const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

	/**
	 * Quantisation of `progress`, in steps over its full range.
	 *
	 * Every write here lands on a handful of CSS custom properties, so a scroll that
	 * reports sub-pixel deltas should not be able to queue an update per event. 256
	 * steps across a fade of a few dozen pixels is still finer than the pixels
	 * available to travel through it, and both endpoints are exactly representable —
	 * which matters, because "fully clear" has to be reachable exactly or the band
	 * never quite switches off.
	 */
	const PROGRESS_STEPS = 256;

	/**
	 * Scroll → materialisation.
	 *
	 * Deliberately *not* sprung. Every other animation in this library is driven by
	 * a gesture that ends, so a spring gives it somewhere to settle; this one is
	 * driven by a position the user is holding, and a spring on a scrubbed value only
	 * ever reads as lag.
	 *
	 * Everything the listener needs is captured here rather than read inside it: the
	 * callback runs from an event, outside any reactive scope, so a read in there
	 * would be untracked and the effect would keep a stale `titleTarget` alive.
	 */
	$effect(() => {
		if (!scrollEdge) {
			progress = 1;
			return;
		}

		const bar = element;
		if (!bar) return;

		const target = titleTarget ?? null;
		const span = Math.max(1, fade);
		let last = -1;
		let lastTop = 0;

		const update = (top: number = lastTop) => {
			lastTop = top;

			// Both rects are viewport-relative, so their *difference* is independent of
			// where the page happens to be scrolled — no offset chain to walk, and
			// nothing to re-measure when the layout above the title changes. The cost is
			// two layout reads per frame of scrolling, which is the same two the
			// alternative spends measuring the target once and then again on every
			// resize, container query and font swap that could have moved it.
			const raw = target
				? 1 - (target.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom) / span
				: top / span;

			const next = Math.round(clamp01(raw) * PROGRESS_STEPS) / PROGRESS_STEPS;
			// Compared against a local mirror, not against `progress` itself: reading the
			// state this effect writes would make it its own dependency, and the priming
			// call below happens while the effect is still tracking.
			if (next === last) return;
			last = next;
			progress = next;
		};

		const stopScroll = observeScroll(scroller, update);

		// The target's own size can move the crossover without any scrolling — a font
		// swap, a wrapping title. Only the target is observed, never the bar: the
		// shared observer holds one callback per element, so observing an element the
		// library already measures elsewhere would silently displace that measurement.
		const stopSize = target ? observeSize(target, () => update()) : null;

		return () => {
			stopScroll();
			stopSize?.();
		};
	});

	/** Whether a large title in the content is handing over to this one. */
	const tracksTitle = $derived(titleTarget !== undefined);

	/**
	 * A bar with no large title to hand over from shows its title unconditionally —
	 * there is nothing else on the page carrying it.
	 */
	const titleReveal = $derived(
		tracksTitle
			? clamp01((progress - NAVBAR_GEOMETRY.titleDelay) / (1 - NAVBAR_GEOMETRY.titleDelay))
			: 1
	);
</script>

<!--
	A plain box. No tint, no rim, no shadow, no surface of its own — the bar is a
	place to put controls, and everything visible about it is the blur band behind
	them plus whatever glass the controls bring themselves.

	The band is a *sibling* of the row, never its ancestor: it carries masks, which
	would make it a backdrop root and flatten any glass nested inside it.
-->
<header
	bind:this={element}
	class={`lg-navbar ${className}`}
	style={style || undefined}
	style:--lg-navbar-height={`${height}px`}
	style:--lg-navbar-inset={`${NAVBAR_GEOMETRY.inset}px`}
	style:--lg-navbar-bleed={`${height * NAVBAR_GEOMETRY.bleedRatio}px`}
	data-position={position}
>
	<LiquidScrollEdge {progress} {blur} {scheme} {mode} side="top" class="lg-navbar-band" />

	<div class="lg-navbar-row">
		<div class="lg-navbar-side">{@render leading?.()}</div>

		<!--
			`aria-hidden` only while a large title is being tracked: in that arrangement
			this is a second rendering of a heading that is already in the document, and
			announcing both is worse than announcing neither. With no target it is the
			only title there is, so it stays in the tree.
		-->
		<div
			class="lg-navbar-title"
			style:--lg-navbar-reveal={titleReveal}
			style:--lg-navbar-rise={`${NAVBAR_GEOMETRY.titleRise}px`}
			aria-hidden={tracksTitle ? 'true' : undefined}
		>
			{#if children}
				{@render children()}
			{:else if title}
				<span class="lg-navbar-heading">{title}</span>
			{/if}
		</div>

		<div class="lg-navbar-side lg-navbar-end">{@render trailing?.()}</div>
	</div>
</header>

<style>
	/*
	 * Carries none of `filter`, `opacity`, `mask`, `clip-path`, `mix-blend-mode` or
	 * `isolation`, because the glass controls inside it are descendants and any one
	 * of those would cut them off from the page's backdrop.
	 *
	 * `position: sticky` is the one thing here that is not provably safe: Chromium
	 * implements it as a compositor translation, and a *transformed* ancestor is
	 * known to break a descendant's `backdrop-filter` (crbug 1194050). Every pinned
	 * bar with glass controls in it has this shape — Apple's included — so if it
	 * turns out to bite, the fix is `position="fixed"` or `"static"` rather than a
	 * different structure. Worth checking in the harness before relying on it.
	 */
	.lg-navbar {
		position: relative;
		display: block;
		width: 100%;
		box-sizing: border-box;
		/* The topmost chrome on a device with a notch owns the inset. */
		padding-top: env(safe-area-inset-top, 0px);
		z-index: var(--lg-navbar-z, 20);
	}

	.lg-navbar[data-position='sticky'] {
		position: sticky;
		top: 0;
	}

	.lg-navbar[data-position='fixed'] {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
	}

	/*
	 * The band runs past the bottom of the row rather than stopping at it — see
	 * `NAVBAR_GEOMETRY.bleedRatio`. It sits outside the bar's own box, which is
	 * exactly why the bar must not clip: an `overflow: hidden` here would cut the
	 * ramp off mid-gradient and put back the hard edge.
	 */
	.lg-navbar :global(.lg-navbar-band) {
		top: 0;
		left: 0;
		right: 0;
		bottom: calc(-1 * var(--lg-navbar-bleed));
	}

	/*
	 * `1fr auto 1fr` rather than flex: the title stays centred on the *bar* however
	 * lopsided the two side regions are, which is what a nav bar is expected to do and
	 * what a row of flex children cannot express. The side tracks are allowed to
	 * collapse so a long title truncates instead of pushing the actions off the edge.
	 */
	.lg-navbar-row {
		position: relative;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--lg-navbar-height);
		padding-inline: var(--lg-navbar-inset);
		box-sizing: border-box;
	}

	.lg-navbar-side {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.lg-navbar-end {
		justify-content: flex-end;
	}

	/*
	 * `opacity` and `transform` are fine here and nowhere near the band or the
	 * controls: this box has no glass in it, so making it a backdrop root costs
	 * nothing.
	 */
	.lg-navbar-title {
		min-width: 0;
		opacity: var(--lg-navbar-reveal, 1);
		transform: translateY(calc((1 - var(--lg-navbar-reveal, 1)) * var(--lg-navbar-rise, 0px)));
	}

	.lg-navbar-heading {
		display: block;
		overflow: hidden;
		font-size: 0.9375rem;
		font-weight: 600;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
</style>
