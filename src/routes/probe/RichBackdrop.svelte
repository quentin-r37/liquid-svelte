<script lang="ts">
	/**
	 * Deliberately hostile backdrop for judging the refraction.
	 *
	 * Fine type is the harshest test there is — a displacement of a few pixels is
	 * instantly readable on 11px text and almost invisible on a soft gradient. The
	 * hairline grid gives straight references that reveal any discontinuity between
	 * the flat centre and the bezel, and the saturated blobs make chromatic
	 * aberration visible at the edges.
	 */
	let { scheme = 'dark' }: { scheme?: 'light' | 'dark' } = $props();

	const specimen =
		'Refraction sample — 0123456789 · the quick brown fox jumps over the lazy dog · ' +
		'ABCDEFGHIJKLMNOPQRSTUVWXYZ · hairlines, small type and saturated colour are what make ' +
		'a displacement map legible. ';

	const lines = Array.from({ length: 24 }, (_, index) => specimen.repeat(2).slice(index * 7));
</script>

<div class="backdrop" data-scheme={scheme} aria-hidden="true">
	<div class="blob blob-a"></div>
	<div class="blob blob-b"></div>
	<div class="blob blob-c"></div>
	<div class="blob blob-d"></div>

	<div class="grid"></div>

	<div class="stripes"></div>

	<div class="type">
		{#each lines as line, index (index)}
			<p>{line}</p>
		{/each}
	</div>

	<div class="shapes">
		<span class="shape circle"></span>
		<span class="shape square"></span>
		<span class="shape triangle"></span>
		<span class="shape ring"></span>
	</div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #05060c;
		color: rgb(255 255 255 / 0.55);
	}

	.backdrop[data-scheme='light'] {
		background: #f4f2ee;
		color: rgb(10 12 24 / 0.5);
	}

	.blob {
		position: absolute;
		border-radius: 50%;
		filter: blur(48px);
		opacity: 0.85;
	}

	.blob-a {
		inset: -12% auto auto -8%;
		width: 52vw;
		height: 52vw;
		background: radial-gradient(circle, #ff2d78 0%, #7b2dff 55%, transparent 72%);
	}

	.blob-b {
		inset: auto -10% -18% auto;
		width: 46vw;
		height: 46vw;
		background: radial-gradient(circle, #00e5ff 0%, #0066ff 50%, transparent 70%);
	}

	.blob-c {
		inset: 22% 8% auto auto;
		width: 30vw;
		height: 30vw;
		background: radial-gradient(circle, #ffd400 0%, #ff6b00 55%, transparent 72%);
	}

	.blob-d {
		inset: auto auto 6% 18%;
		width: 34vw;
		height: 34vw;
		background: radial-gradient(circle, #00ff9d 0%, #00a86b 50%, transparent 70%);
	}

	/* Hairline grid: straight edges are the clearest tell for displacement. */
	.grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(to right, currentColor 0 1px, transparent 1px 100%),
			linear-gradient(to bottom, currentColor 0 1px, transparent 1px 100%);
		background-size: 32px 32px;
		opacity: 0.28;
	}

	.stripes {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(62deg, currentColor 0 1px, transparent 1px 9px);
		opacity: 0.16;
	}

	.type {
		position: absolute;
		inset: 0;
		padding: 1.25rem;
		font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace;
		font-size: 11px;
		line-height: 1.65;
		letter-spacing: 0.01em;
		white-space: nowrap;
		overflow: hidden;
		opacity: 0.72;
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

	.circle {
		top: 12%;
		left: 62%;
		width: 96px;
		height: 96px;
		border-radius: 50%;
		background: #ffffff;
		opacity: 0.9;
	}

	.square {
		top: 58%;
		left: 24%;
		width: 84px;
		height: 84px;
		border-radius: 10px;
		background: #111318;
		box-shadow: 0 0 0 3px #ffffff;
	}

	.triangle {
		top: 34%;
		left: 44%;
		width: 0;
		height: 0;
		border-left: 46px solid transparent;
		border-right: 46px solid transparent;
		border-bottom: 78px solid #ff004d;
	}

	.ring {
		top: 70%;
		left: 68%;
		width: 110px;
		height: 110px;
		border-radius: 50%;
		border: 8px solid #00ffe1;
	}
</style>
