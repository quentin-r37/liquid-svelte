<script lang="ts">
	import { resolve } from '$app/paths';
	import { glassSupport, resolveGlassSupport } from '$lib/liquid-glass/index.js';

	$effect(resolveGlassSupport);
</script>

<main>
	<h1>liquid-svelte</h1>
	<p>
		Liquid Glass components for Svelte 5 — SVG displacement refraction, specular highlights and
		Motion-driven springs.
	</p>

	<p class="tier">
		This browser resolves to tier <code>{glassSupport.detected ?? '…'}</code>.
	</p>

	<ul>
		<li>
			<a href={resolve('/probe')}>LiquidGlass probe</a> — the primitive on a hostile backdrop, with every
			prop exposed and live cache counters.
		</li>
	</ul>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 4rem 1.5rem;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		line-height: 1.6;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
	}

	p {
		margin: 0 0 1rem;
	}

	.tier code {
		padding: 0.1rem 0.35rem;
		border-radius: 5px;
		background: color-mix(in srgb, currentColor 10%, transparent);
		font-size: 0.9em;
	}

	ul {
		padding-left: 1.15rem;
	}
</style>
