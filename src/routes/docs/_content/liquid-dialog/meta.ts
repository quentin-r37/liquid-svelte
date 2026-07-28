import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';

const meta: DocMeta = {
	slug: 'liquid-dialog',
	title: 'LiquidDialog',
	description:
		'A modal glass surface: centered alert or bottom sheet, with the modality built in — scrim, focus trap, scroll lock, Escape. Deliberately not the top layer: backdrop-filter must keep sampling the page the modal floats over.',
	body: [
		'The overlay is an ordinary position: fixed element, so the library’s one constraint applies with full force: mounted inside a transformed, filtered or overflow: hidden ancestor, the modal is clipped or loses its refraction. Mount it at the page root — or set contained and own the box it fills.',
		'The entrance is deliberately not a puddle. A popover grows out of its trigger; a modal has no on-screen origin, so it arrives nearly at size from slightly below, iOS-style, with the scrim carrying the entrance. The sheet is the same object with the travel on one axis: it rises from below the edge on a spring and leaves on a monotone curve.'
	],
	demos: [
		{
			id: 'basic',
			title: 'Alert and sheet',
			note: 'Focus moves into the dialog on open and returns where it was on close; Tab cycles inside; Escape and a scrim press dismiss unless dismissible={false}. Both examples are contained so they stay inside this stage.',
			component: Basic,
			stage: { height: '26rem' }
		}
	],
	props: [
		{
			name: 'open',
			type: 'boolean (bindable)',
			default: 'false',
			description: 'Whether the dialog is up.'
		},
		{
			name: 'presentation',
			type: "'center' | 'sheet'",
			default: "'center'",
			description: 'center is an alert; sheet floats up from the bottom edge.'
		},
		{
			name: 'dismissible',
			type: 'boolean',
			default: 'true',
			description: 'Whether the scrim press and Escape dismiss. false for flows that must complete.'
		},
		{
			name: 'contained',
			type: 'boolean',
			default: 'false',
			description:
				'Fill the nearest positioned ancestor instead of the viewport, and skip the scroll lock.'
		},
		{
			name: 'label',
			type: 'string',
			description: 'Accessible name for the dialog.'
		},
		{
			name: 'variant',
			type: "'regular' | 'clear'",
			default: "'regular'",
			description: 'Material variant. A modal over media is the canonical clear surface.'
		},
		{
			name: 'cornerShape',
			type: "'round' | 'continuous' | 'squircle' | number",
			default: "'continuous'",
			description: 'Corner outline of the panel.'
		},
		{
			name: 'quality',
			type: "'low' | 'medium' | 'high'",
			default: "'medium'",
			description: 'Quality preset for the panel.'
		},
		{
			name: 'mode',
			type: "'auto' | 'full' | 'degraded' | 'flat'",
			default: "'auto'",
			description: 'Per-instance tier override; auto follows capability detection.'
		},
		{
			name: 'onopenchange',
			type: '(open: boolean) => void',
			description: 'Called whenever the dialog opens or closes.'
		},
		{
			name: 'children',
			type: 'Snippet',
			description: 'Dialog content. Scrolls within the panel when taller than the viewport.'
		},
		{
			name: 'class / style',
			type: 'string',
			description: 'Forwarded to the overlay element.'
		}
	]
};

export default meta;
