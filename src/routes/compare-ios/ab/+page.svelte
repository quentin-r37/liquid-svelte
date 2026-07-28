<script lang="ts">
	/**
	 * Buttons *and* tabs on one stage, for the A/B against the simulator.
	 *
	 * `/compare-ios/tabs` covers the rail alone; this route adds `LiquidButton` at
	 * the same fixed offsets so a single screenshot pairs with a single native
	 * capture and the two materials can be read against `.glassEffect(.regular)`
	 * and `.glassEffect(.clear)` in the same frame. Stage is identical to the tabs
	 * route (402x874 = iPhone 17 Pro points, eight stripes, 11px rows on a 6px
	 * cadence) so the backdrop cancels out.
	 *
	 * `?bare=1` drops every glass surface — the pixel-exact no-glass reference the
	 * veil is measured against. `?nolabels=1` makes the labels transparent so an
	 * edge profile crosses the material and nothing else. `?measure=1` prints the
	 * host rects, which is how the native frames are kept in sync. Dev-only.
	 */
	import { page } from '$app/state';
	import { LiquidButton, LiquidTabs } from '$lib';

	const scheme = $derived(page.url.searchParams.get('scheme') === 'dark' ? 'dark' : 'light');
	const bare = $derived(page.url.searchParams.get('bare') === '1');
	const nolabels = $derived(page.url.searchParams.get('nolabels') === '1');
	const measure = $derived(page.url.searchParams.get('measure') === '1');

	const tabs = [
		{ id: 'un', label: 'Un' },
		{ id: 'deux', label: 'Deux' },
		{ id: 'trois', label: 'Trois' }
	];

	const lightStripes = [
		'#ff3b30',
		'#ff9500',
		'#ffcc00',
		'#34c759',
		'#30b0c7',
		'#007aff',
		'#af52de',
		'#ff2d55'
	];

	/*
	 * The same hues at ~35% luminance, mirroring the native harness exactly.
	 *
	 * `?scheme=dark` alone only flips the *material*; the backdrop stays the bright
	 * stripes, which is not what a dark-mode app looks like. This is the case that
	 * matters for `clear`, whose veil is white in both schemes: over a bright
	 * backdrop a white lift is invisible, over a dark one it is the whole reading.
	 */
	const darkStripes = [
		'#591412',
		'#593300',
		'#594700',
		'#12451f',
		'#123d45',
		'#002b59',
		'#3d1c4f',
		'#590f1f'
	];

	const stripes = $derived(page.url.searchParams.get('bg') === 'dark' ? darkStripes : lightStripes);

	let stage = $state<HTMLElement | null>(null);
	let rects = $state('');

	$effect(() => {
		if (!measure || !stage) return;
		// One frame of slack: the rail sizes itself off a ResizeObserver pass.
		requestAnimationFrame(() => {
			const host = stage!.getBoundingClientRect();
			const out: Record<string, number[]> = {};
			for (const slot of stage!.querySelectorAll<HTMLElement>('.slot')) {
				const el = slot.querySelector<HTMLElement>('.lg') ?? slot;
				const r = el.getBoundingClientRect();
				out[slot.dataset.name ?? '?'] = [
					Math.round((r.left - host.left) * 100) / 100,
					Math.round((r.top - host.top) * 100) / 100,
					Math.round(r.width * 100) / 100,
					Math.round(r.height * 100) / 100
				];
			}
			rects = JSON.stringify(out);
		});
	});
</script>

<svelte:head>
	<title>compare-ios/ab — liquid-svelte</title>
</svelte:head>

<div class="stage" data-scheme={scheme} bind:this={stage}>
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
		<div class="slot" class:nolabels data-name="tabs-regular" style:top="150px">
			<LiquidTabs {tabs} variant="regular" label="regular" />
		</div>
		<div class="slot" class:nolabels data-name="tabs-clear" style:top="350px">
			<LiquidTabs {tabs} variant="clear" label="clear" />
		</div>
		<div class="slot" class:nolabels data-name="button-regular" style:top="550px">
			<LiquidButton variant="regular">Bouton</LiquidButton>
		</div>
		<div class="slot" class:nolabels data-name="button-clear" style:top="650px">
			<LiquidButton variant="clear">Bouton</LiquidButton>
		</div>
	{/if}

	{#if measure}
		<pre id="measure">{rects}</pre>
	{/if}
</div>

<style>
	/* No page margin: the capture has to line up with the simulator's frame
	   buffer pixel for pixel, so the stage must start at 0,0. */
	:global(body) {
		margin: 0;
	}

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

	/* Fixed row height, unlike the tabs route's content-sized one: the native
	   stage has to reproduce this cadence exactly or the texture under the two
	   materials differs and the veil measurement drifts. */
	.row {
		display: flex;
		align-items: center;
		height: 13px;
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

	/* Flex centring, never a transform: a transformed ancestor kills
	   backdrop-filter in Chromium (see CLAUDE.md). */
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

	.slot.nolabels :global(.lg-tabs-tab),
	.slot.nolabels :global(.lg) {
		color: transparent;
	}

	#measure {
		position: absolute;
		left: 0;
		bottom: 0;
		margin: 0;
		font-size: 6px;
		color: #000;
	}
</style>
