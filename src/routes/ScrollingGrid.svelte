<script lang="ts">
	/**
	 * Scrolling grid backdrop, shared by the gallery and the probe.
	 *
	 * A grid in motion is the sharpest refraction test available: straight lines make
	 * the displacement obvious in space, and scrolling makes it obvious in time — a
	 * line visibly bends as it enters the bezel, snaps back as it leaves. Two grids
	 * running at different speeds and directions add parallax, so the flat centre and
	 * the refracting rim never agree with each other.
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
	<div class="field field-c"></div>
	<div class="field field-d"></div>

	<div class="layer minor"></div>
	<div class="layer major"></div>

	<div class="markers">
		<span class="marker bar"></span>
		<span class="marker ring"></span>
		<span class="marker dot"></span>
		<span class="marker slab"></span>
	</div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #06070d;
		color: rgb(255 255 255 / 0.55);
	}

	.backdrop.fixed {
		position: fixed;
		z-index: -1;
	}

	.backdrop[data-scheme='light'] {
		background: #f5f3ee;
		color: rgb(12 14 26 / 0.5);
	}

	.field {
		position: absolute;
		border-radius: 50%;
		filter: blur(60px);
		opacity: 0.8;
	}

	.field-a {
		inset: -14% auto auto -10%;
		width: 58vw;
		height: 58vw;
		background: radial-gradient(circle, #ff2f7b 0%, #7a2bff 52%, transparent 72%);
	}

	.field-b {
		inset: auto -12% -20% auto;
		width: 52vw;
		height: 52vw;
		background: radial-gradient(circle, #00e0ff 0%, #0055ff 48%, transparent 70%);
	}

	.field-c {
		inset: 26% 4% auto auto;
		width: 34vw;
		height: 34vw;
		background: radial-gradient(circle, #ffd200 0%, #ff6a00 52%, transparent 72%);
	}

	.field-d {
		inset: auto auto 4% 22%;
		width: 38vw;
		height: 38vw;
		background: radial-gradient(circle, #00ffa3 0%, #00a86b 48%, transparent 70%);
	}

	/*
	 * Each grid is oversized by more than one tile and translated by exactly one
	 * tile, so the loop is seamless and the transform stays on the compositor.
	 */
	.layer {
		position: absolute;
		inset: -160px;
		will-change: transform;
	}

	.minor {
		background-image:
			linear-gradient(to right, currentColor 0 1px, transparent 1px 100%),
			linear-gradient(to bottom, currentColor 0 1px, transparent 1px 100%);
		background-size: 28px 28px;
		opacity: 0.22;
		animation: drift-minor calc(2.2s / var(--speed)) linear infinite;
	}

	.major {
		background-image:
			linear-gradient(to right, currentColor 0 2px, transparent 2px 100%),
			linear-gradient(to bottom, currentColor 0 2px, transparent 2px 100%);
		background-size: 112px 112px;
		opacity: 0.32;
		animation: drift-major calc(5s / var(--speed)) linear infinite;
	}

	@keyframes drift-minor {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			transform: translate3d(28px, 28px, 0);
		}
	}

	@keyframes drift-major {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			transform: translate3d(-112px, 112px, 0);
		}
	}

	/* Hard-edged shapes crossing the frame: the grid shows the bend, these show the shift. */
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
		top: 21%;
		width: 240px;
		height: 20px;
		border-radius: 10px;
		background: rgb(255 255 255 / 0.85);
		animation: cross-right calc(26s / var(--speed)) linear infinite;
	}

	.ring {
		top: 58%;
		width: 124px;
		height: 124px;
		border: 9px solid rgb(0 255 225 / 0.9);
		border-radius: 50%;
		animation: cross-left calc(34s / var(--speed)) linear infinite;
	}

	.dot {
		top: 38%;
		width: 76px;
		height: 76px;
		border-radius: 20px;
		background: rgb(255 0 90 / 0.9);
		animation: cross-right calc(19s / var(--speed)) linear infinite;
		animation-delay: calc(-7s / var(--speed));
	}

	.slab {
		top: 76%;
		width: 200px;
		height: 26px;
		border-radius: 6px;
		background: #101218;
		box-shadow: 0 0 0 3px rgb(255 255 255 / 0.9);
		animation: cross-left calc(28s / var(--speed)) linear infinite;
		animation-delay: calc(-13s / var(--speed));
	}

	.backdrop[data-scheme='light'] .bar {
		background: rgb(12 14 26 / 0.85);
	}

	.backdrop[data-scheme='light'] .ring {
		border-color: rgb(0 120 140 / 0.9);
	}

	.backdrop[data-scheme='light'] .slab {
		background: #fefdfa;
		box-shadow: 0 0 0 3px rgb(12 14 26 / 0.9);
	}

	@keyframes cross-right {
		from {
			transform: translate3d(-260px, 0, 0);
		}
		to {
			transform: translate3d(calc(100vw + 260px), 0, 0);
		}
	}

	@keyframes cross-left {
		from {
			transform: translate3d(calc(100vw + 260px), 0, 0);
		}
		to {
			transform: translate3d(-260px, 0, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.layer,
		.marker {
			animation: none;
		}
	}
</style>
