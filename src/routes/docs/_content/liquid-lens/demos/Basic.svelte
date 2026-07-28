<script lang="ts">
	import { LiquidLens, type GlassMode } from '$lib/liquid-glass/index.js';

	let { mode = 'auto' }: { mode?: GlassMode } = $props();

	let stage = $state<HTMLElement | null>(null);
</script>

<!-- position: relative makes the stage the lens's offsetParent, which is what
     its bounds calculation expects. -->
<div class="stage" bind:this={stage}>
	<div class="copy">
		<p>
			The refraction is a displacement map: for every pixel, the distance to the outline picks a
			magnitude off a lookup table, and the outward edge normal turns it into a vector.
		</p>
		<p>
			The lookup table comes from Snell's law applied to a quartic squircle profile. Convex surfaces
			have an infinite slope right at the rim, so the exact vector form matters: it saturates at a
			finite offset instead of collapsing into a one-pixel spike.
		</p>
		<p>
			Peak displacement is about four times the bezel width — but only in a very thin band at the
			outer edge. Halfway into the bezel the magnitude is already down to 0.05.
		</p>
	</div>

	<LiquidLens container={stage} {mode} label="Magnifier" style="left: 8%; top: 22%;" />
</div>

<style>
	.stage {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		padding: 1.5rem;
		box-sizing: border-box;
	}

	.copy {
		max-width: 40rem;
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.copy p {
		margin: 0 0 1rem;
	}
</style>
