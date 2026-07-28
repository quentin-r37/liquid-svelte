<script lang="ts">
	import {
		LiquidTabs,
		type GlassMode,
		type GlassVariant,
		type LiquidTab
	} from '$lib/liquid-glass/index.js';

	let { variant = 'regular', mode = 'auto' }: { variant?: GlassVariant; mode?: GlassMode } =
		$props();

	const tabs: LiquidTab[] = [
		{ id: 'optics', label: 'Optics' },
		{ id: 'motion', label: 'Motion' },
		{ id: 'a11y', label: 'Access' },
		{ id: 'legacy', label: 'Legacy', disabled: true }
	];
	let active = $state('optics');

	const copy: Record<string, string> = {
		optics: 'The bezel carries almost all of the refraction; the centre stays flat.',
		motion: 'Hover, press and drag compose on one shared transform, one flush per frame.',
		a11y: 'Roving focus with manual activation — the ARIA tabs pattern, keyboard-complete.'
	};
</script>

<div class="center">
	<LiquidTabs {tabs} bind:value={active} {variant} {mode} label="Documentation sections">
		{#snippet panel(id)}
			<p class="panel">{copy[id]}</p>
		{/snippet}
	</LiquidTabs>
</div>

<style>
	.center {
		display: flex;
		justify-content: center;
	}

	.panel {
		max-width: 24rem;
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.8;
	}
</style>
