<script module lang="ts">
	export type BackdropKind = 'grid' | 'photos';

	/** Option list for the `<select>` in each harness route, so both stay in sync. */
	export const BACKDROP_KINDS: { value: BackdropKind; label: string }[] = [
		{ value: 'grid', label: 'grid' },
		{ value: 'photos', label: 'photos' }
	];
</script>

<script lang="ts">
	/**
	 * Picks the backdrop the harness routes render behind the glass.
	 *
	 * Two different tests, not two skins: the grid shows *where* the refraction bends
	 * (straight lines, analytic), the photo wall shows whether it survives real content
	 * (high frequency, no structure). Keeping the switch in one component means `/demo`
	 * and `/probe` can never drift apart on which backdrops exist.
	 */
	import PhotoWall from './PhotoWall.svelte';
	import ScrollingGrid from './ScrollingGrid.svelte';

	let {
		kind = 'grid',
		scheme = 'dark',
		fixed = false,
		speed = 1
	}: {
		kind?: BackdropKind;
		scheme?: 'light' | 'dark';
		/** Pin to the viewport (`position: fixed`) instead of filling the parent. */
		fixed?: boolean;
		/** Multiplier on every animation — 0.5 is half speed, 2 is double. */
		speed?: number;
	} = $props();
</script>

{#if kind === 'photos'}
	<PhotoWall {scheme} {fixed} {speed} />
{:else}
	<ScrollingGrid {scheme} {fixed} {speed} />
{/if}
