<script lang="ts">
	import { LiquidSlider } from '$lib/liquid-glass/index.js';

	let volume = $state(65);
	let temperature = $state(21);
</script>

<div class="col">
	<LiquidSlider bind:value={volume} label="Volume" showValue />
	<LiquidSlider
		bind:value={temperature}
		min={16}
		max={28}
		step={0.5}
		label="Target temperature"
		format={(v) => `${v.toFixed(1)}°C`}
		showValue
	/>
	<LiquidSlider value={30} label="Disabled slider" disabled showValue />
</div>

<style>
	.col {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		width: min(26rem, 100%);
		margin: 0 auto;
	}
</style>
