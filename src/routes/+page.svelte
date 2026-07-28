<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		LiquidButton,
		LiquidGlass,
		LiquidSlider,
		LiquidSwitch,
		glassSupport,
		resolveGlassSupport,
		setGlassModeOverride,
		type GlassMode
	} from '$lib/liquid-glass/index.js';
	import { ArrowRight, Moon, Sun } from '@lucide/svelte';
	import Backdrop from './Backdrop.svelte';

	let scheme = $state<'light' | 'dark'>('dark');
	let tierOverride = $state<GlassMode>('auto');
	let notifications = $state(true);
	let volume = $state(64);
	let copied = $state(false);

	$effect(resolveGlassSupport);
	$effect(() => {
		setGlassModeOverride(tierOverride);
	});

	const INSTALL = 'npm install liquid-svelte motion';

	async function copyInstall() {
		try {
			await navigator.clipboard.writeText(INSTALL);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			/* clipboard unavailable — chip stays a label */
		}
	}

	const features = [
		{
			title: 'Real refraction',
			copy: 'A displacement map from Snell’s law over an analytic rounded-box SDF — not a blur with a border.'
		},
		{
			title: 'Three tiers',
			copy: 'Full SVG refraction on Chromium, blur-and-tint elsewhere, flat as a floor. SSR matches the client.'
		},
		{
			title: 'Motion springs',
			copy: 'Hover, press, drag and stretch compose on one transform, flushed once per frame.'
		}
	];

	const harnesses = [
		{ href: resolve('/demo'), label: 'Component gallery', hint: 'every component, tier switch' },
		{ href: resolve('/probe'), label: 'Optics probe', hint: 'every primitive prop on a slider' },
		{ href: resolve('/bench'), label: 'Scaling benchmark', hint: 'frame timing vs instance count' },
		{ href: resolve('/music'), label: 'Application screen', hint: 'a plausible product surface' }
	];
</script>

<svelte:head>
	<title>liquid-svelte — Liquid Glass components for Svelte 5</title>
	<meta
		name="description"
		content="Liquid Glass components for Svelte 5 — SVG displacement refraction, specular highlights, Motion-driven springs."
	/>
</svelte:head>

<Backdrop kind="grid" {scheme} fixed />

