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

	/* Pinned to the stage corner so the components stay centred and free. */
	.readout {
		position: absolute;
		left: 0.9rem;
		bottom: 0.7rem;
		margin: 0;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.4);
		backdrop-filter: blur(8px);
		color: #f4f6fa;
		font-size: 0.75rem;
	}
</style>
