<script lang="ts">
	import { LiquidButton } from '$lib/liquid-glass/index.js';
	import { Play, SkipBack, SkipForward } from '@lucide/svelte';
</script>

<div class="row">
	<LiquidButton shape="circle" size="sm" aria-label="Previous"><SkipBack /></LiquidButton>
	<LiquidButton shape="circle" aria-label="Play"><Play /></LiquidButton>
	<LiquidButton shape="circle" size="lg" tone="prominent" aria-label="Next">
		<SkipForward />
	</LiquidButton>
	<LiquidButton><Play />Play all</LiquidButton>
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}
</style>
