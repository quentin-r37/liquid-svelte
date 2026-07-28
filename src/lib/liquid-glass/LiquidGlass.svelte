<script lang="ts">
	import LiquidGlassFilter from './LiquidGlassFilter.svelte';
	import { cornerShapeCss } from './displacement/cornerShape.js';
	import { getDisplacementMap } from './displacement/createDisplacementMap.js';
	import { getSpecularMap, specularWidthFor } from './displacement/createSpecularMap.js';
	import { quantiseSize } from './displacement/mapCache.js';
	import type { LiquidGlassProps } from './liquidGlass.types.js';
	import { setGlassProperties } from './runtime/applyGlassStyle.js';
	import {
		glassSupport,
		reducedMotion,
		resolveGlassSupport,
		resolveTier
	} from './runtime/capabilities.svelte.js';
	import { devicePixelRatio, resolveDevicePixelRatio } from './runtime/devicePixelRatio.svelte.js';
	import {
		DISPLACEMENT_PER_BEZEL,
		GLASS_DEFAULTS,
		MATERIAL_VARIANTS,
		QUALITY_PRESETS
	} from './runtime/glassTokens.js';
	import { trackPointer } from './runtime/pointerTracking.js';
	import { observeSize } from './runtime/sharedResizeObserver.js';
	import './liquidGlass.css';

	let {
		width,
		height,
		borderRadius = GLASS_DEFAULTS.borderRadius,
		cornerShape = GLASS_DEFAULTS.cornerShape,
		bezel = GLASS_DEFAULTS.bezel,
		displacement,
		variant = GLASS_DEFAULTS.variant,
		// No defaults on the three material optics: `undefined` means "the
		// variant's value", resolved below, and a default here would shadow it.
		blur,
		opacity,
		saturation,
		chromaticAberration = GLASS_DEFAULTS.chromaticAberration,
		specularIntensity = GLASS_DEFAULTS.specularIntensity,
		specularWidth,
		shadowIntensity = GLASS_DEFAULTS.shadowIntensity,
		profile = GLASS_DEFAULTS.profile,
		quality = GLASS_DEFAULTS.quality,
		mode = 'auto',
		interactive = false,
		disabled = false,
		tag = 'div',
		type,
		element = $bindable(null),
		class: className = '',
		style = '',
		children,
		...rest
	}: LiquidGlassProps = $props();

	/**
	 * One id per instance, stable across SSR and hydration. This is what lets an
	 * arbitrary number of glass surfaces coexist without their SVG filters
	 * colliding.
	 */
	const instanceId = $props.id();
	const filterId = `lg-filter-${instanceId}`;

	const preset = $derived(QUALITY_PRESETS[quality]);
	const requestedTier = $derived(resolveTier(mode));

	/**
	 * The material's optics: the variant supplies the defaults, an explicit prop
	 * wins. This is the entire mechanism behind `regular` vs `clear` — no other
	 * part of the pipeline knows the variant exists, which is what keeps the
	 * droplet morphs (which pass all three explicitly) outside the switch.
	 */
	const material = $derived(MATERIAL_VARIANTS[variant]);
	const effectiveBlur = $derived(blur ?? material.blur);
	const effectiveOpacity = $derived(opacity ?? material.opacity);
	const effectiveSaturation = $derived(saturation ?? material.saturation);

	// Detection is client-only and idempotent, so the first client render matches
	// the server output and hydration stays quiet.
	$effect(resolveGlassSupport);

	// Same shape, and for the same reason: reading the ratio during SSR would be a
	// guess, so it stays at 1 until the client says otherwise. Both effects flush
	// together, and the `full` tier this feeds is gated on the one above, so the
	// specular map is never rasterised at the placeholder ratio.
	$effect(resolveDevicePixelRatio);

	/** Measured border-box size, quantised so sub-pixel resize noise is inert. */
	let measured = $state({ width: 0, height: 0 });

	const needsMeasure = $derived(
		requestedTier === 'full' && (width === undefined || height === undefined)
	);

	$effect(() => {
		if (!element || !needsMeasure) return;

		// Tracked in closure rather than read back from `measured`, so this effect
		// never depends on the state it writes.
		let lastWidth = -1;
		let lastHeight = -1;

		return observeSize(element, (observedWidth, observedHeight) => {
			const w = quantiseSize(observedWidth);
			const h = quantiseSize(observedHeight);
			if (w === lastWidth && h === lastHeight) return;
			lastWidth = w;
			lastHeight = h;
			measured = { width: w, height: h };
		});
	});

	const resolvedWidth = $derived(width ?? measured.width);
	const resolvedHeight = $derived(height ?? measured.height);
	const hasGeometry = $derived(resolvedWidth > 0 && resolvedHeight > 0);

	/** Geometry clamps, shared by the CSS variables and the map generators. */
	const limit = $derived(hasGeometry ? Math.min(resolvedWidth, resolvedHeight) / 2 : 0);
	const clampedRadius = $derived(hasGeometry ? Math.min(borderRadius, limit) : borderRadius);
	const clampedBezel = $derived(hasGeometry ? Math.min(bezel, limit) : bezel);

	/**
	 * Whether a *capsule* was asked for — a saturated radius on a box that is not
	 * square.
	 *
	 * This is a geometric law rather than a style preference, and it is the reason the
	 * iOS convention needs no per-component opt-in. When the radius reaches half the
	 * shorter side, that axis is fully consumed while the longer one still has straight
	 * edge left over, and the only curve that meets those flats without a corner is the
	 * semicircle. A superellipse there is not a fully-rounded end, it is a lozenge with
	 * flat sides — so the shape is demoted to `round` whatever `cornerShape` says. That
	 * catches every button, switch knob, slider thumb, pill tab and lens in the library
	 * without any of them asking.
	 *
	 * A *square* saturated box is excluded, and that exclusion matters: there both axes
	 * are consumed, so `round` gives a circle and `squircle` gives the app-icon
	 * superellipse. Both are real shapes and iOS uses both — a circular icon button is
	 * a circle, an app icon is not — so geometry cannot pick, and the choice stays with
	 * the caller. `LiquidButton` makes it for its own circles.
	 *
	 * Before measurement this reads `true`, deliberately. Auto-sized surfaces are
	 * overwhelmingly buttons, and one frame of a square-ended pill is obvious where one
	 * frame of a round-cornered card is not. Surfaces given explicit `width`/`height`
	 * never see it, having geometry on the first render.
	 */
	const isCapsule = $derived(
		!hasGeometry || (clampedRadius >= limit && resolvedWidth !== resolvedHeight)
	);

	/**
	 * The corner the surface will actually be *clipped* to — which is the only
	 * corner the maps may be built for.
	 *
	 * Resolving in one place, before either the field or the stylesheet sees the
	 * value, is what makes the two incapable of disagreeing. Doing it separately
	 * would produce the failure this whole feature has to avoid: a squircle field
	 * inside a circular clip, which leaves four crescents of unrefracted backdrop at
	 * the corners, on exactly the browsers nobody tests on.
	 */
	const effectiveCornerShape = $derived(
		glassSupport.cornerShape && !isCapsule ? cornerShape : 'round'
	);

	/**
	 * A fixed pixel figure stops looking right the moment the bezel changes, so the
	 * default scales with it. The multiplier is large by design — see
	 * `DISPLACEMENT_PER_BEZEL`.
	 */
	const effectiveDisplacement = $derived(displacement ?? clampedBezel * DISPLACEMENT_PER_BEZEL);

	/** Chromatic aberration is a 3-pass chain, so the quality preset gates it. */
	const effectiveAberration = $derived(preset.chromatic ? chromaticAberration : 0);

	/**
	 * The maps are rebuilt only when quantised geometry, profile or resolution
	 * change. Displacement strength, blur, saturation, aberration and specular
	 * intensity are all live filter attributes, so those props can be animated
	 * without ever touching the canvas.
	 */
	const displacementMap = $derived(
		requestedTier === 'full' && hasGeometry
			? getDisplacementMap({
					width: resolvedWidth,
					height: resolvedHeight,
					radius: clampedRadius,
					cornerShape: effectiveCornerShape,
					bezel: clampedBezel,
					profile,
					resolution: preset.resolution
				})
			: null
	);

	const specularMap = $derived(
		requestedTier === 'full' && hasGeometry && preset.specular
			? getSpecularMap({
					width: resolvedWidth,
					height: resolvedHeight,
					radius: clampedRadius,
					cornerShape: effectiveCornerShape,
					rimWidth: specularWidth ?? specularWidthFor(clampedBezel),
					// Part of the cache key, and legitimately so: the ratio only moves
					// when the user zooms or the window changes monitor, so this stays on
					// the geometry side of the regenerate/animate line.
					pixelRatio: devicePixelRatio.current
				})
			: null
	);

	/**
	 * Fall back to the degraded backdrop while a `full` surface is still measuring
	 * or rasterising, so the glass is never momentarily invisible.
	 */
	const tier = $derived(requestedTier === 'full' && !displacementMap ? 'degraded' : requestedTier);

	const backdrop = $derived.by(() => {
		if (tier === 'full') return `url(#${filterId})`;
		// The SVG chain carries blur and saturation for the full tier; the degraded
		// tier has to express them as CSS filter functions. A `clear`-scale blur
		// (well under 3px) is raised a long way, because without refraction it is
		// all that separates the glass from its backdrop; a `regular`-scale one is
		// already a frost and is used as-is — ×12 would turn it into fog.
		if (tier === 'degraded') {
			const radius = effectiveBlur < 3 ? Math.max(6, effectiveBlur * 12) : effectiveBlur;
			return `blur(${radius}px) saturate(${effectiveSaturation})`;
		}
		return 'none';
	});

	const glassStyle = $derived({
		'--lg-radius': `${clampedRadius}px`,
		'--lg-corner-shape': cornerShapeCss(effectiveCornerShape),
		'--lg-bezel': `${clampedBezel}px`,
		'--lg-tint': String(effectiveOpacity),
		'--lg-specular': String(specularIntensity),
		'--lg-shadow': String(shadowIntensity),
		'--lg-backdrop': backdrop,
		width: width === undefined ? undefined : `${width}px`,
		height: height === undefined ? undefined : `${height}px`
	});

	// Overwrites in place rather than tearing down, so animating any of these — as
	// the droplet morph does — never momentarily drops `width`/`height`.
	$effect(() => {
		if (element) setGlassProperties(element, glassStyle);
	});

	const trackingOptions = $derived({
		enabled: interactive && !disabled,
		suppressVelocity: reducedMotion.current
	});
