import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';

const meta: DocMeta = {
	slug: 'liquid-lens',
	title: 'LiquidLens',
	description:
		'A draggable magnifying lens: a clear glass capsule with a wide bezel, constrained to a container. It is a real control — keyboard-operable via arrow keys (Shift for larger steps), and Escape abandons a drag and restores the starting position.',
	demos: [
		{
			id: 'basic',
			title: 'Drag it across the text',
			note: 'The container must be the lens’s offsetParent — a positioned ancestor — which is what the bounds calculation reads on each drag start. The lens stretches along the direction of travel, capped at 12%.',
			component: Basic,
			stage: { height: '22rem', variantToggle: false }
		}
	],
	props: [
		{
			name: 'container',
			type: 'HTMLElement | null',
			default: 'null',
			description:
				'Constrains the lens to a container’s box. Must be its offsetParent, i.e. a positioned ancestor — the normal setup for an absolutely positioned lens.'
		},
		{
			name: 'label',
			type: 'string',
			default: "'Draggable lens'",
			description: 'Accessible name — the lens is a real, focusable control, so it needs one.'
		},
		{
			name: 'width',
			type: 'number',
			default: '200',
			description: 'Lens width in px.'
		},
		{
			name: 'height',
			type: 'number',
			default: '140',
			description: 'Lens height in px.'
		},
		{
			name: 'borderRadius',
			type: 'number',
			default: '70',
			description: 'Half the height by default, so the lens is a capsule.'
		},
		{
			name: 'cornerShape',
			type: "'round' | 'continuous' | 'squircle' | number",
			description: 'Left to the library default; a capsule is demoted to round regardless.'
		},
		{
			name: 'bezel',
			type: 'number',
			default: '30',
			description:
				'Width of the refracting rim — deliberately wide, it is the whole point of a lens.'
		},
		{
			name: 'displacement',
			type: 'number',
			description: 'Refraction strength; defaults to the library’s bezel-derived value.'
		},
		{
			name: 'profile',
			type: 'SurfaceProfile',
			default: "'convex-squircle'",
			description: 'Height of the glass surface across the bezel, which is what bends the light.'
		},
		{
			name: 'quality',
			type: "'low' | 'medium' | 'high'",
			default: "'medium'",
			description:
				'The lens is the one surface where the dispersion genuinely reads, so it is the first place to pass quality="high".'
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
			description: 'Removes the lens from the tab order and ignores drags.'
		},
		{
			name: 'onmove',
			type: '(x: number, y: number) => void',
			description: 'Called with the current offset as the lens moves.'
		},
		{
			name: 'children',
			type: 'Snippet',
			description: 'Content rendered on top of the glass, e.g. a magnification label.'
		},
		{
			name: 'class / style',
			type: 'string',
			description:
				'Extra classes and inline style. Set the resting position here (left/top), resolved against the container.'
		}
	]
};

export default meta;
