<script lang="ts">
	import type { GlassMap } from './liquidGlass.types.js';
	import {
		DISPLACEMENT_SCALE_FACTOR,
		FILTER_REGION_MARGIN,
		MAX_CHROMATIC_ABERRATION
	} from './runtime/glassTokens.js';

	interface Props {
		/** Filter id, unique per glass instance. Referenced by `backdrop-filter: url(#…)`. */
		id: string;
		displacementMap: GlassMap;
		/** Omit to skip the specular pass (quality `low`). */
		specularMap?: GlassMap | null;
		/** Element size in CSS pixels — the user-space box the maps are stretched into. */
		width: number;
		height: number;
		/** Peak refraction offset in CSS pixels. */
		displacement: number;
		/** Per-channel displacement spread. `0` collapses the chain to a single pass. */
		chromaticAberration: number;
		/** `feGaussianBlur` stdDeviation, applied before refraction. `0` skips it. */
		blur: number;
		/** `feColorMatrix type="saturate"` amount. */
		saturation: number;
		/** `feFuncA` slope applied to the specular map, `0`–`1`. */
		specularIntensity: number;
	}

	let {
		id,
		displacementMap,
		specularMap = null,
		width,
		height,
		displacement,
		chromaticAberration,
		blur,
		saturation,
		specularIntensity
	}: Props = $props();

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

	/** `-50% … 200%` in objectBoundingBox units. */
	const regionOffset = $derived(`${-FILTER_REGION_MARGIN * 100}%`);
	const regionSize = $derived(`${(1 + FILTER_REGION_MARGIN * 2) * 100}%`);

	/** The refraction reads from the blurred backdrop when a blur is requested. */
	const refractionSource = $derived(blur > 0 ? 'blurred' : 'SourceGraphic');
</script>

<!--
	The SVG host must stay in the layout tree. `display: none` lets Chromium drop
	the filter subtree, after which `backdrop-filter: url(#id)` silently resolves
	to nothing — so it is collapsed to a zero-sized clipped box instead.

	Three attributes on <filter> are load-bearing:

	• `color-interpolation-filters="sRGB"` — the default `linearRGB` re-encodes the
	  channels before `feDisplacementMap` reads them, shifting the 128 neutral
	  point and skewing the whole field.

	• The enlarged region (`-50% / 200%`). Near the rim the displacement reaches
	  several dozen pixels, so the sample point lands well outside the element.
	  Anything outside the filter region resolves to transparent black, which shows
	  up as a dead, washed-out edge — the single most visible defect if you pin the
	  region to the element. `backdrop-filter` clips the *output* to the border-box
	  regardless, so a generous region costs fill rate but never bleeds.

	• `primitiveUnits="userSpaceOnUse"` — lets the two feImages be positioned in
	  CSS pixels at the element's origin even though the region is larger.
-->
<svg class="lg-filter-host" aria-hidden="true" focusable="false">
	<defs>
		<filter
			{id}
			x={regionOffset}
			y={regionOffset}
			width={regionSize}
			height={regionSize}
			filterUnits="objectBoundingBox"
			primitiveUnits="userSpaceOnUse"
			color-interpolation-filters="sRGB"
		>
			{#if blur > 0}
				<!--
					Blur *before* refraction, not after. Blurring the displaced result
					smears the distortion into mush; blurring the source keeps the
					refracted edges crisp while softening the backdrop detail. Keep the
					radius sub-pixel-ish — this glass is clear, not frosted.
				-->
				<feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blurred" />
			{/if}

			<feImage
				href={displacementMap.url}
				x="0"
				y="0"
				{width}
				{height}
				preserveAspectRatio="none"
				result="displacementField"
			/>

			{#if chromatic}
				<!--
					Chromatic aberration: displace three times at slightly different
					scales, keep one channel from each pass, recombine additively.
					Three passes over the backdrop, so this is `quality: 'high'` only.
				-->
				<feDisplacementMap
					in={refractionSource}
					in2="displacementField"
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
					in={refractionSource}
					in2="displacementField"
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
					in={refractionSource}
					in2="displacementField"
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
					in={refractionSource}
					in2="displacementField"
					scale={baseScale}
					xChannelSelector="R"
					yChannelSelector="G"
					result="refracted"
				/>
			{/if}

			<feColorMatrix
				in="refracted"
				type="saturate"
				values={String(saturation)}
				result="saturated"
			/>

			{#if specularMap}
				<!--
					The lit edge. A generated white hairline whose brightness follows the
					surface normal against a fixed light, screened over the refracted
					backdrop. `feFuncA` scales its alpha, which is what makes
					`specularIntensity` animatable without regenerating the texture.
				-->
				<feImage
					href={specularMap.url}
					x="0"
					y="0"
					{width}
					{height}
					preserveAspectRatio="none"
					result="specularField"
				/>
				<feComponentTransfer in="specularField" result="specularFaded">
					<feFuncA type="linear" slope={specularIntensity} />
				</feComponentTransfer>
				<feBlend in="specularFaded" in2="saturated" mode="screen" />
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
