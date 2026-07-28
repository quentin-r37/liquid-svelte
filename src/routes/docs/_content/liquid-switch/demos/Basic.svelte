<script lang="ts">
	import { LiquidSwitch, type GlassMode } from '$lib/liquid-glass/index.js';

	let { mode = 'auto' }: { mode?: GlassMode } = $props();

	let notifications = $state(true);
	let telemetry = $state(false);
</script>

<div class="col">
	<LiquidSwitch bind:checked={notifications} {mode}>Notifications</LiquidSwitch>
	<LiquidSwitch bind:checked={telemetry} size="sm" {mode}>Anonymous telemetry</LiquidSwitch>
	<LiquidSwitch checked disabled {mode}>Locked setting</LiquidSwitch>
</div>

<style>
	.col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1.25rem;
	}
</style>
