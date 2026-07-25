<script lang="ts">
	/**
	 * Scrolling grid backdrop, shared by the gallery and the probe.
	 *
	 * A grid in motion is the sharpest refraction test available: straight lines make
	 * the displacement obvious in space, and scrolling makes it obvious in time — a
	 * line visibly bends as it enters the bezel, snaps back as it leaves.
	 *
	 * Deliberately restrained: one fine grid, two desaturated colour fields, and a
	 * single hard-edged marker crossing the frame. The loud version read as the subject
	 * of the page instead of the thing the glass sits on top of — and a backdrop that
	 * competes makes it *harder* to judge the optics, not easier. What is left is the
	 * minimum each effect needs: two hues so chromatic aberration has opposing edges to
	 * split, straight lines so displacement is measurable, and one moving hard edge so
	 * the lateral shift stays visible.
	 *
	 * The coarse second grid is gone with it. It existed for parallax — two layers
	 * disagreeing so the flat centre and the refracting rim never line up — but at this
	 * tile density the fine grid already crosses the bezel several times over, which is
	 * where the bend is legible anyway.
	 *
	 * Only transforms animate. The blurred colour fields stay put on purpose: they
	 * exist for chromatic aberration, and repainting a 60px blur every frame under a
	 * `backdrop-filter` that already re-samples every frame is the one thing that
	 * would actually cost frames here.
	 *
	 * Entirely CSS: no remote images, nothing to load.
	 */
	let {
		scheme = 'dark',
		fixed = false,
		speed = 1
	}: {
		scheme?: 'light' | 'dark';
		/** Pin to the viewport (`position: fixed`) instead of filling the parent. */
		fixed?: boolean;
		/** Multiplier on every animation — 0.5 is half speed, 2 is double. */
		speed?: number;
	} = $props();
</script>

<div class="backdrop" class:fixed data-scheme={scheme} style:--speed={speed} aria-hidden="true">
	<div class="field field-a"></div>
	<div class="field field-b"></div>

	<div class="layer minor"></div>

	<div class="markers">
		<span class="marker bar"></span>
	</div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #08090f;
		color: rgb(255 255 255 / 0.4);
	}

	.backdrop.fixed {
		position: fixed;
		z-index: -1;
	}

	.backdrop[data-scheme='light'] {
		background: #f2f1ed;
		color: rgb(12 14 26 / 0.32);
	}

	/*
	 * Two fields, placed on opposing corners and kept far apart in hue. Chromatic
	 * aberration needs a colour gradient to split, not saturation for its own sake —
	 * a 90px blur at a third opacity still gives the filter a usable ramp while
	 * reading as a tone on the background rather than as artwork.
	 */
	.field {
		position: absolute;
		border-radius: 50%;
		filter: blur(90px);
		opacity: 0.32;
	}

	.field-a {
		inset: -18% auto auto -12%;
		width: 62vw;
		height: 62vw;
		background: radial-gradient(circle, #4a5fc8 0%, #2c3a7a 52%, transparent 74%);
	}

	.field-b {
		inset: auto -14% -22% auto;
		width: 56vw;
		height: 56vw;
		background: radial-gradient(circle, #c88a4a 0%, #7a4f2c 50%, transparent 72%);
	}

	.backdrop[data-scheme='light'] .field {
		opacity: 0.24;
	}

	/*
	 * The grid is oversized by more than one tile and translated by exactly one tile,
	 * so the loop is seamless and the transform stays on the compositor.
	 */
	.layer {
		position: absolute;
		inset: -160px;
		will-change: transform;
	}

	/*
	 * The tile size has to match the keyframe translation exactly or the loop seams.
	 * Opacity is up from the two-layer version: this grid used to sit under a heavier
	 * one and only had to add texture — carrying the frame alone it needs to be
	 * readable on its own.
	 */
	.minor {
		background-image:
			linear-gradient(to right, currentColor 0 1px, transparent 1px 100%),
			linear-gradient(to bottom, currentColor 0 1px, transparent 1px 100%);
		background-size: 28px 28px;
		opacity: 0.2;
		animation: drift-minor calc(4s / var(--speed)) linear infinite;
	}

	@keyframes drift-minor {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			transform: translate3d(28px, 28px, 0);
		}
	}

	/*
	 * One hard-edged shape crossing the frame: the grid shows the bend, this shows the
	 * lateral shift. A single bar on a long cycle is enough to catch — four shapes on
	 * overlapping cycles meant something was always mid-crossing, which is exactly the
	 * busyness that made the grid hard to read.
	 */
	.markers {
		position: absolute;
		inset: 0;
	}

	.marker {
		position: absolute;
		left: 0;
		display: block;
		will-change: transform;
	}

	.bar {
		top: 32%;
		width: 220px;
		height: 14px;
		border-radius: 7px;
		background: rgb(255 255 255 / 0.5);
		animation: cross-right calc(38s / var(--speed)) linear infinite;
	}

	.backdrop[data-scheme='light'] .bar {
		background: rgb(12 14 26 / 0.4);
	}

	@keyframes cross-right {
		from {
			transform: translate3d(-260px, 0, 0);
		}
		to {
			transform: translate3d(calc(100vw + 260px), 0, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.layer,
		.marker {
			animation: none;
		}
	}
</style>
