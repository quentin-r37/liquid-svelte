<script lang="ts">
	import { LiquidScrollEdge } from '$lib/liquid-glass/index.js';
</script>

<div class="scroller">
	<!-- The band is absolutely positioned and sized by its box, so the caller decides
	     its depth: a sticky slot pins it to the top and takes no space in the flow. -->
	<div class="edge-slot"><LiquidScrollEdge side="top" /></div>

	<div class="copy">
		<p>
			Scroll this panel. The paragraphs lose definition as they approach the top edge, because the
			blur radius ramps from the pinned edge instead of stopping at a line.
		</p>
		<p>
			Four stacked backdrop layers do the ramping, each masked to hold a different depth of the
			band. Stacked Gaussians add in quadrature, so each layer blurs by the peak over the square
			root of the layer count.
		</p>
		<p>
			The widest layer also carries a mild saturation boost — blur washes colour out, and the
			saturation puts back what it took.
		</p>
		<p>
			A scrim gradient runs the full depth on its own curve. Blur destroys detail but not luminance,
			so the scrim is what keeps text legible right at the edge.
		</p>
		<p>
			At progress 0 every layer is display: none — an idle band costs nothing, and switching it back
			on at the first pixel of scroll is invisible because the radius there is still zero.
		</p>
	</div>
</div>

<style>
	.scroller {
		position: relative;
		width: 100%;
		height: 100%;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.edge-slot {
		position: sticky;
		top: 0;
		z-index: 1;
		height: 4.5rem;
		margin-bottom: -4.5rem;
		pointer-events: none;
	}

	.copy {
		padding: 1.5rem 1.25rem 2rem;
		max-width: 34rem;
		font-size: 0.9rem;
		line-height: 1.6;
	}

	.copy p {
		margin: 0 0 1rem;
	}
</style>
