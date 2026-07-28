<script lang="ts">
	/**
	 * Scrolling grid backdrop, shared by the gallery and the probe.
	 *
	 * A grid in motion is the sharpest refraction test available: straight lines make
	 * the displacement obvious in space, and scrolling makes it obvious in time — a
	 * line visibly bends as it enters the bezel, snaps back as it leaves.
	 *
	 * Deliberately restrained, styled after the WWDC25 key art: a sheet of brushed
	 * silver ruled by large-cell hairlines and two near-grey colour fields — nothing
	 * else. The loud version read as the subject of the page instead of the thing the
	 * glass sits on top of — and a backdrop that competes makes it *harder* to judge
	 * the optics, not easier. What is left is the minimum each effect needs: two hues
	 * so chromatic aberration has opposing edges to split, and straight lines in
	 * motion so displacement is measurable in space and in time alike.
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
</div>

<style>
	/*
	 * The surface is WWDC25's sheet of brushed silver: a diagonal metallic ramp with one
	 * broad specular highlight up and left of centre and a shadowed lower-right corner.
	 * All three gradients are static and painted once — the sheen must never repaint
	 * under the backdrop-filter, so only the grid layer above it moves.
	 */
	.backdrop {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background:
			radial-gradient(140% 100% at 28% 18%, rgb(255 255 255 / 0.1), transparent 55%),
			radial-gradient(120% 120% at 100% 100%, rgb(0 0 0 / 0.5), transparent 60%),
			linear-gradient(115deg, #24262d 0%, #17181d 48%, #0d0e12 100%);
		/*
		 * The hairline ink. Bolder than a background ruling normally would be (composited
		 * with `.minor`'s 0.5 this lands at ~0.25 white on dark): the lines are the entire
		 * displacement read, and at hairline width a timid line vanishes inside the bezel
		 * exactly where the bend should be most visible.
		 */
		color: rgb(255 255 255 / 0.5);
	}

	.backdrop.fixed {
		position: fixed;
		z-index: -1;
	}

	.backdrop[data-scheme='light'] {
		background:
			radial-gradient(140% 100% at 28% 18%, rgb(255 255 255 / 0.85), transparent 55%),
			radial-gradient(120% 120% at 100% 100%, rgb(58 62 72 / 0.35), transparent 60%),
			linear-gradient(115deg, #edeef1 0%, #d5d8dd 45%, #b6bac2 78%, #a0a4ad 100%);
		color: rgb(26 30 40 / 0.7);
	}

	/*
	 * Two fields, placed on opposing corners and kept far apart in hue. Chromatic
	 * aberration needs a colour gradient to split, not saturation for its own sake.
	 * An earlier pass pulled both hues almost all the way to grey to keep the silver
	 * sheet reading as metal — which was honest but left the glass with nothing to
	 * refract *in colour*: the tint went muddy and the aberration split greys into
	 * greys. These are the warmed versions: a franker blue against a copper-amber,
	 * saturated enough that the bezel visibly bends colour, while the 90px blur and
	 * sub-0.5 opacity keep them reading as coloured light on the sheet, not artwork.
	 */
	.field {
		position: absolute;
		border-radius: 50%;
		filter: blur(90px);
		opacity: 0.45;
	}

	.field-a {
		inset: -18% auto auto -12%;
		width: 62vw;
		height: 62vw;
		background: radial-gradient(circle, #6d84e8 0%, #3d4fa8 52%, transparent 74%);
	}

	.field-b {
		inset: auto -14% -22% auto;
		width: 56vw;
		height: 56vw;
		background: radial-gradient(circle, #e89a5f 0%, #a05a3c 50%, transparent 72%);
	}

	.backdrop[data-scheme='light'] .field {
		opacity: 0.3;
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
	 * 80px cells: still hairlines ruling a sheet of metal, not graph paper, but tighter
	 * than the 120px WWDC-poster pass so a typical bezel always has a line mid-bend —
	 * at 120px a small control could sit a whole cell away from the nearest crossing
	 * and show no displacement at all. Opacity stays at the 120px value; the extra
	 * lines make the field slightly busier, which here is the point.
	 * ~12px/s is the sweet spot: brisk enough that a line is always mid-bezel
	 * somewhere, slow enough that the surface still reads as calm metal — hence the
	 * duration drops with the tile so the drift speed is unchanged.
	 */
	.minor {
		background-image:
			linear-gradient(to right, currentColor 0 1px, transparent 1px 100%),
			linear-gradient(to bottom, currentColor 0 1px, transparent 1px 100%);
		background-size: 80px 80px;
		opacity: 0.5;
		animation: drift-minor calc(6.7s / var(--speed)) linear infinite;
	}

	@keyframes drift-minor {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			transform: translate3d(80px, 80px, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.layer {
			animation: none;
		}
	}
</style>
