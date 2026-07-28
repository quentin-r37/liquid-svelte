<script lang="ts">
	import { LiquidMenu, type LiquidMenuItem } from '$lib/liquid-glass/index.js';

	const items: LiquidMenuItem[] = [
		{ id: 'duplicate', label: 'Duplicate', hint: 'Copy with the same optics' },
		{ id: 'rename', label: 'Rename' },
		{ id: 'locked', label: 'Regenerate', hint: 'Unavailable on this tier', disabled: true },
		{ id: 'delete', label: 'Delete', destructive: true, separated: true }
	];

	let choice = $state('—');
</script>

<div class="row">
	<LiquidMenu {items} onselect={(id) => (choice = id)}>Actions</LiquidMenu>
	<LiquidMenu {items} placement="bottom-end" onselect={(id) => (choice = id)}>
		End-aligned
	</LiquidMenu>
</div>
<p class="readout">selected: {choice}</p>

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
