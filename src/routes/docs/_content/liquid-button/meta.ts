import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';
import Shapes from './demos/Shapes.svelte';

const meta: DocMeta = {
	slug: 'liquid-button',
	title: 'LiquidButton',
	description:
		'A pill or circular glass button on a native <button>. Motion press covers keyboard activation, so Space and Enter compress it exactly like a click.',
	demos: [
		{
			id: 'basic',
			title: 'Sizes and tones',
			note: 'Three sizes on the 30/38/46 ladder, a prominent tone for the primary action, and the disabled state.',
			component: Basic
		},
		{
			id: 'shapes',
			title: 'Circles',
			note: 'shape="circle" lays the button out at a literal diameter rather than padding a pill, so every circle of a size shares one rasterised displacement map.',
			component: Shapes
		}
	],
	props: [
		{
			name: 'tone',
			type: "'plain' | 'prominent'",
			default: "'plain'",
			description: 'Prominent fills the glass with the accent tint for the primary action.'
		},
		{
			name: 'size',
			type: "'sm' | 'md' | 'lg'",
			default: "'md'",
			description: 'Height ladder 30/38/46px, shared with the search field and toolbar.'
		},
		{
			name: 'shape',
			type: "'pill' | 'circle'",
			default: "'pill'",
			description:
				'Circle is laid out at a fixed diameter per size; put an icon inside and label it via aria-label.'
		},
		{
			name: 'variant',
			type: "'regular' | 'clear'",
			default: "'regular'",
			description:
				'Material: regular is the frosted iOS control material, clear the transparent over-media one.'
		},
		{
			name: 'borderRadius',
			type: 'number',
			default: '999',
			description: 'Saturates into a capsule by default.'
		},
		{
			name: 'cornerShape',
			type: "'round' | 'continuous' | 'squircle' | number",
			description:
				'Pinned to round for pills and circles unless overridden — a capsule cannot be a superellipse.'
		},
		{
			name: 'bezel',
			type: 'number',
			description: 'Width of the refracting rim; defaults per shape and size.'
		},
		{
			name: 'quality',
			type: "'low' | 'medium' | 'high'",
			default: "'medium'",
			description: 'Map resolution and rim passes; high enables the 3-pass chromatic chain.'
		},
		{
			name: 'mode',
			type: "'auto' | 'full' | 'degraded' | 'flat'",
			default: "'auto'",
			description: 'Per-instance tier override; auto follows capability detection.'
		},
		{
			name: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Disables the native button and mutes the material.'
		},
		{
			name: 'element',
			type: 'HTMLElement | null (bindable)',
			description: 'The underlying button element.'
		},
		{
			name: '…HTMLButtonAttributes',
			type: 'HTMLButtonAttributes',
			description: 'Everything else lands on the native <button>; type defaults to "button".'
		}
	]
};

export default meta;
