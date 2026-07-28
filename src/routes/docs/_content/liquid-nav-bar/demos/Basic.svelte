<script lang="ts">
	import { LiquidNavBar, LiquidButton, type GlassMode } from '$lib/liquid-glass/index.js';
	import { ChevronLeft, Search } from '@lucide/svelte';

	let { mode = 'auto' }: { mode?: GlassMode } = $props();

	let scroller = $state<HTMLElement | null>(null);
	let largeTitle = $state<HTMLElement | null>(null);

	const shelf = [
		{ id: 1, title: 'Midnight Drive', meta: 'Playlist', hue: 210 },
		{ id: 2, title: 'Glasswork', meta: 'Album', hue: 280 },
		{ id: 3, title: 'Refraction', meta: 'Single', hue: 340 },
		{ id: 4, title: 'Caustics', meta: 'Album', hue: 30 },
		{ id: 5, title: 'Snell', meta: 'Playlist', hue: 160 },
		{ id: 6, title: 'Specular', meta: 'Album', hue: 110 }
	];
</script>

<!-- The scroll container must carry no mask, filter, opacity or transform — any of
     them would make it a backdrop root and leave the band nothing to blur. -->
<div class="scroller" bind:this={scroller}>
	<LiquidNavBar title="Listen Now" titleTarget={largeTitle} {scroller} {mode}>
		{#snippet leading()}
			<LiquidButton shape="circle" {mode} aria-label="Back"><ChevronLeft /></LiquidButton>
		{/snippet}
		{#snippet trailing()}
			<LiquidButton shape="circle" {mode} aria-label="Search"><Search /></LiquidButton>
		{/snippet}
	</LiquidNavBar>

	<div class="content">
		<h3 class="large-title" bind:this={largeTitle}>Listen Now</h3>
		<div class="shelf">
			{#each shelf as album (album.id)}
				<article style:--hue={album.hue}>
					<div class="art"></div>
					<p class="title">{album.title}</p>
					<p class="meta">{album.meta}</p>
				</article>
			{/each}
		</div>
	</div>
</div>

<style>
	.scroller {
		position: relative;
		width: 100%;
		height: 100%;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: rgb(10 12 20 / 0.35);
	}

	.content {
		padding: 0 1.1rem 2rem;
	}

	.large-title {
		margin: 0.75rem 0 1rem;
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.shelf {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: 1rem;
	}

	.art {
		aspect-ratio: 1;
		border-radius: 12px;
		background: linear-gradient(
			145deg,
			hsl(var(--hue) 82% 62%),
			hsl(calc(var(--hue) + 42) 74% 38%)
		);
	}

	.title {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.meta {
		margin: 0.1rem 0 0;
		font-size: 0.75rem;
		opacity: 0.6;
	}
</style>
