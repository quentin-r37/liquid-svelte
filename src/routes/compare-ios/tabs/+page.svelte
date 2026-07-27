<script lang="ts">
	/**
	 * Tabs counterpart of /compare-ios/menu.
	 *
	 * Same stage — eight rainbow stripes, 11px text rows on a 6px cadence — with a
	 * `LiquidTabs` rail in each material variant at fixed offsets, so a simulator
	 * screenshot of the native tab bar / `.glassEffect` capsules and a headless
	 * capture of this page cancel out and only the materials differ. `?bare=1`
	 * hides the rails for the no-glass veil reference. Dev-only.
	 */
	import { page } from '$app/state';
	import { LiquidTabs } from '$lib';

	const scheme = $derived(page.url.searchParams.get('scheme') === 'dark' ? 'dark' : 'light');
	const bare = $derived(page.url.searchParams.get('bare') === '1');
	// Transparent labels: identical rail geometry, glyph-free face, so an edge
	// profile across a stripe boundary measures the material and nothing else.
	const nolabels = $derived(page.url.searchParams.get('nolabels') === '1');

	const tabs = [
		{ id: 'un', label: 'Un' },
		{ id: 'deux', label: 'Deux' },
		{ id: 'trois', label: 'Trois' }
	];

	const stripes = [
		'#ff3b30',
		'#ff9500',
		'#ffcc00',
		'#34c759',
		'#30b0c7',
		'#007aff',
		'#af52de',
		'#ff2d55'
	];
</script>

<svelte:head>
	<title>compare-ios/tabs — liquid-svelte</title>
</svelte:head>

<div class="stage" data-scheme={scheme}>
	<div class="bg">
		{#each stripes as colour (colour)}
			<div class="stripe" style:background={colour}></div>
		{/each}
	</div>
	<div class="rows">
		{#each Array(40), row}
			<div class="row" class:alt={row % 2 === 1}>
				<span class="dot"></span>
				<span>Ligne de texte fin {row} — abcdefg 0123456789</span>
			</div>
		{/each}
	</div>

	{#if !bare}
		<div class="slot" class:nolabels style:top="150px">
			<LiquidTabs {tabs} variant="regular" label="regular" />
		</div>
		<div class="slot" class:nolabels style:top="350px">
			<LiquidTabs {tabs} variant="clear" label="clear" />
		</div>
	{/if}
</div>

<style>
	.stage {
		position: relative;
		width: 402px;
		height: 874px;
		overflow: hidden;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
	}

	.bg {
		position: absolute;
		inset: 0;
		display: flex;
	}

	.stripe {
		flex: 1;
	}

	.rows {
		position: absolute;
		inset: 60px 0 0 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 12px;
		font-size: 11px;
		font-weight: 600;
		color: #000;
	}

	.row.alt {
		color: #fff;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgb(0 0 0 / 0.6);
	}

	/*
	 * Centred with flex rather than the usual left:50% + translate: a transformed
	 * ancestor kills backdrop-filter in Chromium (see CLAUDE.md), so the wrapper
	 * must never carry a transform.
	 */
	.slot {
		position: absolute;
		left: 0;
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.stage[data-scheme='dark'] {
		color: #f2f2f7;
	}

	.slot.nolabels :global(.lg-tabs-tab) {
		color: transparent;
	}
</style>
