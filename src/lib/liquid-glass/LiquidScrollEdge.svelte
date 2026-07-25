<script lang="ts">
	import type { GlassMode } from './liquidGlass.types.js';
	import { resolveGlassSupport, resolveTier } from './runtime/capabilities.svelte.js';
	import { SCROLL_EDGE } from './runtime/glassTokens.js';

	/** Which side of the scroller the band is pinned to. */
	export type ScrollEdgeSide = 'top' | 'bottom';

	interface Props {
		side?: ScrollEdgeSide;
		/** Peak blur at the pinned edge, in CSS pixels. */
		blur?: number;
		/** Backdrop saturation under the band. */
		saturation?: number;
		/** Alpha of the legibility scrim at the pinned edge, `0`–`1`. */
		scrim?: number;
		/**
		 * Stacked backdrop layers. More is a smoother ramp and one more composited
		 * pass over the band each.
		 */
		layers?: number;
		/**
		 * Which way the scrim leans. Defaults to `prefers-color-scheme`.
		 *
		 * Worth an explicit prop, unlike anywhere else in the library: the scrim is
		 * the one quantity here that has to agree with the *content's* scheme rather
		 * than the system's, and an app that forces its own scheme is precisely the
		 * case the media query gets wrong — a light scrim over dark content does not
		 * fail subtly, it erases the text it was added to protect.
		 */
		scheme?: 'light' | 'dark';
		/** Intensity, `0`–`1`. Scrub it from a scroll position. */
		progress?: number;
		/** Force a rendering tier. Only `flat` changes anything here — see below. */
		mode?: GlassMode;
		class?: string;
		style?: string;
	}

	let {
		side = 'top',
		blur = SCROLL_EDGE.blur,
		saturation = SCROLL_EDGE.saturation,
		scrim = SCROLL_EDGE.scrim,
		layers = SCROLL_EDGE.layers,
		scheme,
		progress = 1,
		mode = 'auto',
		class: className = '',
		style = ''
	}: Props = $props();

	$effect(resolveGlassSupport);

	/**
	 * The tier check here is much weaker than the primitive's, and deliberately.
	 *
	 * What is Chromium-only is `url()` inside `backdrop-filter` — the SVG chain that
	 * carries the refraction. Plain `blur()` and `saturate()` are supported
	 * everywhere `backdrop-filter` is, so this effect renders identically on Firefox
	 * and WebKit, and only the `flat` tier — no backdrop filtering at all — has to
	 * fall back. There is nothing to degrade in between.
	 */
	const tier = $derived(resolveTier(mode));
	const filtered = $derived(tier !== 'flat');

	/**
	 * Stacked Gaussian blurs add in quadrature: n passes of radius r come out at
	 * r·√n. So the per-layer radius is the peak divided by √n, and the peak is what
	 * the caller actually asked for.
	 */
	const layerBlur = $derived((blur * progress) / Math.sqrt(Math.max(1, layers)));

	/**
	 * Layer k holds the mask fully opaque from the pinned edge down to `(k-1)/n` of
	 * the band, then fades out by `k/n`.
	 *
	 * Stacked, that means every layer covers the pinned edge and one fewer covers
	 * each successive step — a staircase of n, n−1, … 1 overlapping blurs, which is
	 * the blur *radius* ramp a single masked layer cannot produce. The widest layer
	 * carries the saturation, so that ramps with the rest instead of ending in a
	 * visible line where a full-coverage filter stops.
	 */
	const bands = $derived(
		Array.from({ length: Math.max(1, layers) }, (_, index) => ({
			hold: (index / layers) * 100,
			end: ((index + 1) / layers) * 100,
			widest: index === layers - 1
		}))
	);
</script>

<!--
	`aria-hidden` and `pointer-events: none`, always: this is a legibility treatment
	applied to someone else's content, not an element in its own right.

	It must also never be an *ancestor* of a glass surface. Each layer carries a
	`mask`, which makes it a backdrop root, so a `LiquidGlass` nested inside one
	would filter the band's output instead of the page. Controls belong beside the
	band, not within it — which is exactly how they sit on iOS, and why they can be
	real glass there.
