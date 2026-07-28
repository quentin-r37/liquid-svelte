<script lang="ts">
	import { LiquidButton } from '$lib/liquid-glass/index.js';

	let presses = $state(0);
</script>

<div class="row">
	<LiquidButton size="sm" onclick={() => (presses += 1)}>Small</LiquidButton>
	<LiquidButton onclick={() => (presses += 1)}>Medium</LiquidButton>
	<LiquidButton size="lg" tone="prominent" onclick={() => (presses += 1)}>Prominent</LiquidButton>
	<LiquidButton disabled>Disabled</LiquidButton>
</div>
<p class="readout">presses: {presses}</p>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	.readout {
		margin: 1rem 0 0;
		text-align: center;
		font-size: 0.8rem;
		opacity: 0.7;
	}
</style>
