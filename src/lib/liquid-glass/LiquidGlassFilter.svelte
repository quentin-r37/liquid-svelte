<script lang="ts">
	import type { GlassMap } from './liquidGlass.types.js';
	import {
		DISPLACEMENT_SCALE_FACTOR,
		FILTER_REGION_MARGIN,
		MAX_CHROMATIC_ABERRATION,
		RIM_ANTIALIAS_MAX,
		RIM_ANTIALIAS_PER_DISPLACEMENT
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
		/**
		 * Run the post-refraction rim antialias. Four primitives, plus the output pad
		 * and the region margin they need — see `QualityPreset.rimAntialias`, which is
		 * the only thing that sets this. Must not vary while a morph is animating the
		 * chain.
		 */
		rimAntialias?: boolean;
		/**
		 * Which way the profile throws its samples, from
		 * {@link getProfileReach} — the two fractions that size the source blur. Not
		 * derived here because the filter never sees the profile, only the map it
		 * produced.
		 */
		profileReach: { inward: number; outward: number };
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
		specularIntensity,
		rimAntialias = true,
		profileReach
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

	/**
	 * The rim antialias — see {@link RIM_ANTIALIAS_PER_DISPLACEMENT} for the whole
	 * argument. A live attribute riding `displacement`, so it fades in with the
	 * droplet morph and a resting knob filters nothing. The primitive stays in the
	 * chain at 0 (a passthrough) so the morph never restructures the filter.
	 */
	const rimBlur = $derived(
		rimAntialias
			? Math.min(RIM_ANTIALIAS_MAX, Math.max(0, displacement) * RIM_ANTIALIAS_PER_DISPLACEMENT)
			: 0
	);

	/**
	 * Output pad, in CSS pixels, for the refraction passes' primitive subregions.
	 *
	 * The enlarged filter region is an *input* requirement — displaced samples land
	 * outside the element — but no primitive after the source blur needs to
	 * *produce* pixels much beyond the border-box, because `backdrop-filter` clips
	 * the output to it. Left unbounded, every pass fills the whole region, which
	 * the margins make several times the element's area, per frame. The refraction
	 * results are still read past the box by the rim antialias blur (3σ, σ capped
	 * at {@link RIM_ANTIALIAS_MAX}), so they keep a pad covering that — and drop it
	 * entirely when that blur is not in the chain, which on a 132×76 tile halves
	 * what the refraction pass fills. Constant per quality preset, so a
	 * displacement animation never rewrites subregion attributes.
	 */
	const outputPad = $derived(rimAntialias ? Math.ceil(RIM_ANTIALIAS_MAX * 3) + 4 : 0);

	/**
	 * Peak offset a refraction pass can apply, in CSS pixels.
	 *
	 * The map's peak magnitude sits right at the outline (channel ≈ 1), so the
	 * worst case is `scale / 2` — i.e. `displacement` itself — inflated by the red
	 * pass under chromatic aberration.
	 */
	const peakOffset = $derived(displacement * (1 + aberration));

	/**
	 * Quantised to 16 so a displacement *animation* (the droplet morph) rewrites
	 * the region and subregion attributes a handful of times instead of sixty
	 * times a second.
	 */
	const quantiseReach = (value: number) => Math.ceil(Math.max(0, value) / 16) * 16;

	/**
	 * How far past the border-box the *blurred backdrop* has to exist, per axis.
	 *
	 * The source blur is the one primitive with no natural bound, and by fill rate
	 * it is the most expensive thing in the chain — a wide σ over an area the pads
	 * make several times the element's, on every frame the surface is refiltered.
	 * It is also most of what the `regular` variant is inside this chain: `clear`
	 * runs the same pass at σ 1.7 and `regular` at 6, and nothing else in the
	 * filter distinguishes them — the rest of the difference between the two
	 * materials is the veil, which is CSS and costs nothing here. So this number
	 * is most of the material's price.
	 *
	 * Three things read the blurred result, and the pad is the largest of them:
	 *
	 * • **The pad pixels of the refraction passes.** They now decode a *neutral*
	 *   field (see the `feFlood` below) and therefore sample themselves, so they
	 *   need the source out to `outputPad` and no further. Before that flood they
	 *   read transparent black, which `feDisplacementMap` decodes as −0.5 — a full
	 *   negative offset on both axes — and dragged this bound out to
	 *   `outputPad + peakOffset`. That single decode was, on a 132×76 tile, the
	 *   difference between the blur filling 6.9× the element's area and 2.7×.
	 *
	 * • **The blur's own kernel tail**, 3σ, without which the blurred pixels at the
	 *   border-box edge average in transparent black and the refraction reads a
	 *   darkened rim. Correctness is required over the box; the pad pixels beyond
	 *   it are clipped away and only exist so the rim antialias has something
	 *   plausible to low-pass, so they are allowed to thin out at the very edge —
	 *   which is the same tolerance the previous bound took when it clamped itself
	 *   below the region.
	 *
	 * • **The box pixels' own samples**, and this is where the profile comes in.
	 *   `createDisplacementMap` moves the sample along the *negated* outward
	 *   normal, so a positive LUT value pulls inwards; `convex-squircle` and
	 *   `convex-circle` are positive throughout and cannot throw a sample out of
	 *   the box at all. `concave` diverges outwards and needs the full
	 *   `peakOffset`, `lip` does both inside one bezel. Hence
	 *   {@link getProfileReach} rather than a blanket worst case — the default
	 *   profile was paying a concave profile's pad.
	 *
	 *   The inward term is not free either: a sample thrown further inwards than
	 *   the element is wide leaves through the far side, which is why it is
	 *   measured against the dimension rather than dropped. A deep bezel on a
	 *   short control is exactly that case.
	 *
	 * Per axis, because the inward overshoot is: a 40px-tall button with a 24px
	 * bezel overshoots vertically and not horizontally, and paying the vertical
	 * pad on both axes is how the old scalar bound quietly doubled the pass.
	 */
	const blurPadX = $derived(
		quantiseReach(
			Math.max(
				outputPad,
				blur * 3,
				peakOffset * profileReach.outward,
				peakOffset * profileReach.inward - width
			)
		)
	);
	const blurPadY = $derived(
		quantiseReach(
			Math.max(
				outputPad,
				blur * 3,
				peakOffset * profileReach.outward,
				peakOffset * profileReach.inward - height
			)
		)
	);

	/**
	 * How far past the border-box the filter *region* has to reach, per axis.
	 *
	 * Everything any primitive reads or writes has to fit inside it, and the
	 * outermost of those is the source blur: it writes `blurPad` and reads its own
	 * 3σ beyond that. The rim antialias blur reads `refracted` up to 3σ past the
	 * box, which `outputPad` already covers by construction, so it does not
	 * enlarge this.
	 */
	const reachX = $derived(quantiseReach(blurPadX + blur * 3 + 2));
	const reachY = $derived(quantiseReach(blurPadY + blur * 3 + 2));

	/**
	 * Region margins, per axis, in objectBoundingBox units.
	 *
	 * `FILTER_REGION_MARGIN` is a *floor*, not the whole story: a percentage margin
	 * scales with the box while the reach above is absolute, so a short element — a
	 * button is ~40px tall against a ~56px reach — sees its rim samples fall off
	 * the region's edge. Off-region resolves to transparent black, and because the
	 * three chromatic passes run at different scales they fall off one at a time,
	 * leaving a coloured hairline along the short axis. Growing the margin to cover
	 * the true reach costs fill rate on small surfaces; the output is still clipped
	 * to the border-box by `backdrop-filter`, so it never bleeds.
	 */
	const marginX = $derived(
		width > 0 ? Math.max(FILTER_REGION_MARGIN, reachX / width) : FILTER_REGION_MARGIN
	);
	const marginY = $derived(
		height > 0 ? Math.max(FILTER_REGION_MARGIN, reachY / height) : FILTER_REGION_MARGIN
	);

	const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

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

	• The enlarged region (`-50% / 200%` at minimum, grown per axis to cover what
	  the passes actually reach — see `reachX`). Near the rim the displacement
	  reaches several dozen pixels, so the sample point lands outside the element.
	  Anything outside the filter region resolves to transparent black, which shows
	  up as a dead, washed-out edge — or, with the chromatic passes falling off one
	  scale at a time, a coloured hairline. `backdrop-filter` clips the *output* to
	  the border-box regardless, so a generous region never bleeds — it is paid for
	  in fill rate alone, which is why the reach is derived rather than padded.

	• `primitiveUnits="userSpaceOnUse"` — lets the feImage and the flood beneath it
	  be positioned in CSS pixels at the element's origin even though the region is
	  larger.
-->
<svg class="lg-filter-host" aria-hidden="true" focusable="false">
	<defs>
		<filter
			{id}
			x={percent(-marginX)}
			y={percent(-marginY)}
			width={percent(1 + marginX * 2)}
			height={percent(1 + marginY * 2)}
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

					Subregion, unlike every pass below it, is *larger* than the box: the
					displacement reads this result from outside itself. See `blurPadX`
					for what sets it, per axis, and why it is nevertheless well inside
					the region.
				-->
				<feGaussianBlur
					in="SourceGraphic"
					stdDeviation={blur}
					x={-blurPadX}
					y={-blurPadY}
					width={width + blurPadX * 2}
					height={height + blurPadY * 2}
					result="blurred"
				/>
			{/if}

			{#if outputPad > 0}
				<!--
					A neutral field under the map, covering the pad the refraction passes
					output into.

					Out of a primitive's subregion, SVG says transparent black — and
					`feDisplacementMap` decodes a zero channel as −0.5, i.e. a *full
					negative offset on both axes*, not "no shift". So every pad pixel used
					to reach `peakOffset` up and to the left for a sample, purely because
					the map stopped at the border-box, and the source blur had to be grown
					by that whole distance to feed reads whose results are then masked to
					the bezel band and clipped away. Flooding the pad with the 128/128
					neutral the map itself uses for its flat centre makes those pixels
					sample themselves, which is both what they should do and what makes
					`blurPadX` collapse to the pad.

					Only when there *is* a pad: with the rim antialias off the refraction
					passes output the box exactly and there is nothing to flood. That is a
					quality-preset flag, fixed per surface, so this cannot restructure the
					chain mid-morph — the same reason the antialias block below may be an
					`{#if}` at all.

					Blue is 0, matching the flat centre: it is the rim-antialias mask, and
					the mask primitive is subregioned to the box regardless.
				-->
				<feFlood
					flood-color="rgb(128,128,0)"
					flood-opacity="1"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="fieldPad"
				/>
				<feImage
					href={displacementMap.url}
					x="0"
					y="0"
					{width}
					{height}
					preserveAspectRatio="none"
					result="fieldMap"
				/>
				<feComposite
					in="fieldMap"
					in2="fieldPad"
					operator="over"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="displacementField"
				/>
			{:else}
				<feImage
					href={displacementMap.url}
					x="0"
					y="0"
					{width}
					{height}
					preserveAspectRatio="none"
					result="displacementField"
				/>
			{/if}

			{#if chromatic}
				<!--
					Chromatic aberration: displace three times at slightly different
					scales, keep one channel from each pass, recombine additively.
					Three passes over the backdrop, so this is `quality: 'high'` only.

					Every primitive from here on carries an explicit subregion — the
					refraction passes at box + outputPad (the rim antialias reads them
					past the box edge), everything after the antialias at the box itself.
					The enlarged region is for their *inputs*; producing pixels the
					border-box clip then discards is pure fill-rate waste, several box
					areas' worth per pass per frame. See outputPad.
				-->
				<feDisplacementMap
					in={refractionSource}
					in2="displacementField"
					scale={scaleRed}
					xChannelSelector="R"
					yChannelSelector="G"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="passRed"
				/>
				<feColorMatrix
					in="passRed"
					type="matrix"
					values="1 0 0 0 0
					        0 0 0 0 0
					        0 0 0 0 0
					        0 0 0 1 0"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="channelRed"
				/>

				<feDisplacementMap
					in={refractionSource}
					in2="displacementField"
					scale={baseScale}
					xChannelSelector="R"
					yChannelSelector="G"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="passGreen"
				/>
				<feColorMatrix
					in="passGreen"
					type="matrix"
					values="0 0 0 0 0
					        0 1 0 0 0
					        0 0 0 0 0
					        0 0 0 1 0"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="channelGreen"
				/>

				<feDisplacementMap
					in={refractionSource}
					in2="displacementField"
					scale={scaleBlue}
					xChannelSelector="R"
					yChannelSelector="G"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="passBlue"
				/>
				<feColorMatrix
					in="passBlue"
					type="matrix"
					values="0 0 0 0 0
					        0 0 0 0 0
					        0 0 1 0 0
					        0 0 0 1 0"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="channelBlue"
				/>

				<feBlend
					in="channelRed"
					in2="channelGreen"
					mode="screen"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="channelRedGreen"
				/>
				<feBlend
					in="channelRedGreen"
					in2="channelBlue"
					mode="screen"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="refracted"
				/>
			{:else}
				<feDisplacementMap
					in={refractionSource}
					in2="displacementField"
					scale={baseScale}
					xChannelSelector="R"
					yChannelSelector="G"
					x={-outputPad}
					y={-outputPad}
					width={width + outputPad * 2}
					height={height + outputPad * 2}
					result="refracted"
				/>
			{/if}

			{#if rimAntialias}
				<!--
					Rim antialiasing. `feDisplacementMap` point-samples, and near the outline
					the field is steep enough to sample the backdrop below Nyquist — thin
					detail behind the rim comes out as stepped speckle, and the chromatic
					passes decorrelate it into coloured sparkle. So the refracted result is
					low-passed and composited back *only inside the bezel band*, using the
					magnitude the map itself carries in its blue channel as the mask. The
					flat centre keeps the untouched refraction; see
					RIM_ANTIALIAS_PER_DISPLACEMENT for why this is not the pre-blur's job.

					Four primitives, which on a chain that is otherwise four long is why the
					`low` preset drops them wholesale rather than shaving a σ — and dropping
					them takes `outputPad` and part of the region with it. `quality` is fixed
					per surface, so this `{#if}` cannot flip while a morph is running.

					From here down every primitive carries an explicit x/y/width/height
					subregion pinned to the element's box. The enlarged filter region exists
					for the *inputs* — displaced samples land well outside the element — but
					`backdrop-filter` clips the output to the border-box, so any pixel these
					primitives produce outside it is thrown away. Without the subregion each
					one fills the whole region, which the margins make several times the
					element's area, every frame. `refracted` itself keeps its pad: the blur
					reads it past the box edge (up to 3σ), and starving that read would ring
					the rim with a half-transparent seam.
				-->
				<feColorMatrix
					in="displacementField"
					type="matrix"
					values="0 0 0 0 0
					        0 0 0 0 0
					        0 0 0 0 0
					        0 0 1 0 0"
					x="0"
					y="0"
					{width}
					{height}
					result="rimMask"
				/>
				<feGaussianBlur
					in="refracted"
					stdDeviation={rimBlur}
					x="0"
					y="0"
					{width}
					{height}
					result="rimSoft"
				/>
				<feComposite
					in="rimSoft"
					in2="rimMask"
					operator="in"
					x="0"
					y="0"
					{width}
					{height}
					result="rimBand"
				/>
				<feComposite
					in="rimBand"
					in2="refracted"
					operator="over"
					x="0"
					y="0"
					{width}
					{height}
					result="antialiased"
				/>
			{/if}

			<feColorMatrix
				in={rimAntialias ? 'antialiased' : 'refracted'}
				type="saturate"
				values={String(saturation)}
				x="0"
				y="0"
				{width}
				{height}
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
				<feComponentTransfer in="specularField" x="0" y="0" {width} {height} result="specularFaded">
					<feFuncA type="linear" slope={specularIntensity} />
				</feComponentTransfer>
				<feBlend in="specularFaded" in2="saturated" mode="screen" x="0" y="0" {width} {height} />
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