-->
<div
	class={`lg-scroll-edge ${className}`}
	data-side={side}
	data-scheme={scheme}
	data-tier={tier}
	data-active={progress > 0 ? 'true' : 'false'}
	style={style || undefined}
	style:--lg-scroll-edge-blur={`${layerBlur}px`}
	style:--lg-scroll-edge-saturation={String(1 + (saturation - 1) * progress)}
	style:--lg-scroll-edge-scrim={String((filtered ? scrim : SCROLL_EDGE.flatScrim) * progress)}
	aria-hidden="true"
>
	{#if filtered}
		{#each bands as band, index (index)}
			<div
				class="lg-scroll-edge-layer"
				class:lg-scroll-edge-widest={band.widest}
				style:--lg-scroll-edge-hold={`${band.hold}%`}
				style:--lg-scroll-edge-end={`${band.end}%`}
			></div>
		{/each}
	{/if}

	<div class="lg-scroll-edge-scrim"></div>
</div>

<style>
	/*
	 * Absolutely positioned and sized by whatever box the caller puts it in, rather
	 * than taking a height prop: the band's depth is a layout decision — it has to
	 * agree with the chrome pinned over it and bleed past it — and the caller is the
	 * only one holding both numbers.
	 */
	.lg-scroll-edge {
		position: absolute;
		inset: 0;
		pointer-events: none;

		/* Light content wants a light scrim, dark content a dark one: the scrim is
		   there to hold contrast against the *text*, which follows the scheme. */
		--lg-scroll-edge-shade: 255 255 255;

		/* The gradient direction is a token substitution, so both sides share one rule. */
		--lg-scroll-edge-dir: to bottom;
	}

	@media (prefers-color-scheme: dark) {
		.lg-scroll-edge {
			--lg-scroll-edge-shade: 6 8 12;
		}
	}

	.lg-scroll-edge[data-scheme='light'] {
		--lg-scroll-edge-shade: 255 255 255;
	}
	.lg-scroll-edge[data-scheme='dark'] {
		--lg-scroll-edge-shade: 6 8 12;
	}

	.lg-scroll-edge[data-side='bottom'] {
		--lg-scroll-edge-dir: to top;
	}

	/*
	 * Nothing composited at all while the band is inert.
	 *
	 * A `backdrop-filter` layer costs a readback of everything behind it every frame
	 * whether or not its radius is zero, and a page can hold several of these. Unlike
	 * the glass primitive there is no warm-up to protect — a CSS blur has no map to
	 * rasterise — so switching the layers off entirely at rest is free, and switching
	 * them back on at the first pixel of scroll is invisible because the radius there
	 * is still zero.
	 */
	.lg-scroll-edge[data-active='false'] .lg-scroll-edge-layer {
		display: none;
	}

	.lg-scroll-edge-layer {
		position: absolute;
		inset: 0;
		backdrop-filter: blur(var(--lg-scroll-edge-blur));
		-webkit-backdrop-filter: blur(var(--lg-scroll-edge-blur));
		/*
		 * Opaque from the pinned edge to `hold`, then out by `end`. The two stops are
		 * what stagger the layers into a radius ramp; see the component script.
		 */
		mask-image: linear-gradient(
			var(--lg-scroll-edge-dir),
			#000 0%,
			#000 var(--lg-scroll-edge-hold),
			transparent var(--lg-scroll-edge-end)
		);
		-webkit-mask-image: linear-gradient(
			var(--lg-scroll-edge-dir),
			#000 0%,
			#000 var(--lg-scroll-edge-hold),
			transparent var(--lg-scroll-edge-end)
		);
	}

	.lg-scroll-edge-widest {
		backdrop-filter: blur(var(--lg-scroll-edge-blur)) saturate(var(--lg-scroll-edge-saturation));
		-webkit-backdrop-filter: blur(var(--lg-scroll-edge-blur))
			saturate(var(--lg-scroll-edge-saturation));
	}

	/*
	 * The scrim runs the full depth on its own curve rather than following the mask
	 * staircase: it is answering a different problem — luminance, which blur does not
	 * touch — and a scrim that stopped where the blur does would draw the boundary the
	 * blur is there to hide.
	 */
	.lg-scroll-edge-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			var(--lg-scroll-edge-dir),
			rgb(var(--lg-scroll-edge-shade) / var(--lg-scroll-edge-scrim)) 0%,
			rgb(var(--lg-scroll-edge-shade) / calc(var(--lg-scroll-edge-scrim) * 0.45)) 45%,
			rgb(var(--lg-scroll-edge-shade) / 0) 100%
		);
	}
</style>
