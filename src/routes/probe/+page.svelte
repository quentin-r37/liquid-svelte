<script lang="ts">
	import {
		DISPLACEMENT_PER_BEZEL,
		LiquidGlass,
		getGlassMapStats,
		glassSupport,
		reducedMotion,
		setGlassModeOverride,
		type CornerShape,
		type GlassMapStats,
		type GlassMode,
		type GlassQuality,
		type SurfaceProfile
	} from '$lib/liquid-glass/index.js';
	import Backdrop, { BACKDROP_KINDS, type BackdropKind } from '../Backdrop.svelte';

	/**
	 * Validation harness for the LiquidGlass primitive (steps 1–3).
	 *
	 * Everything here is throwaway debug UI: native range inputs and selects, no
	 * glass controls. The specialised components come later, and using them here
	 * would make the harness depend on what it is supposed to be validating.
	 */

	let width = $state(360);
	let height = $state(220);
	let borderRadius = $state(70);
	let bezel = $state(30);
	/** `null` exercises the auto default (`bezel × DISPLACEMENT_PER_BEZEL`). */
	let displacementOverride = $state<number | null>(null);
	let blur = $state(0.5);
	let opacity = $state(0.05);
	let saturation = $state(1.3);
	let chromaticAberration = $state(0.04);
	let specularIntensity = $state(0.35);
	let shadowIntensity = $state(0.6);
	let profile = $state<SurfaceProfile>('convex-squircle');
	let cornerShape = $state<CornerShape>('round');
	let quality = $state<GlassQuality>('high');
	let modeOverride = $state<GlassMode>('auto');
	let scheme = $state<'light' | 'dark'>('dark');
	let backdrop = $state<BackdropKind>('grid');
	let autoSize = $state(false);

	const autoDisplacement = $derived(bezel * DISPLACEMENT_PER_BEZEL);
	const displacement = $derived(displacementOverride ?? autoDisplacement);

	$effect(() => {
		setGlassModeOverride(modeOverride);
	});

	// -------------------------------------------------------------- drag ---

	let dragX = $state(0);
	let dragY = $state(0);
	let dragging = $state(false);

	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let originX = 0;
	let originY = 0;

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		pointerId = event.pointerId;
		// Pointer capture keeps the drag alive when the pointer leaves the element —
		// which happens constantly, since the element is what moves.
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		startX = event.clientX;
		startY = event.clientY;
		originX = dragX;
		originY = dragY;
		dragging = true;
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging || event.pointerId !== pointerId) return;
		dragX = originX + (event.clientX - startX);
		dragY = originY + (event.clientY - startY);
	}

	function endDrag(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		dragging = false;
		pointerId = null;
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !dragging) return;
		dragX = originX;
		dragY = originY;
		dragging = false;
		pointerId = null;
	}

	// ------------------------------------------------------------- stats ---

	let stats = $state<GlassMapStats>({ generations: 0, hits: 0, cacheSize: 0 });

	$effect(() => {
		// Polled rather than pushed: the point is to watch the counters *not* move
		// while dragging, and a 200 ms tick is plenty to see that.
		const id = setInterval(() => {
			stats = getGlassMapStats();
		}, 200);
		return () => clearInterval(id);
	});

	const gallery = [
		{ label: 'pill', width: 132, height: 48, borderRadius: 24, bezel: 12 },
		{ label: 'chip', width: 96, height: 96, borderRadius: 48, bezel: 24 },
		{ label: 'card', width: 176, height: 104, borderRadius: 28, bezel: 18 },
		{ label: 'tile', width: 88, height: 88, borderRadius: 14, bezel: 10 },
		{ label: 'bar', width: 208, height: 40, borderRadius: 20, bezel: 10 },
		{ label: 'lens', width: 112, height: 112, borderRadius: 56, bezel: 34 }
	];
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="probe" data-scheme={scheme}>
	<div class="stage">
		<Backdrop kind={backdrop} {scheme} />

		<div
			class="drag-wrap"
			class:dragging
			style:transform={`translate3d(${dragX}px, ${dragY}px, 0)`}
		>
			<LiquidGlass
				width={autoSize ? undefined : width}
				height={autoSize ? undefined : height}
				{borderRadius}
				{cornerShape}
				{bezel}
				{displacement}
				{blur}
				{opacity}
				{saturation}
				{chromaticAberration}
				{specularIntensity}
				{shadowIntensity}
				{profile}
				{quality}
				interactive
				class="hero"
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={endDrag}
				onpointercancel={endDrag}
			>
				<div class="hero-body">
					<strong>Liquid Glass</strong>
					<span>drag me over the type · Esc cancels</span>
				</div>
			</LiquidGlass>
		</div>

		<div class="gallery">
			{#each gallery as item (item.label)}
				<LiquidGlass
					width={item.width}
					height={item.height}
					borderRadius={item.borderRadius}
					{cornerShape}
					bezel={item.bezel}
					displacement={displacementOverride ?? undefined}
					{blur}
					{opacity}
					{saturation}
					{chromaticAberration}
					{specularIntensity}
					{shadowIntensity}
					{profile}
					{quality}
					interactive
				>
					<span class="gallery-label">{item.label}</span>
				</LiquidGlass>
			{/each}
		</div>
	</div>

	<aside class="panel">
		<h1>LiquidGlass probe</h1>

		<dl class="readout">
			<dt>rendered tier</dt>
			<dd>{glassSupport.tier}</dd>
			<dt>detected</dt>
			<dd>{glassSupport.detected ?? '…'}</dd>
			<dt>corner-shape</dt>
			<dd>{glassSupport.cornerShape ? 'supported' : 'unsupported → round'}</dd>
			<dt>reduced motion</dt>
			<dd>{reducedMotion.current ? 'yes' : 'no'}</dd>
			<dt>glass instances</dt>
			<dd>{gallery.length + 1}</dd>
			<dt>map generations</dt>
			<dd class="metric">{stats.generations}</dd>
			<dt>cache hits</dt>
			<dd class="metric">{stats.hits}</dd>
			<dt>cache entries</dt>
			<dd class="metric">{stats.cacheSize}</dd>
		</dl>

		<p class="hint">
			Drag the card and watch <em>map generations</em>: it must stay flat. It only ticks when the
			quantised geometry, the profile or the quality changes — never for displacement, blur,
			saturation, aberration or specular, which are live filter attributes.
		</p>
		<p class="hint">
			Two counter-intuitive defaults, both matching the reference effect: displacement is ~4× the
			bezel (a 30px bezel wants ~120px), and blur is 0.5px. Liquid glass is <em>clear</em> — frosting
			it hides the refraction that does all the work.
		</p>

		<fieldset>
			<legend>tier &amp; scheme</legend>

			<label>
				<span>mode</span>
				<select bind:value={modeOverride}>
					<option value="auto">auto (detect)</option>
					<option value="full">full</option>
					<option value="degraded">degraded</option>
					<option value="flat">flat</option>
				</select>
			</label>

			<label>
				<span>quality</span>
				<select bind:value={quality}>
					<option value="low">low — 0.5× map, 1 pass</option>
					<option value="medium">medium — 0.75× map, 1 pass</option>
					<option value="high">high — 1× map, 3 passes</option>
				</select>
			</label>

			<label>
				<span>profile</span>
				<select bind:value={profile}>
					<option value="convex-squircle">convex squircle</option>
					<option value="convex-circle">convex circle</option>
					<option value="concave">concave</option>
					<option value="lip">lip</option>
				</select>
			</label>

			<label>
				<span>corner</span>
				<select bind:value={cornerShape}>
					<option value="round">round — border-radius</option>
					<option value="squircle">squircle — superellipse(2)</option>
					<option value={3}>superellipse(3)</option>
					<option value={6}>superellipse(6)</option>
				</select>
			</label>

			<label>
				<span>backdrop</span>
				<select bind:value={backdrop}>
					{#each BACKDROP_KINDS as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>

			<label>
				<span>scheme</span>
				<select bind:value={scheme}>
					<option value="dark">dark</option>
					<option value="light">light</option>
				</select>
			</label>

			<label class="check">
				<input type="checkbox" bind:checked={autoSize} />
				<span>auto size (ResizeObserver)</span>
			</label>
		</fieldset>

		<fieldset>
			<legend>geometry</legend>

			<label>
				<span>width <output>{autoSize ? 'auto' : `${width}px`}</output></span>
				<input type="range" min="80" max="600" step="1" bind:value={width} disabled={autoSize} />
			</label>
			<label>
				<span>height <output>{autoSize ? 'auto' : `${height}px`}</output></span>
				<input type="range" min="48" max="420" step="1" bind:value={height} disabled={autoSize} />
			</label>
			<label>
				<span>borderRadius <output>{borderRadius}px</output></span>
				<input type="range" min="0" max="200" step="1" bind:value={borderRadius} />
			</label>
			<label>
				<span>bezel <output>{bezel}px</output></span>
				<input type="range" min="2" max="80" step="1" bind:value={bezel} />
			</label>
			<label>
				<span>opacity (tint) <output>{opacity.toFixed(3)}</output></span>
				<input type="range" min="0" max="0.3" step="0.005" bind:value={opacity} />
			</label>
		</fieldset>

		<fieldset>
			<legend>optics</legend>

			<label class="check">
				<input
					type="checkbox"
					checked={displacementOverride === null}
					onchange={(event) => {
						displacementOverride = event.currentTarget.checked ? null : autoDisplacement;
					}}
				/>
				<span>auto displacement (bezel × {DISPLACEMENT_PER_BEZEL})</span>
			</label>
			<label>
				<span>
					displacement <output>{Math.round(displacement)}px</output>
				</span>
				<input
					type="range"
					min="0"
					max="240"
					step="1"
					value={displacement}
					disabled={displacementOverride === null}
					oninput={(event) => (displacementOverride = event.currentTarget.valueAsNumber)}
				/>
			</label>
			<label>
				<span>
					blur <output>{blur}px</output>
					{#if blur > 1.5}<em class="warn">frosted, kills refraction</em>{/if}
				</span>
				<input type="range" min="0" max="8" step="0.1" bind:value={blur} />
			</label>
			<label>
				<span>saturation <output>{saturation.toFixed(2)}</output></span>
				<input type="range" min="0.5" max="3" step="0.05" bind:value={saturation} />
			</label>
			<label>
				<span>
					chromaticAberration <output>{chromaticAberration.toFixed(3)}</output>
					{#if quality !== 'high'}<em class="warn">needs quality: high</em>{/if}
				</span>
				<input type="range" min="0" max="0.2" step="0.005" bind:value={chromaticAberration} />
			</label>
		</fieldset>

		<fieldset>
			<legend>surface</legend>

			<label>
				<span>specularIntensity <output>{specularIntensity.toFixed(2)}</output></span>
				<input type="range" min="0" max="1" step="0.02" bind:value={specularIntensity} />
			</label>
			<label>
				<span>shadowIntensity <output>{shadowIntensity.toFixed(2)}</output></span>
				<input type="range" min="0" max="1" step="0.02" bind:value={shadowIntensity} />
			</label>
		</fieldset>
	</aside>
</div>

<style>
	.probe {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		min-height: 100vh;
		background: #05060c;
		color: #f2f4f8;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}

	.stage {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
	}

	/*
	 * The drag wrapper is transformed, not the glass itself. That is on purpose:
	 * it verifies that an ancestor `transform` does not create a backdrop root and
	 * therefore does not break `backdrop-filter` on a descendant.
	 */
	.drag-wrap {
		position: absolute;
		top: 12%;
		left: 8%;
		touch-action: none;
	}

	.drag-wrap.dragging {
		will-change: transform;
	}

	.probe :global(.hero) {
		cursor: grab;
		/* Padding matters when `auto size` is on: it is what gives the surface a
		   measurable box for the ResizeObserver to report. */
		padding: 1.5rem 1.75rem;
	}

	.drag-wrap.dragging :global(.hero) {
		cursor: grabbing;
	}

	.hero-body {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		align-items: center;
		text-align: center;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
	}

	.hero-body strong {
		font-size: 1.4rem;
		letter-spacing: -0.01em;
	}

	.hero-body span {
		font-size: 0.78rem;
		opacity: 0.8;
	}

	.gallery {
		position: absolute;
		inset: auto 2rem 2rem 2rem;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
	}

	.gallery-label {
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		overflow-y: auto;
		max-height: 100vh;
		background: #0b0d14;
		border-left: 1px solid rgb(255 255 255 / 0.08);
		font-size: 0.8rem;
	}

	h1 {
		margin: 0;
		font-size: 0.95rem;
		letter-spacing: 0.02em;
	}

	.readout {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.15rem 0.75rem;
		margin: 0;
		padding: 0.65rem 0.75rem;
		border-radius: 10px;
		background: rgb(255 255 255 / 0.04);
		font-size: 0.74rem;
	}

	.readout dt {
		opacity: 0.6;
	}

	.readout dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.readout dd.metric {
		font-family: ui-monospace, Menlo, Consolas, monospace;
		color: #7ce7ff;
	}

	.hint {
		margin: 0;
		font-size: 0.72rem;
		line-height: 1.5;
		opacity: 0.65;
	}

	fieldset {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin: 0;
		padding: 0.75rem;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 10px;
	}

	legend {
		padding: 0 0.35rem;
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.55;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	label.check {
		flex-direction: row;
		align-items: center;
		gap: 0.45rem;
	}

	label > span {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.72rem;
		opacity: 0.85;
	}

	output {
		font-family: ui-monospace, Menlo, Consolas, monospace;
		font-size: 0.7rem;
		opacity: 0.7;
	}

	.warn {
		color: #ffb347;
		font-style: normal;
		font-size: 0.65rem;
	}

	input[type='range'] {
		width: 100%;
		accent-color: #7ce7ff;
	}

	input[type='range']:disabled {
		opacity: 0.35;
	}

	select {
		padding: 0.3rem 0.4rem;
		border: 1px solid rgb(255 255 255 / 0.14);
		border-radius: 7px;
		background: #12151f;
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
	}

	@media (max-width: 900px) {
		.probe {
			grid-template-columns: minmax(0, 1fr);
		}

		.stage {
			min-height: 70vh;
		}

		.panel {
			max-height: none;
			border-left: 0;
			border-top: 1px solid rgb(255 255 255 / 0.08);
		}
	}
</style>
