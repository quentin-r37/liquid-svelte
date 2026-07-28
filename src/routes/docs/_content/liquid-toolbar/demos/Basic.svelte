<script lang="ts">
	import { LiquidToolbar, type LiquidToolbarItem } from '$lib/liquid-glass/index.js';
	import { Copy, Ellipsis, Share2, Star, Trash2 } from '@lucide/svelte';

	let starred = $state(false);
	let last = $state('—');

	const items: LiquidToolbarItem[] = $derived([
		{ id: 'copy', label: 'Duplicate', icon: copyIcon },
		{ id: 'share', label: 'Share', icon: shareIcon },
		{ id: 'star', label: 'Add to favourites', icon: starIcon, selected: starred },
		{ id: 'delete', label: 'Delete', icon: trashIcon, destructive: true, separated: true }
	]);

	function onaction(id: string) {
		last = id;
		if (id === 'star') starred = !starred;
	}
</script>

{#snippet copyIcon()}<Copy />{/snippet}
{#snippet shareIcon()}<Share2 />{/snippet}
{#snippet starIcon()}<Star />{/snippet}
{#snippet trashIcon()}<Trash2 />{/snippet}

<div class="row">
	<LiquidToolbar {items} label="Document actions" {onaction}>
		<Ellipsis />
	</LiquidToolbar>
</div>
<p class="readout">last action: {last} · favourite: {starred ? 'on' : 'off'}</p>

<style>
	.row {
		display: flex;
		justify-content: center;
	}

	.readout {
		margin: 1rem 0 0;
		text-align: center;
		font-size: 0.8rem;
		opacity: 0.7;
	}
</style>
