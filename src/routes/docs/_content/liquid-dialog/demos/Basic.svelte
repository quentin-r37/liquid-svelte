<script lang="ts">
	import {
		LiquidButton,
		LiquidDialog,
		type GlassMode,
		type GlassVariant
	} from '$lib/liquid-glass/index.js';

	let { variant = 'regular', mode = 'auto' }: { variant?: GlassVariant; mode?: GlassMode } =
		$props();

	let alertOpen = $state(false);
	let sheetOpen = $state(false);
</script>

<div class="row">
	<LiquidButton {variant} {mode} onclick={() => (alertOpen = true)}>Open dialog</LiquidButton>
	<LiquidButton {variant} {mode} onclick={() => (sheetOpen = true)}>Open sheet</LiquidButton>
</div>

<!-- `contained` keeps both modals inside the demo stage; drop it in an app so the
     overlay fills the viewport. -->
<LiquidDialog bind:open={alertOpen} contained {variant} {mode} label="Delete recording">
	<div class="dialog-content">
		<h3>Delete recording?</h3>
		<p>The take and its edits are removed from this device. This cannot be undone.</p>
		<div class="actions">
			<LiquidButton size="sm" {variant} {mode} onclick={() => (alertOpen = false)}>
				Cancel
			</LiquidButton>
			<LiquidButton size="sm" {variant} {mode} onclick={() => (alertOpen = false)}>
				Delete
			</LiquidButton>
		</div>
	</div>
</LiquidDialog>

<LiquidDialog bind:open={sheetOpen} presentation="sheet" contained {variant} {mode} label="Share">
	<div class="dialog-content">
		<h3>Share</h3>
		<p>
			The sheet floats clear of the edges, rises on a spring, and leaves on a monotone curve. Escape
			and the scrim dismiss it; Tab stays inside.
		</p>
		<div class="actions">
			<LiquidButton size="sm" {variant} {mode} onclick={() => (sheetOpen = false)}
				>Done</LiquidButton
			>
		</div>
	</div>
</LiquidDialog>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	.dialog-content h3 {
		margin: 0 0 0.4rem;
		font-size: 1rem;
	}

	.dialog-content p {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		line-height: 1.5;
		opacity: 0.85;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
</style>
