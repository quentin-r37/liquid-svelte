import type { DocMeta } from '../types.js';

const meta: DocMeta = {
	slug: 'liquid-glass-filter',
	title: 'LiquidGlassFilter',
	description:
		'The raw <svg><filter> chain LiquidGlass drives — exported for advanced consumers who generate and manage their own displacement maps and reference the filter from backdrop-filter: url(#id) themselves.',
	body: [
		'The chain blurs the backdrop before refracting it (blurring after smears the distortion), displaces it through the map — three passes at slightly different scales when chromaticAberration is non-zero — low-passes the rim band, saturates, and screens the specular hairline on top. Everything the props control after the maps are made is a live filter attribute, animatable per frame without regenerating a texture. The structural props (rimAntialias, the presence of a specularMap, blur crossing zero) add and remove primitives, so they must stay fixed while a morph is animating the chain.',
		'The SVG host is collapsed to a zero-sized clipped box rather than display: none, which would let Chromium drop the filter subtree and silently resolve the backdrop-filter to nothing. The filter region is enlarged per axis to cover how far the displaced samples actually reach — off-region samples resolve to transparent black and show up as a dead edge or a coloured hairline.'
	],
	demos: [],
	props: [
		{
			name: 'id',
			type: 'string',
			description: 'Filter id, unique per glass instance; referenced by backdrop-filter: url(#…).'
		},
		{
			name: 'displacementMap',
			type: 'GlassMap',
			description:
				'The generated displacement texture, fed to <feImage href> and stretched into the element box.'
		},
		{
			name: 'width',
			type: 'number',
			description: 'Element width in CSS pixels — the user-space box the maps are stretched into.'
		},
		{
			name: 'height',
			type: 'number',
			description: 'Element height in CSS pixels.'
		},
		{
			name: 'displacement',
			type: 'number',
			description: 'Peak refraction offset in CSS pixels.'
		},
		{
			name: 'chromaticAberration',
			type: 'number',
			description: 'Per-channel displacement spread; 0 collapses the chain to a single pass.'
		},
		{
			name: 'blur',
			type: 'number',
			description: 'feGaussianBlur stdDeviation applied before refraction; 0 skips the primitive.'
		},
		{
			name: 'saturation',
			type: 'number',
			description: 'feColorMatrix type="saturate" amount; 1 leaves colours untouched.'
		},
		{
			name: 'specularIntensity',
			type: 'number',
			description:
				'feFuncA slope applied to the specular map, 0–1 — animatable without regenerating the texture.'
		},
		{
			name: 'profileReach',
			type: '{ inward: number; outward: number }',
			description:
				'Which way the profile throws its samples, from getProfileReach — the two fractions that size the source blur, since the filter never sees the profile, only the map it produced.'
		},
		{
			name: 'specularMap',
			type: 'GlassMap | null',
			default: 'null',
			description: 'Omit to skip the specular pass (quality "low").'
		},
		{
			name: 'rimAntialias',
			type: 'boolean',
			default: 'true',
			description:
				'Run the post-refraction rim antialias — four primitives plus their output pad. Must not vary while a morph is animating the chain.'
		}
	]
};

export default meta;
