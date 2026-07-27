<script lang="ts">
	import { resolve } from '$app/paths';
	import { LiquidGlass, setGlassModeOverride, type GlassMode } from '$lib/liquid-glass/index.js';
	import Backdrop, { BACKDROP_KINDS, type BackdropKind } from '../Backdrop.svelte';
	import iosReference from './ios-reference.png';

	/**
	 * Border-weight harness. The perceived "border" of a glass surface is three
	 * layers stacked: the generated specular rim (SVG, follows the light), the CSS
	 * hairline (`--lg-border-width`, uniform) and the pointer glow band (1.25× the
	 * hairline). iOS runs all three much lighter than this library originally
	 * did; this page sweeps each axis so a recipe could be picked by eye, and the
	 * winning one — 1.5px rim @ 0.35, 0.5px hairline — now ships as the library
	 * defaults. The "previous" tiles keep the old values for regression checks.
	 * Throwaway debug UI, same register as /probe.
	 */

	let scheme = $state<'light' | 'dark'>('dark');
	let backdrop = $state<BackdropKind>('photos');
	let modeOverride = $state<GlassMode>('auto');

	$effect(() => {
		setGlassModeOverride(modeOverride);
	});

	// ------------------------------------------------------------ playground ---

	let rimWidth = $state(1.5);
	let rimIntensity = $state(0.35);
	let hairline = $state(0.5);
	let bezel = $state(24);

	// ---------------------------------------------------------------- sweeps ---

	/**
	 * All tiles share one geometry so every map in a sweep is a cache hit after
	 * the first. Bezel 24 derives 24 × 0.06 ≈ 1.44, floored to the 1.5px minimum —
	 * the tile labelled "default" below. 2.2px is what the old 0.09 ratio gave
	 * this bezel, kept as the "previous" tile.
	 */
	const TILE = { width: 220, height: 140, borderRadius: 28, bezel: 24 } as const;

	/** `null` leaves `specularWidth` unset, i.e. the library derivation. */
	const widthSweep: { value: number | null; label: string }[] = [
		{ value: 1, label: '1px' },
		{ value: null, label: '1.5px — default' },
		{ value: 2.2, label: '2.2px — previous' },
		{ value: 3, label: '3px' },
		{ value: 4, label: '4px' }
	];

	const intensitySweep = [0.2, 0.35, 0.55, 0.8];

	const hairlineSweep = [0, 0.5, 1, 1.5];

	/**
	 * Curated combinations at control scale — border weight is judged on a 44px
	 * pill, not on a card. The specular is present in every one of them; only its
	 * weight moves.
	 */
	const candidates: {
		id: string;
		label: string;
		width?: number;
		intensity: number;
		hairline: number;
	}[] = [
		{
			id: 'previous',
			label: 'previous defaults — 2.2px @ 0.8, 1px hairline',
			width: 2.2,
			intensity: 0.8,
			hairline: 1
		},
		{
			id: 'default',
			label: 'shipped defaults — 1.5px @ 0.35, 0.5px hairline',
			intensity: 0.35,
			hairline: 0.5
		},
		{ id: 'fine', label: 'fine — 1px @ 0.6, 0.5px', width: 1, intensity: 0.6, hairline: 0.5 },
		{
			id: 'whisper',
			label: 'whisper — 1px @ 0.25, 0.5px',
			width: 1,
			intensity: 0.25,
			hairline: 0.5
		}
	];

	/**
	 * Recipes rendered beside the iOS 26 screenshot, on the same black stage and
	 * with the same dark material (tint colour overridden to iOS's dark grey), so
	 * the only visible difference between the tiles is the edge treatment.
	 */
	const referenceVariants: {
		id: string;
		label: string;
		width?: number;
		intensity: number;
		hairline: number;
	}[] = [
		{
			id: 'previous',
			label: 'previous defaults — 2.2px @ 0.8, 1px hairline',
			width: 2.2,
			intensity: 0.8,
			hairline: 1
		},
		{
			id: 'default',
			label: 'shipped defaults — 1.5px @ 0.35, 0.5px hairline',
			intensity: 0.35,
			hairline: 0.5
		},
		{ id: 'faint', label: '1px @ 0.25, 0.5px hairline', width: 1, intensity: 0.25, hairline: 0.5 }
	];
</script>

<svelte:head>
	<title>liquid-svelte — borders lab</title>
</svelte:head>

<Backdrop kind={backdrop} {scheme} fixed />

