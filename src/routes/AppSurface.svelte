<script lang="ts">
	/**
	 * The calm backdrop: what the glass actually sits on inside a real product.
	 *
	 * `ScrollingGrid` and `PhotoWall` are stress tests — they are built to make the
	 * refraction as loud as possible. Most applications are the opposite: a flat surface
	 * or a wide, low-contrast gradient, nothing moving. That case is worth its own
	 * backdrop precisely because it is unflattering. With nothing behind it to bend, the
	 * displacement map contributes almost nothing, and the whole read of the material
	 * falls to the specular rim, the tint and the shadow. If a component looks convincing
	 * here it will look convincing anywhere; if it disappears, the rim and tint are too
	 * timid, and no amount of displacement will fix that.
	 *
	 * Static on purpose. Nothing animates, so this is also the honest place to judge
	 * hover, press and drag motion without a moving field masking them.
	 */
	let {
		variant = 'gradient',
		scheme = 'dark',
		fixed = false
	}: {
		/** `solid` is a single flat fill; `gradient` is a broad low-contrast wash. */
		variant?: 'solid' | 'gradient';
		scheme?: 'light' | 'dark';
		/** Pin to the viewport (`position: fixed`) instead of filling the parent. */
		fixed?: boolean;
	} = $props();
</script>

<div class="backdrop" class:fixed data-scheme={scheme} data-variant={variant} aria-hidden="true">
	{#if variant === 'gradient'}
		<!--
			Two soft off-screen pools rather than one linear ramp: a linear gradient is
			uniform along its perpendicular, so a glass surface only ever samples one
			slope of it. Overlapping radials give the bezel a slightly different
			neighbourhood on every side, which is what a real hero surface does too.
		-->
		<div class="pool pool-a"></div>
		<div class="pool pool-b"></div>
	{/if}
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #0e0f16;
	}

	.backdrop.fixed {
		position: fixed;
		z-index: -1;
	}

	.backdrop[data-scheme='light'] {
		background: #f4f5f8;
	}

	.backdrop[data-variant='gradient'] {
		background: linear-gradient(165deg, #141726 0%, #0d0e15 52%, #16111f 100%);
	}

	.backdrop[data-scheme='light'][data-variant='gradient'] {
		background: linear-gradient(165deg, #eef1fb 0%, #fbf8f4 52%, #eef5f4 100%);
	}

	/*
	 * Deliberately weak (0.5 / 0.35 alpha under a 120px blur): product surfaces sit far
	 * below the saturation of the demo grid, and testing against a loud gradient would
	 * flatter the optics the same way the grid does.
	 */
	.pool {
		position: absolute;
		border-radius: 50%;
		filter: blur(120px);
	}

	.pool-a {
		inset: -24% -18% auto auto;
		width: 62vw;
		height: 62vw;
		background: radial-gradient(circle, rgb(96 116 255 / 0.5) 0%, transparent 68%);
	}

	.pool-b {
		inset: auto auto -28% -16%;
		width: 58vw;
		height: 58vw;
		background: radial-gradient(circle, rgb(255 108 168 / 0.35) 0%, transparent 68%);
	}

	.backdrop[data-scheme='light'] .pool-a {
		background: radial-gradient(circle, rgb(118 140 255 / 0.34) 0%, transparent 68%);
	}

	.backdrop[data-scheme='light'] .pool-b {
		background: radial-gradient(circle, rgb(255 150 190 / 0.3) 0%, transparent 68%);
	}
</style>
