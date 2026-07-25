<script lang="ts">
	/**
	 * Backdrop for the gallery: saturated colour fields, hard-edged shapes and small
	 * type. All three matter — gradients alone hide the refraction, whereas fine text
	 * and straight edges make even a few pixels of displacement obvious.
	 *
	 * Entirely CSS: no remote images, no CDN, nothing to load.
	 */
	let { scheme = 'dark' }: { scheme?: 'light' | 'dark' } = $props();

	const line =
		'liquid-svelte — SVG displacement refraction · specular rim from a generated normal map · ' +
		'Motion springs · 0123456789 · ';

	const lines = Array.from({ length: 40 }, (_, index) => line.repeat(3).slice(index * 11));
</script>

<div class="backdrop" data-scheme={scheme} aria-hidden="true">
	<div class="field field-a"></div>
	<div class="field field-b"></div>
	<div class="field field-c"></div>
	<div class="field field-d"></div>

	<div class="grid"></div>

	<div class="type">
		{#each lines as text, index (index)}
			<p>{text}</p>
		{/each}
	</div>

	<div class="shapes">
		<span class="shape ring-a"></span>
		<span class="shape ring-b"></span>
		<span class="shape bar-a"></span>
		<span class="shape bar-b"></span>
		<span class="shape dot"></span>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: #06070d;
		color: rgb(255 255 255 / 0.5);
	}

	.backdrop[data-scheme='light'] {
		background: #f5f3ee;
		color: rgb(12 14 26 / 0.45);
	}

	.field {
		position: absolute;
		border-radius: 50%;
		filter: blur(60px);
		opacity: 0.8;
	}

	.field-a {
		inset: -14% auto auto -10%;
		width: 58vw;
		height: 58vw;
		background: radial-gradient(circle, #ff2f7b 0%, #7a2bff 52%, transparent 72%);
	}

	.field-b {
		inset: auto -12% -20% auto;
		width: 52vw;
		height: 52vw;
		background: radial-gradient(circle, #00e0ff 0%, #0055ff 48%, transparent 70%);
	}

	.field-c {
		inset: 26% 4% auto auto;
		width: 34vw;
		height: 34vw;
		background: radial-gradient(circle, #ffd200 0%, #ff6a00 52%, transparent 72%);
	}

	.field-d {
		inset: auto auto 4% 22%;
		width: 38vw;
		height: 38vw;
		background: radial-gradient(circle, #00ffa3 0%, #00a86b 48%, transparent 70%);
	}

	.grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(to right, currentColor 0 1px, transparent 1px 100%),
			linear-gradient(to bottom, currentColor 0 1px, transparent 1px 100%);
		background-size: 40px 40px;
		opacity: 0.2;
	}

	.type {
		position: absolute;
		inset: 0;
		padding: 1rem;
		font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace;
		font-size: 11px;
		line-height: 1.7;
		white-space: nowrap;
		overflow: hidden;
		opacity: 0.55;
	}

	.type p {
		margin: 0;
	}

	.shapes {
		position: absolute;
		inset: 0;
	}

	.shape {
		position: absolute;
		display: block;
	}

	.ring-a {
		top: 8%;
		left: 58%;
		width: 190px;
		height: 190px;
		border: 10px solid rgb(255 255 255 / 0.8);
		border-radius: 50%;
	}

	.ring-b {
		top: 62%;
		left: 12%;
		width: 130px;
		height: 130px;
		border: 8px solid rgb(0 255 225 / 0.85);
		border-radius: 50%;
	}

	.bar-a {
		top: 34%;
		left: 4%;
		width: 220px;
		height: 22px;
		border-radius: 11px;
		background: rgb(255 255 255 / 0.85);
	}

	.bar-b {
		top: 78%;
		left: 62%;
		width: 260px;
		height: 18px;
		border-radius: 9px;
		background: rgb(255 0 90 / 0.85);
	}

	.dot {
		top: 18%;
		left: 34%;
		width: 74px;
		height: 74px;
		border-radius: 20px;
		background: #101218;
		box-shadow: 0 0 0 4px rgb(255 255 255 / 0.9);
	}
</style>
