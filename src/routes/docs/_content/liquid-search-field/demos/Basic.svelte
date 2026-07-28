<script lang="ts">
	import { LiquidSearchField } from '$lib/liquid-glass/index.js';

	let query = $state('');
	let submitted = $state('');
</script>

<div class="col">
	<LiquidSearchField bind:value={query} placeholder="Search" onsubmit={(v) => (submitted = v)} />
	<LiquidSearchField size="lg" placeholder="Search library" />
</div>
<p class="readout">query: {query || '—'} · submitted: {submitted || '—'}</p>

<style>
	.col {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: min(26rem, 100%);
		margin: 0 auto;
	}

	.readout {
		margin: 1rem 0 0;
		text-align: center;
		font-size: 0.8rem;
		opacity: 0.7;
	}
</style>
