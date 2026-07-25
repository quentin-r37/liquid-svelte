<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		LiquidButton,
		LiquidGlass,
		LiquidLens,
		LiquidSlider,
		LiquidSwitch,
		LiquidTabs,
		glassSupport,
		reducedMotion,
		setGlassModeOverride,
		type GlassMode,
		type LiquidTab
	} from '$lib/liquid-glass/index.js';
	import DemoBackdrop from './DemoBackdrop.svelte';

	let scheme = $state<'light' | 'dark'>('dark');
	let tierOverride = $state<GlassMode>('auto');

	$effect(() => {
		setGlassModeOverride(tierOverride);
	});

	// Component state for the examples.
	let notifications = $state(true);
	let telemetry = $state(false);
	let volume = $state(64);
	let temperature = $state(21.5);
	let pressed = $state(0);

	const tabs: LiquidTab[] = [
		{ id: 'optics', label: 'Optics' },
		{ id: 'motion', label: 'Motion' },
		{ id: 'a11y', label: 'Access' },
		{ id: 'legacy', label: 'Legacy', disabled: true }
	];
	let activeTab = $state('optics');

	const tabCopy: Record<string, string> = {
		optics:
			'A displacement map encodes the refraction vector per pixel — X in red, Y in green, 128 neutral. The bezel carries almost all of it; the centre stays flat.',
		motion:
			'Every movement runs through Motion springs on a shared transform, so hover, press and drag compose instead of overwriting each other.',
		a11y: 'Native button, role="switch", a real range input and the ARIA tabs pattern — all operable from the keyboard alone.',
		legacy: ''
	};

	let lensStage = $state<HTMLElement | null>(null);
</script>

<svelte:head>
	<title>liquid-svelte — component gallery</title>
</svelte:head>

<DemoBackdrop {scheme} />

