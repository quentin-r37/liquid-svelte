<script lang="ts">
	import LiquidGlassFilter from './LiquidGlassFilter.svelte';
	import { getDisplacementMap } from './displacement/createDisplacementMap.js';
	import { getSpecularMap, specularWidthFor } from './displacement/createSpecularMap.js';
	import { quantiseSize } from './displacement/mapCache.js';
	import type { LiquidGlassProps } from './liquidGlass.types.js';
	import { setGlassProperties } from './runtime/applyGlassStyle.js';
	import {
		reducedMotion,
		resolveGlassSupport,
		resolveTier
	} from './runtime/capabilities.svelte.js';
	import {
		DISPLACEMENT_PER_BEZEL,
		GLASS_DEFAULTS,
		QUALITY_PRESETS
	} from './runtime/glassTokens.js';
	import { trackPointer } from './runtime/pointerTracking.js';
	import { observeSize } from './runtime/sharedResizeObserver.js';
	import './liquidGlass.css';

	let {
		width,
		height,
		borderRadius = GLASS_DEFAULTS.borderRadius,
		bezel = GLASS_DEFAULTS.bezel,
		displacement,
		blur = GLASS_DEFAULTS.blur,
		opacity = GLASS_DEFAULTS.opacity,
		saturation = GLASS_DEFAULTS.saturation,
		chromaticAberration = GLASS_DEFAULTS.chromaticAberration,
		specularIntensity = GLASS_DEFAULTS.specularIntensity,
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

	// Detection is client-only and idempotent, so the first client render matches
	// the server output and hydration stays quiet.
	$effect(resolveGlassSupport);

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
					rimWidth: specularWidthFor(clampedBezel)
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
		// tier has to express them as CSS filter functions. The radius is raised a
		// long way because without refraction the blur is all that separates the
		// glass from its backdrop.
		if (tier === 'degraded') return `blur(${Math.max(6, blur * 12)}px) saturate(${saturation})`;
		return 'none';
	});

	const glassStyle = $derived({
		'--lg-radius': `${clampedRadius}px`,
		'--lg-bezel': `${clampedBezel}px`,
		'--lg-tint': String(opacity),
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
			{blur}
			{saturation}
			{specularIntensity}
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
