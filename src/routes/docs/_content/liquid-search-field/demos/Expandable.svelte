<script lang="ts">
	import { LiquidSearchField, type GlassMode, type GlassVariant } from '$lib/liquid-glass/index.js';

	let { variant = 'regular', mode = 'auto' }: { variant?: GlassVariant; mode?: GlassMode } =
		$props();

	let query = $state('');
</script>

<div class="col">
	<LiquidSearchField
		expandable
		anchor="end"
		bind:value={query}
		placeholder="Search"
		{variant}
		{mode}
	/>
</div>

<style>
	.col {
		width: min(26rem, 100%);
		margin: 0 auto;
	}
</style>