<div class="page" data-scheme={scheme}>
	<header>
		<div class="titles">
			<h1>liquid-svelte</h1>
			<p>
				Liquid Glass components for Svelte 5. SVG displacement refraction, a generated specular rim,
				Motion springs. No canvas, no WebGL, no remote assets.
			</p>
		</div>

		<div class="controls">
			<label>
				<span>tier</span>
				<select bind:value={tierOverride}>
					<option value="auto">auto — {glassSupport.detected ?? 'detecting'}</option>
					<option value="full">full</option>
					<option value="degraded">degraded</option>
					<option value="flat">flat</option>
				</select>
			</label>
			<label>
				<span>backdrop</span>
				<select bind:value={scheme}>
					<option value="dark">dark</option>
					<option value="light">light</option>
				</select>
			</label>
			<p class="meta">
				reduced motion: <strong>{reducedMotion.current ? 'on' : 'off'}</strong> ·
				<a href={resolve('/probe')}>optics probe</a>
			</p>
		</div>
	</header>

	<main>
		<section>
			<h2>LiquidButton</h2>
			<p class="note">
				Native <code>&lt;button&gt;</code>. Motion's <code>press</code> covers keyboard activation, so
				Space and Enter compress it exactly like a click. Tab to it and try.
			</p>
			<div class="row">
				<LiquidButton size="sm" onclick={() => (pressed += 1)}>Small</LiquidButton>
				<LiquidButton onclick={() => (pressed += 1)}>Medium</LiquidButton>
				<LiquidButton size="lg" tone="prominent" onclick={() => (pressed += 1)}>
					Prominent
				</LiquidButton>
				<LiquidButton disabled>Disabled</LiquidButton>
			</div>
			<p class="readout">presses: <strong>{pressed}</strong></p>
		</section>

		<section>
			<h2>LiquidSwitch</h2>
			<p class="note">
				<code>role="switch"</code> on a real button, so it announces as “switch, on”. The thumb travels
				on an under-damped spring; toggling mid-flight carries the velocity through.
			</p>
			<div class="col">
				<LiquidSwitch bind:checked={notifications}>Notifications</LiquidSwitch>
				<LiquidSwitch bind:checked={telemetry} size="sm">Anonymous telemetry</LiquidSwitch>
				<LiquidSwitch checked disabled label="Locked setting">Locked</LiquidSwitch>
			</div>
		</section>

		<section>
			<h2>LiquidSlider</h2>
			<p class="note">
				A transparent <code>&lt;input type="range"&gt;</code> sits over the track, so arrows, PageUp/PageDown
				and Home/End all work. The glass thumb squashes along its travel when the value moves fast.
			</p>
			<div class="col wide">
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
		</section>

		<section>
			<h2>LiquidTabs</h2>
			<p class="note">
				<code>tablist</code> / <code>tab</code> / <code>tabpanel</code> with roving focus and manual activation.
				Arrow keys move, Home and End jump, the disabled tab is skipped.
			</p>
			<LiquidTabs {tabs} bind:value={activeTab} label="Documentation sections">
				{#snippet panel(id)}
					<p class="panel">{tabCopy[id]}</p>
				{/snippet}
			</LiquidTabs>
		</section>

		<section class="span">
			<h2>LiquidLens</h2>
			<p class="note">
				Drag it across the text. Arrow keys move it too (hold Shift for larger steps), and Escape
				abandons a pointer drag and restores the starting position. It stretches along the direction
				of travel, capped at 12%.
			</p>
			<div class="lens-stage" bind:this={lensStage}>
				<div class="lens-copy">
					<p>
						The refraction is a displacement map: for every pixel, the distance to the outline picks
						a magnitude off a 128-entry lookup table, and the outward edge normal turns it into a
						vector. X goes in the red channel, Y in the green, 128 meaning “no shift”.
					</p>
					<p>
						The lookup table comes from Snell's law applied to a quartic squircle profile. Convex
						surfaces have an infinite slope right at the rim, so the exact vector form matters: it
						saturates at a finite offset instead of collapsing the whole table into a one-pixel
						spike.
					</p>
					<p>
						Peak displacement is about four times the bezel width. That sounds enormous, and it is —
						but it only applies in a very thin band at the outer edge. A tenth of the way into the
						bezel the magnitude is already down to 0.47, and halfway in it is 0.05.
					</p>
				</div>

				<LiquidLens container={lensStage} label="Magnifier" style="left: 8%; top: 24%;" />
			</div>
		</section>

		<section class="span">
			<h2>LiquidGlass — the primitive</h2>
			<p class="note">
				Everything above composes this. It takes content through a snippet and exposes the geometry
				and optics as typed props.
			</p>
			<div class="row wrap">
				<LiquidGlass width={150} height={150} borderRadius={75} bezel={40} interactive>
					<span class="tile-label">squircle</span>
				</LiquidGlass>
				<LiquidGlass
					width={150}
					height={150}
					borderRadius={28}
					bezel={30}
					profile="concave"
					interactive
				>
					<span class="tile-label">concave</span>
				</LiquidGlass>
				<LiquidGlass
					width={150}
					height={150}
					borderRadius={40}
					bezel={34}
					profile="lip"
					interactive
				>
					<span class="tile-label">lip</span>
				</LiquidGlass>
				<LiquidGlass
					width={150}
					height={150}
					borderRadius={20}
					bezel={26}
					chromaticAberration={0.16}
					interactive
				>
					<span class="tile-label">aberration</span>
				</LiquidGlass>
			</div>
		</section>
	</main>

	<footer>
		<p>
			Refraction through <code>backdrop-filter: url(#…)</code> is Chromium-only. Firefox and Safari
			fall back to the <strong>degraded</strong> tier — blur, tint, rim and shadows, no distortion. Switch
			tiers above to compare.
		</p>
	</footer>
</div>

<style>
	.page {
		min-height: 100vh;
		padding: clamp(1.25rem, 4vw, 3rem);
		color: #f4f6fa;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		line-height: 1.6;
	}

	.page[data-scheme='light'] {
		color: #0c0e16;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: clamp(2rem, 5vw, 3.5rem);
	}

	.titles {
		max-width: 34rem;
	}

	h1 {
		margin: 0 0 0.4rem;
		font-size: clamp(1.75rem, 5vw, 2.75rem);
		font-weight: 800;
		letter-spacing: -0.03em;
	}

	.titles p {
		margin: 0;
		font-size: 0.95rem;
		opacity: 0.8;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
	}

	.page[data-scheme='light'] .titles p,
	.page[data-scheme='light'] .note,
	.page[data-scheme='light'] footer p {
		text-shadow: none;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: flex-end;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.7rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	select {
		padding: 0.35rem 0.5rem;
		border: 1px solid rgb(128 128 128 / 0.35);
		border-radius: 8px;
		background: rgb(0 0 0 / 0.35);
		color: inherit;
		font: inherit;
		font-size: 0.8rem;
		text-transform: none;
		letter-spacing: 0;
	}

	.page[data-scheme='light'] select {
		background: rgb(255 255 255 / 0.6);
	}

	.meta {
		margin: 0;
		font-size: 0.75rem;
		opacity: 0.7;
	}

	main {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
		gap: clamp(1.5rem, 3vw, 2.5rem);
		align-items: start;
	}

	.span {
		grid-column: 1 / -1;
	}

	h2 {
		margin: 0 0 0.35rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.65;
	}

	.note {
		margin: 0 0 1.1rem;
		max-width: 46rem;
		font-size: 0.85rem;
		opacity: 0.78;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
	}

	code {
		padding: 0.05em 0.3em;
		border-radius: 4px;
		background: rgb(128 128 128 / 0.22);
		font-size: 0.9em;
	}

	.row,
	.col {
		display: flex;
		gap: 1rem;
	}

	.row {
		flex-wrap: wrap;
		align-items: center;
	}

	.row.wrap {
		gap: 1.5rem;
	}

	.col {
		flex-direction: column;
		align-items: flex-start;
	}

	.col.wide {
		align-items: stretch;
		max-width: 30rem;
		gap: 1.4rem;
	}

	.readout {
		margin: 1rem 0 0;
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
	}

	.panel {
		margin: 0;
		max-width: 40rem;
		font-size: 0.875rem;
		opacity: 0.85;
	}

	/*
	 * `position: relative` makes the stage the lens's offsetParent, which is what
	 * `LiquidLens`'s bounds calculation expects.
	 */
	.lens-stage {
		position: relative;
		overflow: hidden;
		border-radius: 20px;
		min-height: 26rem;
		padding: clamp(1rem, 3vw, 2rem);
		background: rgb(10 12 20 / 0.5);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1);
	}

	.page[data-scheme='light'] .lens-stage {
		background: rgb(255 255 255 / 0.45);
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.1);
	}

	.lens-copy {
		max-width: 44rem;
		font-size: 0.95rem;
	}

	.lens-copy p {
		margin: 0 0 1rem;
	}

	.tile-label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
	}

	footer {
		margin-top: clamp(2.5rem, 6vw, 4rem);
		max-width: 46rem;
	}

	footer p {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.7;
	}

	a {
		color: inherit;
		text-underline-offset: 3px;
	}
</style>
