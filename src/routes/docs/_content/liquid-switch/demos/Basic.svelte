<script lang="ts">
	import { LiquidSwitch } from '$lib/liquid-glass/index.js';

	let notifications = $state(true);
	let telemetry = $state(false);
</script>

<div class="col">
	<LiquidSwitch bind:checked={notifications}>Notifications</LiquidSwitch>
	<LiquidSwitch bind:checked={telemetry} size="sm">Anonymous telemetry</LiquidSwitch>
	<LiquidSwitch checked disabled>Locked setting</LiquidSwitch>
</div>

<style>
	.col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1.25rem;
	}
</style>
