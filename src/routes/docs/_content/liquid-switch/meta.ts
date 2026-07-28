import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';

const meta: DocMeta = {
	slug: 'liquid-switch',
	title: 'LiquidSwitch',
	description:
		'A toggle whose thumb is a liquid droplet: an opaque knob at rest that melts into refracting glass when grabbed. Built on a native <button role="switch">, so it announces as "switch, on" and toggles with Space and Enter.',
	demos: [
		{
			id: 'basic',
			title: 'Sizes and states',
			note: 'Drag the droplet, not just tap it — grabbing melts the knob into glass that swells and deforms as it crosses, and a flick beats position. The visible label goes in as children.',
			component: Basic,
			stage: { variantToggle: false }
		}
	],
	props: [
		{
			name: 'checked',
			type: 'boolean (bindable)',
			default: 'false',
			description: 'Whether the switch is on.'
		},
		{
			name: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Disables the native button and mutes the material.'
		},
		{
			name: 'label',
			type: 'string',
			description:
				'Accessible name. Required unless labelledBy or a visible children label is given.'
		},
		{
			name: 'labelledBy',
			type: 'string',
			description: 'Id of an external element that labels the switch.'
		},
		{
			name: 'size',
			type: "'sm' | 'md'",
			default: "'md'",
			description: 'Track height 28/36px; the knob and its travel are derived proportionally.'
		},
		{
			name: 'quality',
			type: "'low' | 'medium' | 'high'",
			default: "'high'",
			description: 'Map resolution and rim passes; high enables the 3-pass chromatic chain.'
		},
		{
			name: 'mode',
			type: "'auto' | 'full' | 'degraded' | 'flat'",
			default: "'auto'",
			description: 'Per-instance tier override; auto follows capability detection.'
		},
		{
			name: 'class',
			type: 'string',
			description: 'Extra classes for the wrapper row.'
		},
		{
			name: 'style',
			type: 'string',
			description: 'Inline style for the wrapper row.'
		},
		{
			name: 'onchange',
			type: '(checked: boolean) => void',
			description: 'Called after each toggle, from taps, completed drags and the keyboard alike.'
		},
		{
			name: 'children',
			type: 'Snippet',
			description: 'Optional visible label, rendered after the control and wired up as its name.'
		}
	]
};

export default meta;
