<script lang="ts">
	import LiquidGlassFilter from './LiquidGlassFilter.svelte';
	import { getDisplacementMap, quantiseSize } from './displacement/createDisplacementMap.js';
	import type { LiquidGlassProps } from './liquidGlass.types.js';
	import { applyGlassStyle } from './runtime/applyGlassStyle.js';
	import {
		reducedMotion,
		resolveGlassSupport,
		resolveTier
	} from './runtime/capabilities.svelte.js';
	import { GLASS_DEFAULTS, QUALITY_PRESETS } from './runtime/glassTokens.js';
	import { trackPointer } from './runtime/pointerTracking.js';
	import { observeSize } from './runtime/sharedResizeObserver.js';
	import './liquidGlass.css';

	let {
		width,
		height,
		borderRadius = GLASS_DEFAULTS.borderRadius,
		bezel = GLASS_DEFAULTS.bezel,
		displacement = GLASS_DEFAULTS.displacement,
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

	/** Geometry clamps, shared by the CSS variables and the map generator. */
	const limit = $derived(hasGeometry ? Math.min(resolvedWidth, resolvedHeight) / 2 : 0);
	const clampedRadius = $derived(hasGeometry ? Math.min(borderRadius, limit) : borderRadius);
	const clampedBezel = $derived(hasGeometry ? Math.min(bezel, limit) : bezel);

	/**
	 * Chromatic aberration is a 3-pass chain, so it is gated on the quality preset
	 * rather than on the prop alone.
	 */
	const effectiveAberration = $derived(preset.chromatic ? chromaticAberration : 0);

	/**
	 * The map is rebuilt only when quantised geometry, profile or resolution
	 * change. Displacement strength, blur, saturation and aberration are live
	 * filter attributes, so those props can be animated without ever touching the
	 * canvas.
	 */
	const map = $derived(
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

	/**
	 * Fall back to the degraded backdrop while a `full` surface is still measuring
	 * or rasterising, so the glass is never momentarily invisible.
	 */
	const tier = $derived(requestedTier === 'full' && !map ? 'degraded' : requestedTier);

	const backdrop = $derived.by(() => {
		if (tier === 'full') return `url(#${filterId})`;
		// The SVG chain carries blur and saturation for the full tier; the degraded
		// tier has to express them as CSS filter functions. Doubling the radius
		// compensates for the loss of refraction, which normally does much of the
		// visual work of separating the glass from its backdrop.
		if (tier === 'degraded') return `blur(${blur * 2}px) saturate(${saturation})`;
		return 'none';
	});

	const glassStyle = $derived({
		'--lg-radius': `${clampedRadius}px`,
		'--lg-bezel': `${clampedBezel}px`,
		'--lg-blur': `${blur}px`,
		'--lg-tint': String(opacity),
		'--lg-saturation': String(saturation),
		'--lg-specular': String(specularIntensity),
		'--lg-shadow': String(shadowIntensity),
		'--lg-backdrop': backdrop,
		width: width === undefined ? undefined : `${width}px`,
		height: height === undefined ? undefined : `${height}px`
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
	{@attach applyGlassStyle(glassStyle)}
	{@attach trackPointer(trackingOptions)}
	{...rest}
>
	{#if tier === 'full' && map}
		<LiquidGlassFilter
			id={filterId}
			{map}
			width={resolvedWidth}
			height={resolvedHeight}
			{displacement}
			chromaticAberration={effectiveAberration}
			{blur}
			{saturation}
		/>
	{/if}

	{#if tier !== 'flat'}
		<div class="lg-layer lg-refraction"></div>
	{/if}
	<div class="lg-layer lg-tint"></div>
	<div class="lg-layer lg-edge"></div>
	<div class="lg-layer lg-specular"></div>

	<div class="lg-content">
		{@render children?.()}
	</div>
</svelte:element>
