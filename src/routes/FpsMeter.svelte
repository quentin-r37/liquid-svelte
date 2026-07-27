<!--
	Dev-only frame-rate readout for the harness pages. Counts `requestAnimationFrame`
	callbacks — i.e. frames the main thread actually delivered, which is the number that
	drops when a map rasterises mid-gesture — and averages over a 500ms window so the
	figure is readable rather than flickering with every frame's jitter.

	Deliberately plain CSS: no glass, no backdrop-filter. A meter that participates in
	the pipeline it measures would cost frames itself, and a fixed translucent pill is
	legible over both schemes without knowing which one is active.
-->
<script lang="ts">
	let fps = $state(0);

	$effect(() => {
		let raf = 0;
		let frames = 0;
		let windowStart = performance.now();

		const tick = (now: number) => {
			frames += 1;
			const elapsed = now - windowStart;
			if (elapsed >= 500) {
				fps = Math.round((frames * 1000) / elapsed);
				frames = 0;
				windowStart = now;
			}
			raf = requestAnimationFrame(tick);
		};

		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="fps" aria-hidden="true">{fps} <span>fps</span></div>

<style>
	.fps {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 100;
		padding: 0.3rem 0.6rem;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.55);
		color: #f4f6fa;
		font-size: 0.75rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
		user-select: none;
	}

	.fps span {
		font-weight: 400;
		opacity: 0.6;
	}
</style>
