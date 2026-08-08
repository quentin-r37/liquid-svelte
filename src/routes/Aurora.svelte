<script lang="ts">
	/**
	 * Static aurora backdrop for the landing page.
	 *
	 * The harness routes keep the scrolling grid: its moving hairlines *are* the
	 * refraction test. The landing page is not a test — it is a resting surface —
	 * and the grid's infinite transform loop was the one ongoing cost of an
	 * otherwise idle page: a composited layer moving every frame underneath a
	 * dozen `backdrop-filter`s forces every one of them to re-sample every frame,
	 * for as long as the tab is visible. A static backdrop drops the page to zero
	 * scheduled work at rest; the glass only re-samples when something actually
	 * changes (hover springs, the switch, the slider).
	 *
	 * Everything is one element and one `background` stack, painted once. The
	 * ribbons are radial gradients softened by their own colour stops rather than
	 * `filter: blur()` — a large blur over a viewport-sized layer is a heavy (if
	 * one-off) raster pass that pins a full-size texture, while gradients are
	 * cheap and band-free at these radii. The hue spread (teal → violet → rose →
	 * blue) is not decoration only: it keeps opposing colour edges under the
	 * glass, so chromatic aberration still has gradients to split even though
	 * nothing moves.
	 */
	let {
		scheme = 'dark',
		fixed = false
	}: {
		scheme?: 'light' | 'dark';
		/** Pin to the viewport (`position: fixed`) instead of filling the parent. */
		fixed?: boolean;
	} = $props();
</script>

<div class="aurora" class:fixed data-scheme={scheme} aria-hidden="true"></div>

<style>
	.aurora {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(95% 65% at 12% 6%, rgb(45 196 178 / 0.3), transparent 62%),
			radial-gradient(75% 60% at 85% 10%, rgb(124 104 238 / 0.34), transparent 64%),
			radial-gradient(85% 65% at 70% 82%, rgb(217 100 148 / 0.2), transparent 66%),
			radial-gradient(65% 55% at 26% 94%, rgb(66 118 222 / 0.24), transparent 62%),
			linear-gradient(180deg, #0b0e18 0%, #0d1122 52%, #0a0c14 100%);
	}

	.aurora.fixed {
		position: fixed;
		z-index: -1;
	}

	/*
	 * Same ribbon placement in light, pulled toward pastel: the alphas drop and the
	 * base flips to a cool near-white so glass tint and text contrast both hold.
	 */
	.aurora[data-scheme='light'] {
		background:
			radial-gradient(95% 65% at 12% 6%, rgb(52 190 172 / 0.26), transparent 62%),
			radial-gradient(75% 60% at 85% 10%, rgb(139 120 245 / 0.28), transparent 64%),
			radial-gradient(85% 65% at 70% 82%, rgb(232 130 172 / 0.22), transparent 66%),
			radial-gradient(65% 55% at 26% 94%, rgb(96 142 235 / 0.22), transparent 62%),
			linear-gradient(180deg, #f2f4f9 0%, #e6e9f2 52%, #dde0ea 100%);
	}
</style>
