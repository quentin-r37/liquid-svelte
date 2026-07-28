<script lang="ts">
	import {
		LiquidTabs,
		type GlassMode,
		type GlassVariant,
		type LiquidTab
	} from '$lib/liquid-glass/index.js';
	import { Play, Search, Shuffle } from '@lucide/svelte';

	let { variant = 'regular', mode = 'auto' }: { variant?: GlassVariant; mode?: GlassMode } =
		$props();

	// $derived because the snippets these reference are declared in the template.
	const tabs: LiquidTab[] = $derived([
		{ id: 'play', label: 'Play', icon: playIcon },
		{ id: 'shuffle', label: 'Shuffle', icon: shuffleIcon },
		{ id: 'search', label: 'Search', icon: searchIcon }
	]);
	const glyphTabs: LiquidTab[] = $derived(tabs.map((tab) => ({ ...tab, iconOnly: true })));

	let inline = $state('play');
	let glyphs = $state('shuffle');
	let stacked = $state('search');
</script>

{#snippet playIcon()}<Play />{/snippet}
{#snippet shuffleIcon()}<Shuffle />{/snippet}
{#snippet searchIcon()}<Search />{/snippet}

<div class="col">
	<LiquidTabs {tabs} bind:value={inline} {variant} {mode} label="Playback source" />
	<LiquidTabs
		tabs={glyphTabs}
		bind:value={glyphs}
		{variant}
		{mode}
		label="Playback source, icons only"
	/>
	<LiquidTabs
		{tabs}
		bind:value={stacked}
		iconPlacement="top"
		{variant}
		{mode}
		label="Playback source, stacked"
	/>
</div>

<style>
	.col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
	}
</style>
