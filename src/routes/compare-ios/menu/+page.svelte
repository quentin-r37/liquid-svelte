<script lang="ts">
	/**
	 * Menu-panel counterpart of /compare-ios.
	 *
	 * The stage is a pixel-for-pixel copy of the backdrop drawn by the *menu*
	 * comparison scratchpad app (eight equal rainbow stripes, 11px text rows on a
	 * 6px cadence): screenshot the simulator's native `UIMenu` and this page side
	 * by side and the backdrops cancel out, leaving only the material to compare.
	 * `?scheme=dark` matches the simulator's dark appearance. Dev-only.
	 */
	import { page } from '$app/state';
	import { LiquidMenu, type LiquidMenuItem } from '$lib';

	const scheme = $derived(page.url.searchParams.get('scheme') === 'dark' ? 'dark' : 'light');

	const items: LiquidMenuItem[] = [
		{ id: 'new', label: 'Nouveau dossier' },
		{ id: 'rename', label: 'Renommer' },
		{ id: 'dup', label: 'Dupliquer' },
		{ id: 'del', label: 'Supprimer', destructive: true, separated: true }
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

	let openRegular = $state(false);
	let openClear = $state(false);

	// Opened after mount rather than initially: the panel has to be measured once
	// before the reveal can settle, same as a user opening it.
	$effect(() => {
		const timer = setTimeout(() => {
			openRegular = true;
			openClear = true;
		}, 400);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>compare-ios/menu — liquid-svelte</title>
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

	<div class="menus">
		<div class="slot">
			<LiquidMenu {items} bind:open={openRegular} variant="regular">Regular</LiquidMenu>
			<span class="caption">regular</span>
		</div>
		<div class="slot">
			<LiquidMenu {items} bind:open={openClear} variant="clear">Clear</LiquidMenu>
			<span class="caption">clear</span>
		</div>
	</div>
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

	.menus {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 300px;
		padding-top: 100px;
	}

	.slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.caption {
		font-size: 12px;
		font-weight: 700;
		color: #fff;
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.6);
	}

	/* The items inherit `color`; the simulator's dark menu runs white text. */
	.stage[data-scheme='dark'] .menus {
		color: #f2f2f7;
	}
</style>
