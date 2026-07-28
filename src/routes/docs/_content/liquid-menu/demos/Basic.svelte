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
