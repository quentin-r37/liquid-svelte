<script lang="ts">
	import { resolve } from '$app/paths';
	import { LiquidGlass } from '$lib/liquid-glass/index.js';
	import CodeBlock from './_components/CodeBlock.svelte';
	import ExampleStage from './_components/ExampleStage.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Introduction — liquid-svelte</title>
	<meta
		name="description"
		content="Liquid Glass components for Svelte 5 — SVG displacement refraction, specular highlights, Motion-driven springs."
	/>
</svelte:head>

<article>
	<h1>liquid-svelte</h1>
	<p class="lede">
		Liquid Glass components for Svelte 5 — SVG displacement refraction, a generated specular rim and
		Motion springs. No canvas, no WebGL, no remote assets.
	</p>
	<p class="body">
		Every control composes one primitive: a glass surface whose refraction is a real displacement
		map, built from Snell's law over an analytic rounded-box distance field, applied through
		<code>backdrop-filter</code>. Buttons, switches, sliders, tabs, menus and a draggable lens all
		share that optical pipeline, and every gesture runs through Motion springs on a single composed
		transform.
	</p>

	<section>
		<h2>Installation</h2>
		<CodeBlock html={data.install} code="npm install liquid-svelte motion" />
		<p class="body">
			Peer dependencies are <code>svelte ^5.20</code> and <code>motion ^12</code>. The stylesheet
			ships with the components and loads automatically the first time a glass component mounts; if
			you prefer an explicit import, <code>import 'liquid-svelte/liquid-glass.css'</code> is exposed as
			a subpath.
		</p>
	</section>

	<section>
		<h2>Quick start</h2>
		<ExampleStage code={data.quickStart.html} raw={data.quickStart.raw}>
			<LiquidGlass width={280} height={140} borderRadius={48} bezel={26} interactive>
				<p class="tile">Refracted content</p>
			</LiquidGlass>
		</ExampleStage>
		<p class="body">
			<code>displacement</code> is intentionally left unset: it defaults to four times the bezel,
			which is what the effect actually needs. Geometry props (<code>width</code>,
			<code>height</code>, <code>borderRadius</code>, <code>bezel</code>, <code>profile</code>)
			regenerate the displacement texture; optics (<code>blur</code>, <code>saturation</code>,
			<code>displacement</code>, <code>chromaticAberration</code>) are live filter attributes,
			animatable at 60fps without touching a canvas.
		</p>
	</section>

	<section>
		<h2>Rendering tiers</h2>
		<p class="body">
			Refraction through <code>backdrop-filter: url(#…)</code> is Chromium-only — Firefox and WebKit claim
			support and then paint nothing, and no web API can read back composited pixels. So the library resolves
			one of three tiers per instance instead of feature-testing:
		</p>
		<ul class="body">
			<li><strong>full</strong> — the SVG displacement filter. Chromium only.</li>
			<li>
				<strong>degraded</strong> — plain CSS <code>blur() saturate()</code>. Also the SSR tier, so
				server and client markup agree.
			</li>
			<li><strong>flat</strong> — no backdrop filtering; a denser tint carries legibility.</li>
		</ul>
		<p class="body">
			Detection runs after hydration, and there are escape hatches at both scopes — a
			<code>mode</code> prop on every component, and a global override:
		</p>
		<CodeBlock html={data.tierOverride.html} code={data.tierOverride.raw} />
	</section>

	<section>
		<h2>The backdrop rule</h2>
		<p class="body">
			<code>backdrop-filter</code> only sees down to its nearest <em>backdrop root</em>, and an
			ancestor becomes one the moment it has <code>filter</code>, <code>opacity</code> below 1,
			<code>mask</code>, <code>clip-path</code>, <code>mix-blend-mode</code>,
			<code>isolation: isolate</code> — or, in Chromium, a <code>transform</code>. Put a glass
			component inside such a wrapper and its refraction silently sees nothing. Clip with
			<code>overflow: hidden</code> plus <code>border-radius</code>, fade with colour alphas rather
			than the <code>opacity</code> property, and keep transforms off the ancestors of glass.
		</p>
	</section>

	<section>
		<h2>Accessibility and motion</h2>
		<p class="body">
			Every control is built on the native element or ARIA pattern it represents — a real
			<code>&lt;button&gt;</code>, <code>role="switch"</code>, an
			<code>&lt;input type="range"&gt;</code> under the slider, the tabs and toolbar patterns with
			roving focus. <code>prefers-reduced-motion</code> swaps every spring for a short fade, exposed
			to consumers as the reactive <code>reducedMotion</code> object.
		</p>
	</section>

	<section>
		<h2>Next</h2>
		<p class="body">
			Start with <a href={resolve('/docs/[slug]', { slug: 'liquid-button' })}>LiquidButton</a>, or
			browse the sidebar — each page pairs live examples with the exact source that renders them.
		</p>
	</section>
</article>

<style>
	article {
		max-width: 52rem;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: clamp(1.6rem, 4vw, 2.2rem);
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.lede {
		margin: 0 0 1rem;
		font-size: 1rem;
		opacity: 0.85;
		max-width: 46rem;
	}

	.body {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		opacity: 0.78;
		max-width: 46rem;
	}

	ul.body {
		padding-left: 1.15rem;
	}

	ul.body li {
		margin-bottom: 0.4rem;
	}

	section {
		margin-top: 2.25rem;
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.65;
	}

	code {
		padding: 0.05em 0.3em;
		border-radius: 4px;
		background: rgb(128 128 128 / 0.22);
		font-size: 0.9em;
	}

	.tile {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
	}

	a {
		color: inherit;
		text-underline-offset: 3px;
	}

	section :global(.code-block) {
		margin-bottom: 1rem;
	}
</style>
