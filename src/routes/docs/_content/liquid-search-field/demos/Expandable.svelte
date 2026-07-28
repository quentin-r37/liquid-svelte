<script lang="ts">
	import { LiquidSearchField } from '$lib/liquid-glass/index.js';

	let query = $state('');
</script>

<div class="col">
	<LiquidSearchField expandable anchor="end" bind:value={query} placeholder="Search" />
</div>

<style>
	.col {
		width: min(26rem, 100%);
		margin: 0 auto;
	}
</style>