<div class="page" data-scheme={scheme}>
	<header>
		<div class="titles">
			<h1>borders lab</h1>
			<p>
				The edge of a glass surface is three stacked layers: the generated specular rim (follows the
				light), the CSS hairline (uniform) and the pointer glow (rides the hairline). Each row below
				moves exactly one of them. Hover the tiles — the glow band thins with the hairline.
			</p>
			<p class="meta">
				<a href={resolve('/demo')}>component gallery</a> ·
				<a href={resolve('/probe')}>optics probe</a>
			</p>
		</div>

		<div class="controls">
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
		</div>
	</header>

	<main>
		<section>
			<h2>Specular rim width — <code>specularWidth</code>, intensity at the 0.35 default</h2>
			<p class="note">
				The generated rim, from hairline-thin to well past the clamp. The library now derives 1.5px
				for this bezel — the iOS reference value — where it used to derive 2.2px.
			</p>
			<div class="row">
				{#each widthSweep as v (v.label)}
					<div class="cell">
						<LiquidGlass {...TILE} specularWidth={v.value ?? undefined} interactive>
							<span class="tile-label">{v.label}</span>
						</LiquidGlass>
					</div>
				{/each}
			</div>
		</section>

		<section>
			<h2>Specular intensity — <code>specularIntensity</code>, width left at the default</h2>
			<p class="note">
				Same rim, dimmer. This one is a live filter attribute, so unlike the width it can be
				animated — a control could rest light and brighten on hover.
			</p>
			<div class="row">
				{#each intensitySweep as v (v)}
					<div class="cell">
						<LiquidGlass {...TILE} specularIntensity={v} interactive>
							<span class="tile-label">
								{v}{v === 0.35 ? ' — default' : v === 0.8 ? ' — previous' : ''}
							</span>
						</LiquidGlass>
					</div>
				{/each}
			</div>
		</section>

		<section>
			<h2>CSS hairline — <code>--lg-border-width</code>, specular at its defaults</h2>
			<p class="note">
				The uniform liseré under the specular. The pointer glow band is 1.25× this value, so at 0
				the hover glow disappears with it — the two are meant to read as one edge.
			</p>
			<div class="row">
				{#each hairlineSweep as v (v)}
					<div class="cell">
						<LiquidGlass {...TILE} interactive style={`--lg-border-width: ${v}px;`}>
							<span class="tile-label">
								{v}px{v === 0.5 ? ' — default' : v === 1 ? ' — previous' : ''}
							</span>
						</LiquidGlass>
					</div>
				{/each}
			</div>
		</section>

		<section>
			<h2>Candidates at control scale</h2>
			<p class="note">
				Border weight is judged on a 44px pill, not a card. The specular survives in all four — only
				its weight moves. The second pill is what the library now ships; the first is what it
				shipped before the iOS 26 comparison. Flip the scheme and the backdrop before judging.
			</p>
			<div class="row pills">
				{#each candidates as c (c.id)}
					<div class="cell">
						<LiquidGlass
							width={150}
							height={44}
							borderRadius={22}
							bezel={12}
							specularWidth={c.width}
							specularIntensity={c.intensity}
							interactive
							style={`--lg-border-width: ${c.hairline}px;`}
						>
							<span class="pill-label">{c.id}</span>
						</LiquidGlass>
						<p class="caption">{c.label}</p>
					</div>
				{/each}
			</div>
		</section>

		<section>
			<h2>iOS 26 reference — dark circular button</h2>
			<p class="note">
				The screenshot is the target. What it says about the edge: the rim is ~1px, very dim (reads
				nearer 0.3 — the shipped default is 0.35), carried by the top-left / bottom-right diagonal,
				and the uniform hairline under it is barely there. All three glass circles share the
				reference's dark material — the tint colour is overridden to iOS's dark grey — so the edge
				is the only thing that differs. The rim's double arc now sits on that same diagonal:
				<code>SPECULAR_LIGHT_ANGLE</code> is the CSS layers' 145° light restated, after living at
				60° and quietly fighting every gradient under it. The residual difference is that our two
				arcs are equally bright (<code>|N·L|</code>) where iOS's lower one is a touch fainter.
			</p>
			<div class="ref-stage">
				<figure class="cell">
					<img src={iosReference} alt="iOS 26 circular button on a black background" />
					<figcaption class="caption">iOS 26 screenshot</figcaption>
				</figure>
				{#each referenceVariants as r (r.id)}
					<div class="cell">
						<LiquidGlass
							width={230}
							height={230}
							borderRadius={115}
							bezel={24}
							opacity={0.78}
							specularWidth={r.width}
							specularIntensity={r.intensity}
							interactive
							style={`--lg-border-width: ${r.hairline}px; --lg-tint-color: 28 28 30;`}
						>
							<span class="tile-label">{r.id}</span>
						</LiquidGlass>
						<p class="caption">{r.label}</p>
					</div>
				{/each}
			</div>
		</section>

		<section>
			<h2>iOS light — the same recipes on a light stage</h2>
			<p class="note">
				Same three edges, same geometry, but the material flipped to iOS light mode: the default
				white tint over the system grey background. This is the harder case for the rim — a white
				highlight over a near-white material barely registers, which is why iOS leans on the drop
				shadow and the hairline here and lets the specular whisper. If a recipe holds up on both
				this stage and the black one, it holds up.
			</p>
			<div class="ref-stage light">
				{#each referenceVariants as r (r.id)}
					<div class="cell">
						<LiquidGlass
							width={230}
							height={230}
							borderRadius={115}
							bezel={24}
							opacity={0.6}
							specularWidth={r.width}
							specularIntensity={r.intensity}
							interactive
							style={`--lg-border-width: ${r.hairline}px;`}
						>
							<span class="tile-label">{r.id}</span>
						</LiquidGlass>
						<p class="caption">{r.label}</p>
					</div>
				{/each}
			</div>
		</section>

		<section>
			<h2>Playground</h2>
			<div class="lab">
				<fieldset>
					<legend>edge</legend>
					<label>
						<span>specular width <em>{rimWidth.toFixed(1)}px</em></span>
						<input type="range" min="0.5" max="4" step="0.1" bind:value={rimWidth} />
					</label>
					<label>
						<span>specular intensity <em>{rimIntensity.toFixed(2)}</em></span>
						<input type="range" min="0" max="1" step="0.05" bind:value={rimIntensity} />
					</label>
					<label>
						<span>hairline <em>{hairline.toFixed(2)}px</em></span>
						<input type="range" min="0" max="2" step="0.25" bind:value={hairline} />
					</label>
					<label>
						<span>bezel <em>{bezel}px</em></span>
						<input type="range" min="12" max="40" step="2" bind:value={bezel} />
					</label>
				</fieldset>

				<div class="stage">
					<LiquidGlass
						width={360}
						height={220}
						borderRadius={36}
						{bezel}
						specularWidth={rimWidth}
						specularIntensity={rimIntensity}
						interactive
						style={`--lg-border-width: ${hairline}px;`}
					>
						<span class="tile-label">playground</span>
					</LiquidGlass>
				</div>
			</div>
			<p class="readout">
				<code>specularWidth={rimWidth.toFixed(1)}</code>
				<code>specularIntensity={rimIntensity.toFixed(2)}</code>
				<code>style="--lg-border-width: {hairline.toFixed(2)}px"</code>
			</p>
			<p class="note">
				The width slider regenerates the specular map on each step — fine here, but it is part of
				the map cache key, so in a component it is a value to set, not to animate. Intensity and the
				hairline are live.
			</p>
		</section>
	</main>
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
		margin-bottom: clamp(2rem, 5vw, 3rem);
	}

	.titles {
		max-width: 38rem;
	}

	h1 {
		margin: 0 0 0.4rem;
		font-size: clamp(1.5rem, 4vw, 2.25rem);
		font-weight: 800;
		letter-spacing: -0.03em;
	}

	.titles p {
		margin: 0;
		font-size: 0.9rem;
		opacity: 0.8;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
	}

	.page[data-scheme='light'] .titles p,
	.page[data-scheme='light'] .note {
		text-shadow: none;
	}

	.meta {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		opacity: 0.7;
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

	main {
		display: flex;
		flex-direction: column;
		gap: clamp(2rem, 5vw, 3rem);
	}

	h2 {
		margin: 0 0 0.35rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.65;
	}

	h2 code {
		text-transform: none;
		letter-spacing: 0;
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

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		align-items: flex-start;
	}

	.cell {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: center;
	}

	.caption {
		margin: 0;
		max-width: 11rem;
		font-size: 0.7rem;
		text-align: center;
		opacity: 0.65;
	}

	.tile-label,
	.pill-label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
	}

	.pill-label {
		font-size: 0.75rem;
	}

	/*
	 * Always black whatever the scheme control says, because the screenshot it
	 * holds was taken on black — comparing edges across two different backdrops
	 * would be comparing nothing.
	 */
	.ref-stage {
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
		align-items: center;
		padding: 2rem;
		border-radius: 20px;
		background: #000;
	}

	.ref-stage figure {
		margin: 0;
	}

	.ref-stage img {
		display: block;
		width: 230px;
		height: auto;
	}

	.ref-stage .caption {
		color: #f4f6fa;
		opacity: 0.55;
	}

	/* iOS's light system background, pinned like the black stage and for the same
	   reason: the material being imitated was designed against this grey. */
	.ref-stage.light {
		background: #f2f2f7;
	}

	.ref-stage.light .caption,
	.ref-stage.light .tile-label {
		color: #1c1c1e;
	}

	.ref-stage.light .tile-label {
		text-shadow: none;
	}

	.lab {
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
		align-items: flex-start;
	}

	fieldset {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		min-width: 16rem;
		margin: 0;
		padding: 1rem 1.25rem 1.25rem;
		border: 1px solid rgb(128 128 128 / 0.3);
		border-radius: 12px;
	}

	legend {
		padding: 0 0.4rem;
		font-size: 0.7rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	fieldset label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.75rem;
	}

	fieldset label span {
		display: flex;
		justify-content: space-between;
		opacity: 0.8;
	}

	fieldset em {
		font-style: normal;
		font-variant-numeric: tabular-nums;
		opacity: 0.9;
	}

	input[type='range'] {
		width: 100%;
	}

	.stage {
		display: flex;
		align-items: center;
		min-height: 220px;
	}

	.readout {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1rem 0 0.5rem;
		font-size: 0.8rem;
		opacity: 0.8;
	}

	a {
		color: inherit;
		text-underline-offset: 3px;
	}
</style>
