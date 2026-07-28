<script lang="ts">
	import {
		LiquidButton,
		LiquidCard,
		type GlassMode,
		type GlassVariant
	} from '$lib/liquid-glass/index.js';

	let { variant = 'regular', mode = 'auto' }: { variant?: GlassVariant; mode?: GlassMode } =
		$props();
</script>

<LiquidCard {variant} {mode} width={340}>
	{#snippet header()}Lossless export{/snippet}
	Rendered at the source resolution, with the displacement maps rebuilt for the target size rather than
	scaled. Nothing leaves the device.
	{#snippet footer()}
		<div class="actions">
			<LiquidButton size="sm" {variant} {mode}>Not now</LiquidButton>
			<LiquidButton size="sm" {variant} {mode}>Export</LiquidButton>
		</div>
	{/snippet}
</LiquidCard>

<style>
	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
</style>