</script>

<svelte:element
	this={tag}
	bind:this={element}
	class={`lg ${className}`}
	style={style || undefined}
	data-tier={tier}
	data-disabled={disabled ? 'true' : undefined}
	disabled={tag === 'button' && disabled ? true : undefined}
	type={tag === 'button' ? (type ?? 'button') : type}
	{@attach trackPointer(trackingOptions)}
	{...rest}
>
	{#if tier === 'full' && displacementMap}
		<LiquidGlassFilter
			id={filterId}
			{displacementMap}
			{specularMap}
			width={resolvedWidth}
			height={resolvedHeight}
			displacement={effectiveDisplacement}
			chromaticAberration={effectiveAberration}
			blur={effectiveBlur}
			saturation={effectiveSaturation}
			{specularIntensity}
			rimAntialias={preset.rimAntialias}
		/>
	{/if}

	<!--
		No refraction layer: `backdrop-filter` is on the host element, because a
		transformed ancestor kills it in Chromium and the host is what every gesture
		transforms. See the header of liquidGlass.css.
	-->
	<div class="lg-layer lg-tint"></div>
	<div class="lg-layer lg-edge"></div>
	<div class="lg-layer lg-specular"></div>

	<div class="lg-content">
		{@render children?.()}
	</div>
</svelte:element>
