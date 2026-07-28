<!--
	Rolling frame-time graph for the bench panel.

	One bar per frame, height = duration, so a stutter is a spike rather than a dip in
	an average — which is the whole reason the sampler keeps durations instead of a
	count. The two rules are the 60Hz and 30Hz budgets: bars under the first line are
	frames nobody can see, bars over the second are frames everybody can.

	Canvas rather than DOM, and redrawn from `sampler.trace` — which republishes at
	5Hz, not per frame. A hundred and twenty `<div>`s restyled sixty times a second
	would cost more main-thread time than most of what this page is measuring.
-->
<script lang="ts">
	import { JANK_MS, TRACE_LENGTH, type FrameSampler } from './frameSampler.svelte.js';

	let { sampler }: { sampler: FrameSampler } = $props();

	/** Bars are clipped here, so one 400ms frame cannot flatten the rest of the graph. */
	const CEILING_MS = 50;
	const VSYNC_MS = 1000 / 60;

	let canvas = $state<HTMLCanvasElement | null>(null);

	$effect(() => {
		const trace = sampler.trace;
		const element = canvas;
		if (!element) return;

		const context = element.getContext('2d');
		if (!context) return;

		// Sized against the backing store each draw: cheap, and it keeps the graph
		// crisp across a zoom change or a panel resize without a second observer.
		const ratio = window.devicePixelRatio || 1;
		const width = element.clientWidth;
		const height = element.clientHeight;
		if (element.width !== Math.round(width * ratio)) element.width = Math.round(width * ratio);
		if (element.height !== Math.round(height * ratio)) element.height = Math.round(height * ratio);

		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.clearRect(0, 0, width, height);

		const y = (ms: number) => height - (Math.min(ms, CEILING_MS) / CEILING_MS) * height;

		for (const [ms, colour] of [
			[VSYNC_MS, 'rgb(255 255 255 / 0.22)'],
			[JANK_MS, 'rgb(255 138 128 / 0.35)']
		] as const) {
			context.fillStyle = colour;
			context.fillRect(0, y(ms), width, 1);
		}

		const slot = width / TRACE_LENGTH;
		const barWidth = Math.max(1, slot - 0.5);

		for (let i = 0; i < trace.length; i += 1) {
			const ms = trace[i];
			context.fillStyle = ms > JANK_MS ? '#ff6b57' : ms > VSYNC_MS * 1.25 ? '#f3b14c' : '#61d29a';
			const top = y(ms);
			context.fillRect(i * slot, top, barWidth, height - top);
		}
	});
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 52px;
		border-radius: 6px;
		background: rgb(0 0 0 / 0.35);
	}
</style>
