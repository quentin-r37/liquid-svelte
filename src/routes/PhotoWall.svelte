<script lang="ts">
	/**
	 * Scrolling photo backdrop, the counterpart to `ScrollingGrid`.
	 *
	 * The grid is the *analytic* refraction test — straight lines make the displacement
	 * legible, and you can see exactly where a line bends. Photographs are the opposite
	 * test: high-frequency, unpredictable detail with no structure to fall back on, which
	 * is where a wrong specular rim or an over-strong chromatic aberration stops looking
	 * like an effect and starts looking like an artefact. Both are worth having.
	 *
	 * Three rows pan at different speeds and alternating directions, so a glass surface
	 * sitting across two of them never sees a coherent backdrop — the refracted edge and
	 * the flat centre disagree, which is precisely what makes the distortion readable.
	 *
	 * Unlike `ScrollingGrid` this one *does* load remote images (picsum.photos, seeded so
	 * the same shots come back every reload). That is a deliberate exception for a dev-only
	 * harness route; nothing in `src/lib` ever reaches the network. If picsum is
	 * unreachable the tiles keep their gradient placeholder and the wall still moves.
	 */
	const ROWS: { seeds: string[]; seconds: number; reverse: boolean }[] = [
		{
			seeds: ['harbour', 'atrium', 'dunes', 'kiosk', 'fernway', 'quarry', 'lantern', 'basalt'],
			seconds: 54,
			reverse: false
		},
		{
			seeds: [
				'meridian',
				'saltflat',
				'tundra',
				'archive',
				'monsoon',
				'granite',
				'orchard',
				'pylon'
			],
			seconds: 38,
			reverse: true
		},
		{
			seeds: [
				'cobalt',
				'driftwood',
				'terrace',
				'ridgeline',
				'aperture',
				'canopy',
				'silo',
				'estuary'
			],
			seconds: 68,
			reverse: false
		}
	];

	/*
	 * Requested at 2× the on-screen tile so the refraction samples real detail rather
	 * than upscaling mush — the bezel magnifies, and a soft source looks soft twice.
	 */
	const TILE_W = 800;
	const TILE_H = 600;

	let {
		scheme = 'dark',
		fixed = false,
		speed = 1
	}: {
		scheme?: 'light' | 'dark';
		/** Pin to the viewport (`position: fixed`) instead of filling the parent. */
		fixed?: boolean;
		/** Multiplier on every animation — 0.5 is half speed, 2 is double. */
		speed?: number;
	} = $props();

	function src(seed: string) {
		return `https://picsum.photos/seed/${seed}/${TILE_W}/${TILE_H}`;
	}

	/** A failed load leaves the placeholder gradient visible instead of a broken-image glyph. */
	function onError(event: Event) {
		(event.currentTarget as HTMLImageElement).style.visibility = 'hidden';
	}
</script>

<div class="backdrop" class:fixed data-scheme={scheme} style:--speed={speed} aria-hidden="true">
	{#each ROWS as row, index (index)}
		<div class="row">
			<div
				class="track"
				class:reverse={row.reverse}
				style:animation-duration={`calc(${row.seconds}s / var(--speed))`}
			>
				<!--
					Rendered twice and translated by exactly 50% of the track: the second copy
					is under the pointer at the moment the first one wraps, so the loop has no seam.
				-->
				{#each [0, 1] as copy (copy)}
					{#each row.seeds as seed (seed)}
						<div class="tile">
							<img
								src={src(seed)}
								alt=""
								width={TILE_W}
								height={TILE_H}
								loading="eager"
								decoding="async"
								referrerpolicy="no-referrer"
								onerror={onError}
							/>
						</div>
					{/each}
				{/each}
			</div>
		</div>
	{/each}

	<div class="scrim"></div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: #06070d;
	}

	.backdrop.fixed {
		position: fixed;
		z-index: -1;
	}

	.backdrop[data-scheme='light'] {
		background: #f5f3ee;
	}

	.row {
		position: relative;
		flex: 1;
		overflow: hidden;
	}

	.track {
		display: flex;
		height: 100%;
		width: max-content;
		will-change: transform;
		animation-name: pan;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}

	.track.reverse {
		animation-direction: reverse;
	}

	/*
	 * The separator is a trailing margin, not a flex `gap`. With `gap` the track measures
	 * 16 tiles + 15 gaps, so half of it lands 5px short of the copy boundary and the loop
	 * jumps by that much every cycle. A per-tile margin makes every tile the same pitch,
	 * and -50% is then exactly one copy.
	 */
	.tile {
		position: relative;
		height: 100%;
		aspect-ratio: 4 / 3;
		margin-right: 10px;
		overflow: hidden;
		/* Visible while the photo loads, and permanently if the network never answers. */
		background: linear-gradient(135deg, #1b2036 0%, #35263f 55%, #12303a 100%);
	}

	.backdrop[data-scheme='light'] .tile {
		background: linear-gradient(135deg, #ded8cc 0%, #e8dcd6 55%, #cfd8dd 100%);
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/*
	 * Photographs carry far more luminance range than the grid does, and body copy sits
	 * directly on top of this. A flat scrim buys back legibility without flattening the
	 * detail the refraction needs — hence 0.28, not 0.6.
	 */
	.scrim {
		position: absolute;
		inset: 0;
		background: rgb(4 5 12 / 0.28);
		pointer-events: none;
	}

	.backdrop[data-scheme='light'] .scrim {
		background: rgb(255 253 248 / 0.34);
	}

	@keyframes pan {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			transform: translate3d(-50%, 0, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.track {
			animation: none;
		}
	}
</style>
