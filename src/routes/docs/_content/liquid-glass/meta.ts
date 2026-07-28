import type { DocMeta } from '../types.js';
import Profiles from './demos/Profiles.svelte';
import Variants from './demos/Variants.svelte';

const meta: DocMeta = {
	slug: 'liquid-glass',
	title: 'LiquidGlass',
	description:
		'The glass primitive every other component composes. Content goes in through a snippet; the geometry and optics of the material are typed props.',
	body: [
		'The props split into two groups, and the split is the invariant that makes the library fast. Geometry — width, height, borderRadius, cornerShape, bezel, profile, and the map resolution the quality preset picks — is the cache key of the rasterised displacement map: change any of it and a texture is generated (LRU-cached, size-quantised so a continuous resize steps rather than thrashes). Optics — displacement, blur, saturation, chromaticAberration, specularIntensity, opacity — are live filter attributes: animating them never touches a canvas, which is what makes the 60fps droplet morphs viable. Keep anything you animate on the optics side of that line.',
		'Rendering resolves to one of three tiers per instance. full is the SVG displacement filter referenced from backdrop-filter: url(#…) — Chromium only. degraded is plain backdrop-filter: blur() saturate(), and is also the SSR tier so server and client markup agree. flat drops backdrop filtering entirely and a denser tint carries legibility. mode="auto" follows capability detection — a heuristic, since Firefox and WebKit claim support for filter URLs and then paint nothing — and can be overridden per instance via mode or globally via setGlassModeOverride().',
		'The variant supplies defaults for blur, opacity and saturation — regular is the frosted material iOS builds its controls from, clear the transparent one it floats over media — and any of those props set explicitly wins over it.'
	],
	demos: [
		{
			id: 'profiles',
			title: 'Surface profiles',
			note: 'Four tiles varying profile — the height of the glass surface across the bezel, whose slope is what bends the light — plus one with the chromatic aberration pushed up (visible at quality "high").',
			component: Profiles,
			stage: { height: '22rem' }
		},
		{
			id: 'variants',
			title: 'Material variants',
			note: 'regular is the frosted control material; clear keeps the backdrop legible and lets the distortion do the visual work.',
			component: Variants
		}
	],
	props: [
		{
			name: 'width',
			type: 'number',
			description:
				'Fixed width in CSS pixels; omit to size from content and measure via ResizeObserver.'
		},
		{
			name: 'height',
			type: 'number',
			description:
				'Fixed height in CSS pixels; omit to size from content and measure via ResizeObserver.'
		},
		{
			name: 'borderRadius',
			type: 'number',
			default: '28',
			description: 'Corner radius in CSS pixels; large values are clamped to a pill shape.'
		},
		{
			name: 'cornerShape',
			type: "'round' | 'continuous' | 'squircle' | number",
			default: "'continuous'",
			description:
				"Corner outline — continuous is Apple's corner curve, a number is superellipse() K. Silently stays round without corner-shape support, so maps and CSS always agree."
		},
		{
			name: 'bezel',
			type: 'number',
			default: '24',
			description: 'Thickness of the refracting rim in CSS pixels; refraction is concentrated here.'
		},
		{
			name: 'variant',
			type: "'regular' | 'clear'",
			default: "'regular'",
			description:
				'Material: regular is the frosted control material, clear the transparent over-media one. Supplies the defaults for blur, opacity and saturation.'
		},
		{
			name: 'displacement',
			type: 'number',
			default: 'bezel × 4',
			description:
				'Peak refraction offset in CSS pixels at the outer edge. The derived default keeps the effect right across sizes — expect large numbers, a 24px bezel wants ~96px.'
		},
		{
			name: 'blur',
			type: 'number',
			default: '5 regular / 1.7 clear',
			description:
				'Backdrop blur radius in pixels, applied before refraction; defaults from the variant.'
		},
		{
			name: 'opacity',
			type: 'number',
			default: '0.27 regular / 0.05 clear',
			description: 'Opacity of the tint layer, 0–1; defaults from the variant.'
		},
		{
			name: 'saturation',
			type: 'number',
			default: '1.05 regular / 1.3 clear',
			description:
				'Backdrop saturation multiplier — 1 leaves colours untouched; defaults from the variant.'
		},
		{
			name: 'chromaticAberration',
			type: 'number',
			default: '0.04',
			description:
				'Per-channel displacement spread, 0–0.2. 0 disables the 3-pass chain; only quality "high" runs it.'
		},
		{
			name: 'specularIntensity',
			type: 'number',
			default: '0.35',
			description: 'Strength of the specular rim highlight, 0–1. A live attribute, safe to animate.'
		},
		{
			name: 'specularWidth',
			type: 'number',
			default: 'bezel × 0.09, clamped 1.5–4',
			description:
				"Width of the generated specular rim in CSS pixels. Part of the specular map's cache key — set it, don't animate it."
		},
		{
			name: 'shadowIntensity',
			type: 'number',
			default: '0.5',
			description: 'Strength of the outer drop shadow, 0–1.'
		},
		{
			name: 'profile',
			type: "'convex-squircle' | 'convex-circle' | 'concave' | 'lip'",
			default: "'convex-squircle'",
			description:
				'Height profile of the glass surface across the bezel; its slope, not its height, drives the refraction magnitude.'
		},
		{
			name: 'quality',
			type: "'low' | 'medium' | 'high'",
			default: "'medium'",
			description:
				'Map resolution and filter complexity; high enables chromatic aberration and full-resolution maps.'
		},
		{
			name: 'mode',
			type: "'auto' | 'full' | 'degraded' | 'flat'",
			default: "'auto'",
			description: 'Force a rendering tier; auto follows capability detection.'
		},
		{
			name: 'interactive',
			type: 'boolean',
			default: 'false',
			description: 'Track the pointer and expose --pointer-* / --highlight-* custom properties.'
		},
		{
			name: 'disabled',
			type: 'boolean',
			default: 'false',
			description:
				'Stops pointer tracking, marks the surface via data-disabled, and disables a tag="button" host.'
		},
		{
			name: 'tag',
			type: 'keyof HTMLElementTagNameMap',
			default: "'div'",
			description: 'Host element tag — button, label, … so wrappers keep native semantics.'
		},
		{
			name: 'type',
			type: "'button' | 'submit' | 'reset'",
			default: "'button' when tag='button'",
			description: 'Forwarded to the host; a glass button needs one to avoid defaulting to submit.'
		},
		{
			name: 'element',
			type: 'HTMLElement | null (bindable)',
			description: 'Bindable reference to the host element.'
		},
		{
			name: 'class',
			type: 'string',
			description: 'Extra classes on the host element.'
		},
		{
			name: 'style',
			type: 'string',
			description:
				'Consumer inline styles — the one sanctioned way in, since the library writes its own inline properties via setProperty.'
		},
		{
			name: 'children',
			type: 'Snippet',
			description: 'Content rendered on the flat centre of the glass.'
		},
		{
			name: '…HTMLAttributes',
			type: 'HTMLAttributes<HTMLElement>',
			description: 'Everything else lands on the host element.'
		}
	]
};

export default meta;
