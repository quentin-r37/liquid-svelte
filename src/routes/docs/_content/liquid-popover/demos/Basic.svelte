<script lang="ts">
	import {
		LiquidPopover,
		LiquidSlider,
		LiquidSwitch,
		type GlassMode,
		type GlassVariant
	} from '$lib/liquid-glass/index.js';

	let { variant = 'regular', mode = 'auto' }: { variant?: GlassVariant; mode?: GlassMode } =
		$props();

	let grid = $state(true);
	let snap = $state(24);
</script>

<div class="row">
	<LiquidPopover {variant} {mode} label="Canvas options">
		{#snippet trigger()}Canvas{/snippet}
		<div class="option">
			<span>Show grid</span>
			<LiquidSwitch bind:checked={grid} size="sm" {mode} />
		</div>
		<div class="option">
			<span>Snap: {snap}px</span>
			<LiquidSlider bind:value={snap} min={4} max={64} step={4} {mode} />
		</div>
	</LiquidPopover>

	<LiquidPopover placement="bottom-end" {variant} {mode} label="About this file">
		{#snippet trigger()}End-aligned{/snippet}
		<p class="note">
			Any content spills out of the trigger the way a menu panel does — Escape, an outside press or
			focus leaving all dismiss it.
		</p>
	</LiquidPopover>
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	.option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.35rem 0.2rem;
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.note {
		margin: 0;
		max-width: 16rem;
		font-size: 0.875rem;
		line-height: 1.45;
	}
</style>
