<script lang="ts">
	/**
	 * Scaling harness: does the frame rate survive a page covered in glass?
	 *
	 * The claim this page exists to check is the one the architecture is built around
	 * — geometry regenerates textures, optics do not. A surface's displacement map is
	 * rasterised once per (size, radius, bezel, profile, resolution) and then cached,
	 * so a hundred identical surfaces share one PNG and a hundred *animated* surfaces
	 * rasterise nothing at all, because everything that moves is a live filter
	 * attribute. If that holds, instance count should cost compositing and very little
	 * main-thread time; if it ever stops holding, the frame graph spikes and the map
	 * counter climbs, in the same second.
	 *
	 * So the controls are arranged as an experiment rather than a gallery. The sweep
	 * steps the instance count through a ladder and tabulates a measured run at each
	 * step, which is the difference between "it feels fine" and a number you can put
	 * next to last week's. `unique geometry` and the `geometry` stress mode are the
	 * negative controls: both deliberately defeat the cache, and both are supposed to
	 * look bad here. A benchmark with no way to make the number go down cannot tell
	 * you the number means anything.
	 *
	 * What the figures cannot see: GPU-side cost the compositor absorbs without
	 * stalling the main thread. `full` tier can read a flat 60 fps with the GPU
	 * saturated — see `frameSampler.svelte.ts`. Cross-check a suspicious result in the
	 * browser's own profiler before believing it.
	 */
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		LiquidButton,
		LiquidGlass,
		LiquidSlider,
		LiquidSwitch,
		QUALITY_PRESETS,
		clearGlassMapCaches,
		getGlassMapStats,
		glassSupport,
		setGlassModeOverride,
		type GlassMapStats,
		type GlassMode,
		type GlassQuality,
		type GlassVariant
	} from '$lib/liquid-glass/index.js';
	import Backdrop, { BACKDROP_KINDS, type BackdropKind } from '../Backdrop.svelte';
	import FrameGraph from './FrameGraph.svelte';
	import { FrameSampler, type FrameSummary } from './frameSampler.svelte.js';

	type BenchKind = 'primitive' | 'button' | 'switch' | 'slider' | 'mixed';
	type BenchStress = 'idle' | 'optics' | 'geometry';

	let count = $state(48);
	let kind = $state<BenchKind>('primitive');
	let stress = $state<BenchStress>('idle');
	/**
	 * Give every tile its own size, so no two share a cache entry. With more variants
	 * than `MAP_CACHE_LIMIT` the LRU cannot hold the working set and the tiles at the
	 * end of the grid evict the ones at the start — the pathological case, and the
	 * reason components in this library take their sizes from a token ladder rather
	 * than from whatever the layout happens to produce.
	 */
	let uniqueGeometry = $state(false);
	let interactive = $state(true);
	let quality = $state<GlassQuality>('medium');
	let variant = $state<GlassVariant>('regular');
	let tierOverride = $state<GlassMode>('auto');
	let backdrop = $state<BackdropKind>('grid');
	let scheme = $state<'light' | 'dark'>('dark');

	$effect(() => {
		setGlassModeOverride(tierOverride);
	});

	// ------------------------------------------------------------ the field ---

	/** Distinct sizes handed out under `uniqueGeometry`. Deliberately over the LRU limit. */
	const GEOMETRY_VARIANTS = 40;
	/** Swing of the `geometry` stress mode, in CSS px — 40 quantum steps, also over it. */
	const GEOMETRY_SWING = 80;

	const TILE_HEIGHT = 76;
	const TILE_RADIUS = 22;
	const TILE_BEZEL = 14;

	const instances = $derived(Array.from({ length: count }, (_, index) => index));

	/** Stress modes drive primitive props, so they need primitives on the page. */
	const stressable = $derived(kind === 'primitive' || kind === 'mixed');
	const activeStress = $derived(stressable ? stress : 'idle');

	/**
	 * 0 → 1 → 0 on a ~1.8s cycle, written once per frame and read by every tile. One
	 * `$state` write fanning out to `count` components is itself part of what is being
	 * measured: if Svelte's update cost per surface were the problem, this is where it
	 * would show.
	 */
	let phase = $state(0);

	$effect(() => {
		if (activeStress === 'idle') {
			phase = 0;
			return;
		}

		let raf = 0;
		const step = (now: number) => {
			phase = 0.5 - 0.5 * Math.cos(now / 900);
			raf = requestAnimationFrame(step);
		};

		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	});

	/**
	 * Live filter attributes. None of these is part of a cache key, which is the point:
	 * animating them across every instance on the page should not rasterise anything.
	 */
	const displacement = $derived(
		activeStress === 'optics' ? TILE_BEZEL * 4 * (0.35 + 0.65 * phase) : undefined
	);
	const blur = $derived(activeStress === 'optics' ? 0.25 + 1.1 * phase : undefined);
	const specularIntensity = $derived(activeStress === 'optics' ? 0.2 + 0.6 * phase : 0.35);

	/** The counter-example: width *is* a cache key, so this rasterises as it moves. */
	const widthSwing = $derived(activeStress === 'geometry' ? Math.round(GEOMETRY_SWING * phase) : 0);

	function tileWidth(index: number): number {
		const base = uniqueGeometry ? 104 + (index % GEOMETRY_VARIANTS) * 4 : 132;
		return base + widthSwing;
	}

	function memberKind(index: number): Exclude<BenchKind, 'mixed'> {
		if (kind !== 'mixed') return kind;
		return (['primitive', 'button', 'switch', 'slider'] as const)[index % 4];
	}

	// ---------------------------------------------------- feature isolation ---

	/**
	 * `medium` is `low` plus two unrelated things — the specular `feImage` and the
	 * rim antialias — and a quality sweep prices them as one lump. These two toggles
	 * take them apart, which is the only way to know which primitive to go after.
	 *
	 * They patch the library's own preset table rather than going through props,
	 * because there are no props: `quality` is a bundle by design, and adding
	 * per-primitive flags to the public API to satisfy a dev harness would be the
	 * tail wagging the dog. So the harness reaches into `QUALITY_PRESETS`, and three
	 * things keep that honest — the patch can only ever *subtract* from the pristine
	 * table (a toggle cannot switch on what a preset does not have), the pristine
	 * values are restored when the page unmounts, and the field is wrapped in a
	 * `{#key}` so every surface remounts and re-reads the table.
	 *
	 * The patch is applied synchronously by the handler, never from an `$effect`:
	 * Svelte flushes render effects before user effects, so an effect would remount
	 * the tiles against the *old* table and measure the configuration you just left.
	 */
	const PRISTINE_PRESETS = structuredClone(QUALITY_PRESETS);

	let withSpecular = $state(true);
	let withRimAntialias = $state(true);

	const featureKey = $derived(`${withSpecular}-${withRimAntialias}`);
	const featureLabel = $derived(
		[withRimAntialias ? 'rim' : null, withSpecular ? 'spec' : null].filter(Boolean).join('+') || '—'
	);

	function applyFeatures(): void {
		for (const [name, preset] of Object.entries(PRISTINE_PRESETS)) {
			const live = QUALITY_PRESETS[name as GlassQuality];
			live.specular = preset.specular && withSpecular;
			live.rimAntialias = preset.rimAntialias && withRimAntialias;
		}
	}

	function setFeatures(specular: boolean, rim: boolean): void {
		withSpecular = specular;
		withRimAntialias = rim;
		applyFeatures();
	}

	$effect(() => () => {
		withSpecular = true;
		withRimAntialias = true;
		applyFeatures();
	});

	// ------------------------------------------------------------ measuring ---

	const sampler = new FrameSampler();
	$effect(() => sampler.start());

	let mapStats = $state<GlassMapStats>({ generations: 0, hits: 0, cacheSize: 0 });

	$effect(() => {
		const id = setInterval(() => {
			mapStats = getGlassMapStats();
		}, 200);
		return () => clearInterval(id);
	});

	interface BenchRow extends FrameSummary {
		count: number;
		kind: BenchKind;
		stress: BenchStress;
		quality: GlassQuality;
		tier: string;
		/** Which of the preset's optional passes were in the chain. */
		features: string;
		unique: boolean;
		/** Maps rasterised *during* the run — the number that must stay at 0. */
		generations: number;
	}

	/** Ladder for the sweep. Doubling past the point where a real page would stop. */
	const SWEEP_COUNTS = [1, 8, 32, 64, 128];
	/**
	 * The other two axes, and the reason the page has a table rather than a readout.
	 *
	 * A slow frame rate at a high instance count says nothing on its own about
	 * *whose* cost it is. `full` runs a nine-primitive SVG graph per surface,
	 * `degraded` one CSS blur, `flat` nothing — so holding the count still and
	 * stepping the tier splits the library's filter chain from the browser's
	 * `backdrop-filter`, which no amount of tuning in here can make cheaper. If
	 * `degraded` sits at the same figure as `full`, the chain is not the problem and
	 * the answer is fewer glass surfaces, not a shorter filter.
	 */
	const SWEEP_TIERS: GlassMode[] = ['full', 'degraded', 'flat'];
	const SWEEP_QUALITIES: GlassQuality[] = ['low', 'medium', 'high'];
	/** Mount, layout, first paint and any initial rasterisation happen in here, unmeasured. */
	const WARMUP_MS = 800;
	const RUN_MS = 2500;

	let results = $state<BenchRow[]>([]);
	let busy = $state(false);
	let progress = $state('');
	let cancelled = false;

	const best = $derived(results.reduce((top, row) => Math.max(top, row.fps), 0));

	const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

	async function capture(instanceCount: number) {
		progress = `${instanceCount} instances — settling`;
		await tick();
		await pause(WARMUP_MS);
		if (cancelled) return;

		progress = `${instanceCount} instances — measuring`;
		const before = getGlassMapStats().generations;
		const summary = await sampler.measure(`${instanceCount}`, RUN_MS);
		const after = getGlassMapStats().generations;

		results = [
			...results,
			{
				...summary,
				count: instanceCount,
				kind,
				stress: activeStress,
				quality,
				tier: glassSupport.tier,
				features: featureLabel,
				unique: uniqueGeometry,
				generations: after - before
			}
		];
	}

	async function runOnce() {
		busy = true;
		cancelled = false;
		await capture(count);
		busy = false;
		progress = '';
	}

	async function runSweep() {
		busy = true;
		cancelled = false;
		const restore = count;

		for (const step of SWEEP_COUNTS) {
			if (cancelled) break;
			count = step;
			await capture(step);
		}

		count = restore;
		busy = false;
		progress = '';
	}

	/** Same count, same components, one tier at a time. See {@link SWEEP_TIERS}. */
	async function runTierSweep() {
		busy = true;
		cancelled = false;
		const restore = tierOverride;

		for (const step of SWEEP_TIERS) {
			if (cancelled) break;
			tierOverride = step;
			await capture(count);
		}

		tierOverride = restore;
		busy = false;
		progress = '';
	}

	/**
	 * The four combinations of the two optional passes, at whatever quality is
	 * selected. `low` has neither, so run this at `medium` or `high`.
	 */
	async function runFeatureSweep() {
		busy = true;
		cancelled = false;
		const restore: [boolean, boolean] = [withSpecular, withRimAntialias];

		for (const [specular, rim] of [
			[false, false],
			[false, true],
			[true, false],
			[true, true]
		] as const) {
			if (cancelled) break;
			setFeatures(specular, rim);
			await capture(count);
		}

		setFeatures(...restore);
		busy = false;
		progress = '';
	}

	async function runQualitySweep() {
		busy = true;
		cancelled = false;
		const restore = quality;

		for (const step of SWEEP_QUALITIES) {
			if (cancelled) break;
			quality = step;
			await capture(count);
		}

		quality = restore;
		busy = false;
		progress = '';
	}

	function stop() {
		cancelled = true;
		sampler.cancel();
	}

	const fmt = (value: number, digits = 1) => value.toFixed(digits);
