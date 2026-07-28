<script lang="ts">
	import { LiquidButton, type GlassMode, type GlassVariant } from '$lib/liquid-glass/index.js';

	let { variant = 'regular', mode = 'auto' }: { variant?: GlassVariant; mode?: GlassMode } =
		$props();

	let presses = $state(0);
</script>

<div class="row">
	<LiquidButton size="sm" {variant} {mode} onclick={() => (presses += 1)}>Small</LiquidButton>
	<LiquidButton {variant} {mode} onclick={() => (presses += 1)}>Medium</LiquidButton>
	<LiquidButton size="lg" tone="prominent" {variant} {mode} onclick={() => (presses += 1)}>
		Prominent
	</LiquidButton>
	<LiquidButton {variant} {mode} disabled>Disabled</LiquidButton>
</div>
<p class="readout">presses: {presses}</p>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	/* Pinned to the stage corner so the components stay centred and free. */
	.readout {
		position: absolute;
		left: 0.9rem;
		bottom: 0.7rem;
		margin: 0;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.4);
		backdrop-filter: blur(8px);
		color: #f4f6fa;
		font-size: 0.75rem;
	}
</style>
