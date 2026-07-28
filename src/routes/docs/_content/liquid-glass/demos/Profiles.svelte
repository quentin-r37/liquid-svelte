<script lang="ts">
	import { LiquidGlass } from '$lib/liquid-glass/index.js';
</script>

<div class="row">
	<LiquidGlass width={150} height={150} borderRadius={75} bezel={40} interactive>
		<span class="label">squircle profile</span>
	</LiquidGlass>
	<LiquidGlass width={150} height={150} borderRadius={28} bezel={30} profile="concave" interactive>
		<span class="label">concave profile</span>
	</LiquidGlass>
	<LiquidGlass width={150} height={150} borderRadius={40} bezel={34} profile="lip" interactive>
		<span class="label">lip profile</span>
	</LiquidGlass>
	<LiquidGlass
		width={150}
		height={150}
		borderRadius={20}
		bezel={26}
		chromaticAberration={0.16}
		interactive
	>
		<span class="label">aberration</span>
	</LiquidGlass>
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1rem;
	}

	.label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
	}
</style>
