<script lang="ts">
	/**
	 * Side-by-side harness against the real Liquid Glass.
	 *
	 * The 420x640 stage below is a pixel-for-pixel copy of the backdrop drawn by the
	 * native SwiftUI app in the comparison scratchpad (same gradient stops, circle
	 * centres and line cadence), so a screenshot of each can be compared directly.
	 * Dev-only, like /probe and /demo.
	 */
	import { LiquidButton } from '$lib';
</script>

<svelte:head>
	<title>compare-ios — liquid-svelte</title>
</svelte:head>

<div class="page" data-scheme="light">
	<div class="stage">
		<div class="circle orange"></div>
		<div class="circle blue"></div>
		<div class="circle green"></div>
		<div class="lines"></div>

		<div class="column">
			<span class="caption">liquid-svelte (web)</span>
			<LiquidButton>Plain</LiquidButton>
			<LiquidButton tone="prominent">Prominent</LiquidButton>
			<LiquidButton shape="circle" aria-label="Like">
				<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
					/>
				</svg>
			</LiquidButton>
			<LiquidButton>Regular capsule</LiquidButton>
			<LiquidButton variant="clear">Clear capsule</LiquidButton>
		</div>
	</div>
</div>

<style>
	.page {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background: #e8e8ec;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
	}

	/*
	 * Everything below mirrors SharedBackdrop in the native app. Change one side,
	 * change the other.
	 */
	.stage {
		position: relative;
		width: 420px;
		height: 640px;
		overflow: hidden;
		background: linear-gradient(135deg, #ffe3b3 0%, #ffc2ce 50%, #b9d0ff 100%);
		color: #1c1c1e;
	}

	.circle {
		position: absolute;
		border-radius: 50%;
		opacity: 0.85;
	}

	.orange {
		left: 30px;
		top: 80px;
		width: 120px;
		height: 120px;
		background: #ff7a59;
	}

	.blue {
		left: 240px;
		top: 150px;
		width: 160px;
		height: 160px;
		background: #3b82f6;
	}

	.green {
		left: 90px;
		top: 400px;
		width: 140px;
		height: 140px;
		background: #22b573;
	}

	/* 2px white rows centred every 48px from y=24; 1px black columns every 64px from x=32. */
	.lines {
		position: absolute;
		inset: 0;
		background:
			repeating-linear-gradient(
				to bottom,
				transparent 0 23px,
				rgb(255 255 255 / 0.6) 23px 25px,
				transparent 25px 48px
			),
			repeating-linear-gradient(
				to right,
				transparent 0 31.5px,
				rgb(0 0 0 / 0.18) 31.5px 32.5px,
				transparent 32.5px 64px
			);
	}

	.column {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 28px;
	}

	.caption {
		font-size: 12px;
		font-weight: 600;
		color: rgb(0 0 0 / 0.55);
	}
</style>
