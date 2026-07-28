import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';

const meta: DocMeta = {
	slug: 'liquid-slider',
	title: 'LiquidSlider',
	description:
		'A range control whose knob is the same droplet as the switch: opaque until grabbed, then clear refracting glass that swells and squashes along its travel. A transparent native <input type="range"> stretched over the track supplies dragging, arrow keys, PageUp/PageDown and Home/End.',
	demos: [
		{
			id: 'basic',
			title: 'Values, ranges and formatting',
			note: 'showValue renders the formatted readout beside the track; format also feeds aria-valuetext. Keyboard steps melt the droplet exactly like a grab does.',
			component: Basic
		}
	],
	props: [
		{
			name: 'value',
			type: 'number (bindable)',
			default: '50',
			description: 'Current value, clamped and stepped by the native range input.'
		},
		{
			name: 'min',
			type: 'number',
			default: '0',
			description: 'Lower bound of the range.'
		},
		{
			name: 'max',
			type: 'number',
			default: '100',
			description: 'Upper bound of the range.'
		},
		{
			name: 'step',
			type: 'number',
			default: '1',
			description: 'Value granularity, for drags and keyboard steps alike.'
		},
		{
			name: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Disables the input and dims the rail, fill and readout.'
		},
		{
			name: 'label',
			type: 'string',
			description: 'Accessible name. Required unless labelledBy is given.'
		},
		{
			name: 'labelledBy',
			type: 'string',
			description: 'Id of an external element that labels the slider.'
		},
		{
			name: 'format',
			type: '(value: number) => string',
			default: 'round to integer',
			description: 'Formats the value for aria-valuetext and the optional readout.'
		},
		{
			name: 'showValue',
			type: 'boolean',
			default: 'false',
			description: 'Show the formatted value next to the track.'
		},
		{
			name: 'quality',
			type: "'low' | 'medium' | 'high'",
			default: "'medium'",
			description:
				'Medium by default — the small knob has no room to show the high-tier dispersion.'
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
			description: 'Extra classes for the wrapper.'
		},
		{
			name: 'style',
			type: 'string',
			description: 'Inline style for the wrapper.'
		},
		{
			name: 'oninput',
			type: '(value: number) => void',
			description: 'Called on every value change while dragging or stepping.'
		},
		{
			name: 'onchange',
			type: '(value: number) => void',
			description: 'Called once the gesture commits, when the native change event fires.'
		}
	]
};

export default meta;