</script>

<svelte:head>
	<title>liquid-svelte — scaling benchmark</title>
</svelte:head>

<Backdrop kind={backdrop} {scheme} fixed />

<div class="bench" data-scheme={scheme}>
	<div class="stage">
		<!--
			Remounts every surface when a feature toggle flips: the preset table is a
			plain object, so mutating it invalidates nothing on its own. See
			`applyFeatures`.
		-->
		{#key featureKey}
			<div class="field">
				{#each instances as index (index)}
					{@const member = memberKind(index)}
					{#if member === 'primitive'}
						<LiquidGlass
							width={tileWidth(index)}
							height={TILE_HEIGHT}
							borderRadius={TILE_RADIUS}
							bezel={TILE_BEZEL}
							{displacement}
							{blur}
							{specularIntensity}
							{quality}
							{variant}
							{interactive}
						>
							<span class="tile-label">{index + 1}</span>
						</LiquidGlass>
					{:else if member === 'button'}
						<LiquidButton {quality} {variant}>Surface {index + 1}</LiquidButton>
					{:else if member === 'switch'}
						<LiquidSwitch checked={index % 2 === 0} {quality} label="Instance {index + 1}" />
					{:else}
						<div class="slider-slot">
							<LiquidSlider value={(index * 7) % 100} {quality} label="Instance {index + 1}" />
						</div>
					{/if}
				{/each}
			</div>
		{/key}

		{#if count === 0}
			<p class="empty">No instances — this is the baseline the backdrop alone costs.</p>
		{/if}
	</div>

	<aside class="panel">
		<header>
			<h1>Scaling benchmark</h1>
			<p>
				Frame timing against instance count. <strong>maps</strong> is the library's own claim — it should
				stay at 0 while the count climbs, since identical surfaces share one rasterised map and everything
				animated is a live filter attribute.
			</p>
			<p>
				If the count sweep does collapse, sweep the <strong>tier</strong> next: it is the only way
				to tell a filter chain that is too long from
				<code>backdrop-filter</code> simply costing what it costs, and only the first is something
				this library can fix. Then try <strong>backdrop: solid</strong> — a still backdrop means nothing
				forces a re-filter, so what is left is the price of the surfaces merely existing.
			</p>
		</header>

		<section class="live">
			<FrameGraph {sampler} />
			<dl class="metrics">
				<div>
					<dt>fps</dt>
					<dd class="big">{fmt(sampler.fps)}</dd>
				</div>
				<div>
					<dt>p95</dt>
					<dd>{fmt(sampler.p95)} ms</dd>
				</div>
				<div>
					<dt>worst</dt>
					<dd>{fmt(sampler.worst)} ms</dd>
				</div>
				<div>
					<dt>janky</dt>
					<dd>{sampler.janky}</dd>
				</div>
			</dl>
			<p class="cache">
				maps: <strong>{mapStats.generations}</strong> generated ·
				<strong>{mapStats.hits}</strong>
				hits · <strong>{mapStats.cacheSize}</strong> cached
				<button type="button" class="link" onclick={clearGlassMapCaches} disabled={busy}>
					clear
				</button>
			</p>
		</section>

		<section class="controls">
			<label class="count">
				<span>instances — {count}</span>
				<input type="range" min="0" max="200" step="1" bind:value={count} disabled={busy} />
			</label>
			<div class="presets">
				{#each [1, 16, 48, 96, 160] as preset (preset)}
					<button type="button" onclick={() => (count = preset)} disabled={busy}>{preset}</button>
				{/each}
			</div>

			<label>
				<span>component</span>
				<select bind:value={kind} disabled={busy}>
					<option value="primitive">primitive — LiquidGlass tiles</option>
					<option value="button">button — hover/press wiring</option>
					<option value="switch">switch — droplet morph</option>
					<option value="slider">slider — droplet + range input</option>
					<option value="mixed">mixed — one of each, round-robin</option>
				</select>
			</label>

			<label>
				<span>stress</span>
				<select bind:value={stress} disabled={busy || !stressable}>
					<option value="idle">idle — static surfaces</option>
					<option value="optics">optics — animate live filter attributes</option>
					<option value="geometry">geometry — animate width (rasterises)</option>
				</select>
			</label>

			<label class="check">
				<input
					type="checkbox"
					checked={withRimAntialias}
					disabled={busy}
					onchange={(event) => setFeatures(withSpecular, event.currentTarget.checked)}
				/>
				<span>rim antialias — 4 primitives + the output pad</span>
			</label>
			<label class="check">
				<input
					type="checkbox"
					checked={withSpecular}
					disabled={busy}
					onchange={(event) => setFeatures(event.currentTarget.checked, withRimAntialias)}
				/>
				<span>specular rim — a second feImage, blended</span>
			</label>

			<label class="check">
				<input type="checkbox" bind:checked={uniqueGeometry} disabled={busy} />
				<span>unique geometry per tile — defeats the map cache</span>
			</label>
			<label class="check">
				<input type="checkbox" bind:checked={interactive} disabled={busy} />
				<span>interactive — per-instance pointer tracking</span>
			</label>

			<label>
				<span>quality</span>
				<select bind:value={quality} disabled={busy}>
					<option value="low">low — 0.5× map, 1 pass</option>
					<option value="medium">medium — 0.75× map, 1 pass</option>
					<option value="high">high — 1× map, 3 passes</option>
				</select>
			</label>
			<label>
				<span>tier</span>
				<select bind:value={tierOverride} disabled={busy}>
					<option value="auto">auto — {glassSupport.detected ?? 'detecting'}</option>
					<option value="full">full</option>
					<option value="degraded">degraded</option>
					<option value="flat">flat</option>
				</select>
			</label>
			<label>
				<span>variant</span>
				<select bind:value={variant} disabled={busy}>
					<option value="regular">regular</option>
					<option value="clear">clear</option>
				</select>
			</label>
			<label>
				<span>backdrop</span>
				<select bind:value={backdrop} disabled={busy}>
					{#each BACKDROP_KINDS as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>scheme</span>
				<select bind:value={scheme} disabled={busy}>
					<option value="dark">dark</option>
					<option value="light">light</option>
				</select>
			</label>
		</section>

		<section class="run">
			<div class="buttons">
				<button type="button" onclick={runSweep} disabled={busy}>
					Sweep count {SWEEP_COUNTS.join(' → ')}
				</button>
				<button type="button" onclick={runTierSweep} disabled={busy}>
					Sweep tier at {count}
				</button>
				<button type="button" onclick={runQualitySweep} disabled={busy}>
					Sweep quality at {count}
				</button>
				<button type="button" onclick={runFeatureSweep} disabled={busy}>
					Sweep passes at {quality}
				</button>
				<button type="button" onclick={runOnce} disabled={busy}>Measure current</button>
				<button type="button" onclick={stop} disabled={!busy}>Stop</button>
				<button type="button" onclick={() => (results = [])} disabled={busy || !results.length}>
					Clear table
				</button>
			</div>
			<p class="status">
				{#if busy}
					{progress} · {RUN_MS / 1000}s run after a {WARMUP_MS / 1000}s settle
				{:else}
					Keep the tab focused — <code>requestAnimationFrame</code> stops in a background tab, and a run
					that stalls is marked as such rather than reported as slow.
				{/if}
			</p>

			{#if results.length}
				<table>
					<thead>
						<tr>
							<th>n</th>
							<th>tier</th>
							<th>q</th>
							<th>passes</th>
							<th>fps</th>
							<th>held</th>
							<th>p95</th>
							<th>worst</th>
							<th>janky</th>
							<th>maps</th>
						</tr>
					</thead>
					<tbody>
						{#each results as row, index (index)}
							<tr class:stalled={row.stalled}>
								<td>{row.count}</td>
								<td>{row.tier}</td>
								<td>{row.quality.slice(0, 3)}</td>
								<td>{row.features}</td>
								<td>{fmt(row.fps)}</td>
								<td class:down={best > 0 && row.fps < best * 0.9}>
									{best > 0 ? Math.round((row.fps / best) * 100) : 0}%
								</td>
								<td>{fmt(row.p95)}</td>
								<td>{fmt(row.worst)}</td>
								<td class:down={row.janky > 0}>{row.janky}</td>
								<td class:down={row.generations > 0}>{row.generations}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="legend">
					<strong>held</strong> is the row's frame rate as a share of the best row in the table —
					the column that answers whether the count is what costs you.
					<strong>maps</strong>
					counts rasterisations during the run: anything above zero at a steady instance count means something
					animated crossed into a cache key.
					{#if results.some((row) => row.stalled)}
						Rows in red stalled — the tab lost focus mid-run; discard and repeat them.
					{/if}
				</p>
			{/if}
		</section>

		<footer>
			<p>
				Tiers differ by more than looks: <strong>full</strong> pays for an SVG filter graph per
				surface, <strong>degraded</strong> for a plain blur, <strong>flat</strong> for nothing at
				all. Sweeping the same count across all three separates the library's cost from the
				browser's
				<code>backdrop-filter</code>.
			</p>
			<p>
				<a href={resolve('/demo')}>gallery</a> · <a href={resolve('/probe')}>optics probe</a>
			</p>
		</footer>
	</aside>
</div>

<style>
	.bench {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 24rem;
		min-height: 100vh;
		color: #f4f6fa;
		font-family:
			'Inter Variable',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}

	.bench[data-scheme='light'] {
		color: #0c0e16;
	}

	/*
	 * Nothing on the path from here to a glass surface may carry `filter`, `opacity`,
	 * `mask`, `clip-path` or a transform: any of them makes this box a backdrop root
	 * (or, in Chromium, a transformed ancestor) and every tile below would quietly
	 * stop refracting — turning a scaling benchmark into a measurement of a page that
	 * is no longer doing the work.
	 */
	.stage {
		position: relative;
		max-height: 100vh;
		overflow-y: auto;
		padding: 1.25rem;
	}

	.field {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		align-items: center;
	}

	.slider-slot {
		width: 220px;
	}

	.tile-label {
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		opacity: 0.65;
	}

	.empty {
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.6;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-height: 100vh;
		overflow-y: auto;
		padding: 1.25rem;
		background: rgb(8 9 15 / 0.86);
		border-left: 1px solid rgb(255 255 255 / 0.12);
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.bench[data-scheme='light'] .panel {
		background: rgb(250 250 248 / 0.9);
		border-left-color: rgb(0 0 0 / 0.12);
	}

	h1 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	header p,
	.legend,
	.status,
	footer p {
		margin: 0;
		font-size: 0.72rem;
		opacity: 0.72;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.4rem;
		margin: 0.6rem 0 0.4rem;
	}

	.metrics dt {
		font-size: 0.62rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		opacity: 0.55;
	}

	.metrics dd {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.metrics dd.big {
		font-size: 1.2rem;
	}

	.cache {
		margin: 0;
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.75;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.controls label > span {
		font-size: 0.62rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		opacity: 0.6;
	}

	.controls label.check {
		flex-direction: row;
		align-items: center;
		gap: 0.45rem;
	}

	.controls label.check > span {
		letter-spacing: 0;
		text-transform: none;
		font-size: 0.72rem;
	}

	.count input {
		width: 100%;
	}

	.presets {
		display: flex;
		gap: 0.35rem;
	}

	select,
	button {
		padding: 0.3rem 0.5rem;
		border: 1px solid rgb(128 128 128 / 0.35);
		border-radius: 7px;
		background: rgb(0 0 0 / 0.35);
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
	}

	.bench[data-scheme='light'] select,
	.bench[data-scheme='light'] button {
		background: rgb(255 255 255 / 0.65);
	}

	button {
		cursor: pointer;
	}

	button:disabled {
		cursor: default;
		opacity: 0.45;
	}

	.presets button {
		flex: 1;
		padding: 0.25rem 0;
		font-variant-numeric: tabular-nums;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.run {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
	}

	th,
	td {
		padding: 0.2rem 0.15rem;
		text-align: right;
	}

	th {
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.55;
		border-bottom: 1px solid rgb(128 128 128 / 0.3);
	}

	th:first-child,
	td:first-child {
		text-align: left;
	}

	tbody tr:nth-child(even) {
		background: rgb(128 128 128 / 0.1);
	}

	td.down {
		color: #ff6b57;
		font-weight: 700;
	}

	tr.stalled td {
		color: #ff6b57;
		text-decoration: line-through;
	}

	code {
		padding: 0.05em 0.3em;
		border-radius: 4px;
		background: rgb(128 128 128 / 0.22);
		font-size: 0.9em;
	}

	a {
		color: inherit;
		text-underline-offset: 3px;
	}

	@media (max-width: 60rem) {
		.bench {
			grid-template-columns: 1fr;
		}

		.stage,
		.panel {
			max-height: none;
		}
	}
</style>
