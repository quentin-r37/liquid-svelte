<script lang="ts">
	import {
		LiquidToolbar,
		type GlassMode,
		type GlassVariant,
		type LiquidToolbarItem
	} from '$lib/liquid-glass/index.js';
	import { Copy, Ellipsis, Share2, Star, Trash2 } from '@lucide/svelte';

	let { variant = 'regular', mode = 'auto' }: { variant?: GlassVariant; mode?: GlassMode } =
		$props();

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
	<LiquidToolbar {items} {variant} {mode} label="Document actions" {onaction}>
		<Ellipsis />
	</LiquidToolbar>
</div>
<p class="readout">last action: {last} · favourite: {starred ? 'on' : 'off'}</p>

<style>
	.row {
		display: flex;
		justify-content: center;
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
