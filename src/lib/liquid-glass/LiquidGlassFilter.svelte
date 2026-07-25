<script lang="ts">
	import type { DisplacementMap } from './liquidGlass.types.js';
	import { DISPLACEMENT_SCALE_FACTOR, MAX_CHROMATIC_ABERRATION } from './runtime/glassTokens.js';

	interface Props {
		/** Filter id, unique per glass instance. Referenced by `backdrop-filter: url(#…)`. */
		id: string;
		map: DisplacementMap;
		/** Element size in CSS pixels — the user-space box the map is stretched into. */
		width: number;
		height: number;
		/** Peak refraction offset in CSS pixels. */
		displacement: number;
		/** Per-channel displacement spread. `0` collapses the chain to a single pass. */
		chromaticAberration: number;
		/** `feGaussianBlur` stdDeviation. `0` skips the primitive entirely. */
		blur: number;
		/** `feColorMatrix type="saturate"` amount. */
		saturation: number;
	}

	let { id, map, width, height, displacement, chromaticAberration, blur, saturation }: Props =
		$props();

	/**
	 * `feDisplacementMap` shifts each pixel by `scale × (channel / 255 − 0.5)`, so
	 * a fully saturated channel only reaches `scale / 2`. Maps are generated
	 * normalised — peak magnitude encoded as 255 — hence the ×2 here to turn the
	 * requested peak offset in pixels into the attribute value.
	 */
	const baseScale = $derived(displacement * DISPLACEMENT_SCALE_FACTOR);

	const aberration = $derived(Math.min(MAX_CHROMATIC_ABERRATION, Math.max(0, chromaticAberration)));
	const chromatic = $derived(aberration > 0);

	/** Red refracts least in real glass, blue most — so red gets the larger offset. */
	const scaleRed = $derived(baseScale * (1 + aberration));
	const scaleBlue = $derived(baseScale * (1 - aberration));
</script>

<!--
	The SVG host must stay in the layout tree. `display: none` lets Chromium drop
	the filter subtree, after which `backdrop-filter: url(#id)` silently resolves
	to nothing — so it is collapsed to a zero-sized clipped box instead.

	`color-interpolation-filters="sRGB"` is not optional: the default
	`linearRGB` re-encodes the channels before `feDisplacementMap` reads them,
	which shifts the 128 neutral point and skews the whole field.

	`primitiveUnits="userSpaceOnUse"` lets `feImage` be positioned in CSS pixels
	while `filterUnits="objectBoundingBox"` keeps the filter region pinned to the
	element. The region is deliberately not enlarged: a larger region would let
	the blur bleed outside the glass silhouette. The cost is that the outermost
	pixel or two samples the backdrop clamped at the edge, which the border and
	specular layers cover.
-->
<svg class="lg-filter-host" aria-hidden="true" focusable="false">
	<defs>
		<filter
			{id}
			x="0"
			y="0"
			width="100%"
			height="100%"
			filterUnits="objectBoundingBox"
			primitiveUnits="userSpaceOnUse"
			color-interpolation-filters="sRGB"
		>
			<feImage
				href={map.url}
				x="0"
				y="0"
				{width}
				{height}
				preserveAspectRatio="none"
				result="displacementMap"
			/>

			{#if chromatic}
				<!--
					Chromatic aberration: displace three times at slightly different
					scales, keep one channel from each pass, recombine additively.
					Three passes over the backdrop, so this is `quality: 'high'` only.
				-->
				<feDisplacementMap
					in="SourceGraphic"
					in2="displacementMap"
					scale={scaleRed}
					xChannelSelector="R"
					yChannelSelector="G"
					result="passRed"
				/>
				<feColorMatrix
					in="passRed"
					type="matrix"
					values="1 0 0 0 0
					        0 0 0 0 0
					        0 0 0 0 0
					        0 0 0 1 0"
					result="channelRed"
				/>

				<feDisplacementMap
					in="SourceGraphic"
					in2="displacementMap"
					scale={baseScale}
					xChannelSelector="R"
					yChannelSelector="G"
					result="passGreen"
				/>
				<feColorMatrix
					in="passGreen"
					type="matrix"
					values="0 0 0 0 0
					        0 1 0 0 0
					        0 0 0 0 0
					        0 0 0 1 0"
					result="channelGreen"
				/>

				<feDisplacementMap
					in="SourceGraphic"
					in2="displacementMap"
					scale={scaleBlue}
					xChannelSelector="R"
					yChannelSelector="G"
					result="passBlue"
				/>
				<feColorMatrix
					in="passBlue"
					type="matrix"
					values="0 0 0 0 0
					        0 0 0 0 0
					        0 0 1 0 0
					        0 0 0 1 0"
					result="channelBlue"
				/>

				<feBlend in="channelRed" in2="channelGreen" mode="screen" result="channelRedGreen" />
				<feBlend in="channelRedGreen" in2="channelBlue" mode="screen" result="refracted" />
			{:else}
				<feDisplacementMap
					in="SourceGraphic"
					in2="displacementMap"
					scale={baseScale}
					xChannelSelector="R"
					yChannelSelector="G"
					result="refracted"
				/>
			{/if}

			{#if blur > 0}
				<feGaussianBlur in="refracted" stdDeviation={blur} result="softened" />
				<feColorMatrix in="softened" type="saturate" values={String(saturation)} />
			{:else}
				<feColorMatrix in="refracted" type="saturate" values={String(saturation)} />
			{/if}
		</filter>
	</defs>
</svg>

<style>
	.lg-filter-host {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
		pointer-events: none;
	}
</style>