<div class="page" data-scheme={scheme}>
	<div class="chrome">
		<LiquidButton
			shape="circle"
			aria-label="Switch to {scheme === 'dark' ? 'light' : 'dark'} scheme"
			onclick={() => (scheme = scheme === 'dark' ? 'light' : 'dark')}
		>
			{#if scheme === 'dark'}<Sun />{:else}<Moon />{/if}
		</LiquidButton>
	</div>

	<main>
		<section class="hero">
			<h1>liquid-svelte</h1>
			<p class="tagline">
				Liquid Glass components for Svelte 5 — SVG displacement refraction, a generated specular rim
				and Motion springs. No canvas, no WebGL, no remote assets.
			</p>
			<p class="tier">
				This browser resolves to tier <code>{glassSupport.detected ?? '…'}</code>
			</p>

			<button class="install" type="button" onclick={copyInstall}>
				<code>{INSTALL}</code>
				<span class="copy-state">{copied ? 'copied' : 'copy'}</span>
			</button>

			<div class="cta">
				<LiquidButton size="lg" tone="prominent" onclick={() => goto(resolve('/docs'))}>
					Get started<ArrowRight />
				</LiquidButton>
				<LiquidButton
					size="lg"
					onclick={() => goto(resolve('/docs/[slug]', { slug: 'liquid-button' }))}
				>
					Components
				</LiquidButton>
			</div>
		</section>

		<section class="features">
			{#each features as feature (feature.title)}
				<LiquidGlass width={300} height={170} borderRadius={32} bezel={20} interactive>
					<div class="card">
						<h2>{feature.title}</h2>
						<p>{feature.copy}</p>
					</div>
				</LiquidGlass>
			{/each}
		</section>

		<section class="teaser">
			<h2 class="teaser-title">Try the material</h2>
			<div class="teaser-row">
				<LiquidSwitch bind:checked={notifications}>Notifications</LiquidSwitch>
				<div class="slider"><LiquidSlider bind:value={volume} label="Volume" showValue /></div>
				<label class="tier-select">
					<span>tier</span>
					<select bind:value={tierOverride}>
						<option value="auto">auto — {glassSupport.detected ?? 'detecting'}</option>
						<option value="full">full</option>
						<option value="degraded">degraded</option>
						<option value="flat">flat</option>
					</select>
				</label>
			</div>
			<p class="teaser-note">
				Drag the droplets — grab the switch knob and throw it. The tier select forces the rendering
				path every component resolves.
			</p>
		</section>

		<footer>
			<h2 class="teaser-title">Dev harnesses</h2>
			<ul>
				{#each harnesses as harness (harness.href)}
					<li><a href={harness.href}>{harness.label}</a> — {harness.hint}</li>
				{/each}
			</ul>
		</footer>
	</main>
</div>

<style>
	.page {
		min-height: 100dvh;
		color: #f4f6fa;
		font-family:
			'Inter Variable',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		line-height: 1.6;
	}

	.page[data-scheme='light'] {
		color: #0c0e16;
	}

	.chrome {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 40;
	}

	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: clamp(3rem, 10vh, 6rem) clamp(1.25rem, 4vw, 3rem) 4rem;
	}

	.hero {
		text-align: center;
	}

	h1 {
		margin: 0 0 0.75rem;
		font-size: clamp(2.5rem, 7vw, 4rem);
		font-weight: 800;
		letter-spacing: -0.035em;
		text-shadow: 0 2px 18px rgb(0 0 0 / 0.35);
	}

	.page[data-scheme='light'] h1 {
		text-shadow: none;
	}

	.tagline {
		margin: 0 auto 0.75rem;
		max-width: 38rem;
		font-size: 1.05rem;
		opacity: 0.85;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
	}

	.page[data-scheme='light'] .tagline,
	.page[data-scheme='light'] .teaser-note {
		text-shadow: none;
	}

	.tier {
		margin: 0 0 1.5rem;
		font-size: 0.8rem;
		opacity: 0.7;
	}

	code {
		padding: 0.1rem 0.35rem;
		border-radius: 5px;
		background: color-mix(in srgb, currentColor 10%, transparent);
		font-size: 0.9em;
	}

	.install {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.75rem;
		padding: 0.55rem 0.9rem;
		border: 1px solid rgb(128 128 128 / 0.4);
		border-radius: 12px;
		background: rgb(0 0 0 / 0.35);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.page[data-scheme='light'] .install {
		background: rgb(255 255 255 / 0.55);
	}

	.install code {
		background: none;
		padding: 0;
		font-size: 0.85rem;
	}

	.copy-state {
		font-size: 0.68rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		opacity: 0.6;
	}

	.cta {
		display: flex;
		justify-content: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.features {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1.5rem;
		margin-top: clamp(3rem, 8vh, 5rem);
	}

	.card {
		max-width: 250px;
		padding: 0 1.25rem;
		text-align: left;
	}

	.card h2 {
		margin: 0 0 0.3rem;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.card p {
		margin: 0;
		font-size: 0.78rem;
		opacity: 0.85;
	}

	.teaser {
		margin-top: clamp(3rem, 8vh, 5rem);
	}

	.teaser-title {
		margin: 0 0 1rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.65;
	}

	.teaser-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.5rem 2.5rem;
	}

	.slider {
		flex: 1 1 16rem;
		max-width: 24rem;
	}

	.tier-select {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.7rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.tier-select select {
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

	.page[data-scheme='light'] .tier-select select {
		background: rgb(255 255 255 / 0.6);
	}

	.teaser-note {
		margin: 1rem 0 0;
		max-width: 40rem;
		font-size: 0.8rem;
		opacity: 0.7;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
	}

	footer {
		margin-top: clamp(3rem, 8vh, 5rem);
	}

	footer ul {
		margin: 0;
		padding-left: 1.15rem;
		font-size: 0.85rem;
		opacity: 0.8;
	}

	footer li {
		margin-bottom: 0.5rem;
	}

	footer a {
		color: inherit;
		text-underline-offset: 3px;
	}
</style>
