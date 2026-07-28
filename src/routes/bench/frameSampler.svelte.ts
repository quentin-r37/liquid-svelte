/**
 * Frame-time sampling for the `/bench` harness.
 *
 * `FpsMeter` answers "is it smooth right now". This answers "did adding a hundred
 * more glass surfaces cost anything", which needs numbers that can be put side by
 * side. Two things follow from that.
 *
 * Every frame's *duration* is kept rather than a count per window: a mean of 58 fps
 * hides a single 90ms hitch, and the hitch is what a viewer actually sees. A map
 * rasterising mid-gesture is precisely that shape of failure — one very long frame,
 * not a uniformly slower page — so the percentiles and the worst frame are the
 * figures this harness exists to report, and the mean is the least interesting of
 * the three.
 *
 * And a measurement is a *bounded run* that resolves to a summary, so a sweep can
 * step the instance count and tabulate the results without a human watching a
 * flickering readout and forming an impression.
 *
 * `requestAnimationFrame` deltas are the only frame timing a page can get. They
 * measure when the browser got round to running our callback — which is the number
 * that moves when the main thread is busy painting a displacement map, exactly the
 * regression this page is for. What they cannot see is GPU-side cost the compositor
 * absorbs without stalling the main thread, so a `full`-tier page can read a clean
 * 60 fps while the GPU is at its limit. That is a real blind spot and not a fixable
 * one from script: use the browser's own profiler when the question is GPU cost.
 */

/** Longer than two 60Hz vsyncs — the threshold at which a frame reads as a stutter. */
const JANK_MS = 33.4;

/** Frames kept for the live readout and the graph: ~2s at 60fps. */
export const TRACE_LENGTH = 120;

export interface FrameSummary {
	label: string;
	/** Frames observed during the run. */
	frames: number;
	/** Span the samples actually cover, in ms. */
	elapsed: number;
	/** Mean frame rate over the run — `frames / elapsed`. */
	fps: number;
	/** Median frame duration, ms. The typical frame. */
	p50: number;
	/** 95th-percentile frame duration, ms. The bad frames, minus the outlier. */
	p95: number;
	/** Longest single frame, ms. */
	worst: number;
	/** Frames over {@link JANK_MS}. */
	janky: number;
	/**
	 * The run hit its safety timeout instead of its frame budget — the tab was
	 * backgrounded, or rAF stopped for some other reason. Its numbers are not
	 * comparable with a clean run's.
	 */
	stalled: boolean;
}

function percentile(sorted: number[], q: number): number {
	if (sorted.length === 0) return 0;
	const index = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
	return sorted[index];
}

function summarise(label: string, samples: number[], stalled: boolean): FrameSummary {
	const elapsed = samples.reduce((total, dt) => total + dt, 0);
	const sorted = [...samples].sort((a, b) => a - b);

	return {
		label,
		frames: samples.length,
		elapsed,
		fps: elapsed > 0 ? (samples.length * 1000) / elapsed : 0,
		p50: percentile(sorted, 0.5),
		p95: percentile(sorted, 0.95),
		worst: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
		janky: samples.filter((dt) => dt > JANK_MS).length,
		stalled
	};
}

interface Capture {
	label: string;
	samples: number[];
	until: number;
	timeout: ReturnType<typeof setTimeout>;
	resolve: (summary: FrameSummary) => void;
}

export class FrameSampler {
	#last = 0;
	#capture: Capture | null = null;

	/**
	 * Rolling window, republished on a 200ms timer rather than on every frame.
	 * Writing `$state` sixty times a second to drive a readout would make the meter
	 * part of what it measures — the same reason `FpsMeter` averages rather than
	 * printing each frame.
	 */
	#trace: number[] = [];

	/** Last {@link TRACE_LENGTH} frame durations, oldest first. Drives the graph. */
	trace = $state.raw<number[]>([]);
	fps = $state(0);
	p95 = $state(0);
	worst = $state(0);
	janky = $state(0);
	/**
	 * Shortest frame in the window — in practice the display's vsync interval, since
	 * no frame can beat it and at least one usually hits it.
	 *
	 * Worth surfacing because it is what makes a frame-rate figure readable. Frames
	 * are delivered on vsync boundaries, so the cost of a change does not show up
	 * smoothly: work that crosses one boundary halves the frame rate, and work that
	 * doubles *within* a boundary shows up as nothing at all. On a 165Hz panel a
	 * page sitting at 82.5fps is a page missing every other vsync by any margin
	 * whatsoever — which is why p50 next to this number says more than fps does.
	 */
	fastest = $state(0);
	/** True while a {@link measure} run is collecting. */
	recording = $state(false);

	/** Start the rAF loop. Returns the teardown, so it belongs in an `$effect`. */
	start(): () => void {
		let raf = 0;

		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);

			// The first frame after a start (or after a stall) has no previous
			// timestamp to subtract, and the delta across a stall is meaningless.
			if (this.#last !== 0) {
				const dt = now - this.#last;
				this.#trace.push(dt);
				if (this.#trace.length > TRACE_LENGTH) this.#trace.shift();

				const capture = this.#capture;
				if (capture) {
					capture.samples.push(dt);
					if (now >= capture.until) this.#finish(false);
				}
			}

			this.#last = now;
		};

		raf = requestAnimationFrame(tick);
		const publish = setInterval(() => this.#publish(), 200);

		return () => {
			cancelAnimationFrame(raf);
			clearInterval(publish);
			this.#last = 0;
		};
	}

	/**
	 * Collect frames for `ms` and resolve with the summary.
	 *
	 * The safety timeout exists because rAF does not fire in a backgrounded tab: a
	 * sweep that awaited frames alone would hang the moment the user switched away,
	 * with no way to notice from script. It resolves at three times the requested
	 * span with `stalled: true` so the caller can carry on and label the row as
	 * untrustworthy rather than silently reporting 3 fps.
	 */
	measure(label: string, ms: number): Promise<FrameSummary> {
		this.cancel();

		return new Promise<FrameSummary>((resolve) => {
			this.recording = true;
			this.#capture = {
				label,
				samples: [],
				until: performance.now() + ms,
				timeout: setTimeout(() => this.#finish(true), ms * 3 + 2000),
				resolve
			};
		});
	}

	/** Abandon the run in flight, if any, resolving it with what it collected. */
	cancel(): void {
		if (this.#capture) this.#finish(true);
	}

	#finish(stalled: boolean): void {
		const capture = this.#capture;
		if (!capture) return;

		this.#capture = null;
		this.recording = false;
		clearTimeout(capture.timeout);
		capture.resolve(summarise(capture.label, capture.samples, stalled));
	}

	#publish(): void {
		const trace = this.#trace;
		if (trace.length === 0) return;

		// A fresh array each time: `trace` is `$state.raw`, so identity is the signal.
		this.trace = [...trace];

		const summary = summarise('live', trace, false);
		this.fps = summary.fps;
		this.p95 = summary.p95;
		this.worst = summary.worst;
		this.janky = summary.janky;
		this.fastest = Math.min(...trace);
	}
}

export { JANK_MS };
