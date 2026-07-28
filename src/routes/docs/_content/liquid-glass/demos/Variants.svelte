<script lang="ts">
	import { LiquidGlass } from '$lib/liquid-glass/index.js';
</script>

<div class="row">
	<LiquidGlass width={220} height={120} interactive>
		<span class="label">regular</span>
	</LiquidGlass>
	<LiquidGlass width={220} height={120} variant="clear" interactive>
		<span class="label">clear</span>
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
