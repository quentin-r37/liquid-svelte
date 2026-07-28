<script lang="ts">
	import { LiquidButton, type GlassMode, type GlassVariant } from '$lib/liquid-glass/index.js';
	import { Play, SkipBack, SkipForward } from '@lucide/svelte';

	let { variant = 'regular', mode = 'auto' }: { variant?: GlassVariant; mode?: GlassMode } =
		$props();
</script>

<div class="row">
	<LiquidButton shape="circle" size="sm" {variant} {mode} aria-label="Previous">
		<SkipBack />
	</LiquidButton>
	<LiquidButton shape="circle" {variant} {mode} aria-label="Play"><Play /></LiquidButton>
	<LiquidButton shape="circle" size="lg" tone="prominent" {variant} {mode} aria-label="Next">
		<SkipForward />
	</LiquidButton>
	<LiquidButton {variant} {mode}><Play />Play all</LiquidButton>
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}
</style>
