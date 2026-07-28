import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';

const meta: DocMeta = {
	slug: 'liquid-scroll-edge',
	title: 'LiquidScrollEdge',
	description:
		'A progressive blur band pinned to a scroller’s edge: stacked backdrop layers, each masked to a different depth, so the blur radius ramps from the edge instead of stopping at a line. A legibility scrim runs the full depth on its own curve.',
	demos: [
		{
			id: 'basic',
			title: 'Pinned top edge',
			note: 'The band fills whatever box the caller puts it in — here a sticky, zero-flow slot at the top of the scroller. Content loses definition as it approaches the edge; nothing is laid over it. Never nest a glass surface inside the band: its masks make it a backdrop root.',
			component: Basic,
			stage: { height: '20rem', padded: false }
		}
	],
	props: [
		{
			name: 'side',
			type: "'top' | 'bottom'",
			default: "'top'",
			description: 'Which side of the scroller the band is pinned to.'
		},
		{
			name: 'blur',
			type: 'number',
			default: '12',
			description: 'Peak blur at the pinned edge, in CSS pixels.'
		},
		{
			name: 'saturation',
			type: 'number',
			default: '1.35',
			description: 'Backdrop saturation under the band; puts back the colour the blur washes out.'
		},
		{
			name: 'scrim',
			type: 'number',
			default: '0.1',
			description:
				'Alpha of the legibility scrim at the pinned edge, 0–1. Blur destroys detail but not luminance; the scrim is the floor holding text contrast.'
		},
		{
			name: 'layers',
			type: 'number',
			default: '4',
			description:
				'Stacked backdrop layers. More is a smoother ramp and one more composited pass over the band each.'
		},
		{
			name: 'scheme',
			type: "'light' | 'dark'",
			description:
				'Which way the scrim leans; defaults to prefers-color-scheme. Set it when the app forces its own scheme — a light scrim over dark content erases the text it should protect.'
		},
		{
			name: 'progress',
			type: 'number',
			default: '1',
			description:
				'Intensity, 0–1. Scrub it from a scroll position; at 0 every layer is switched off entirely.'
		},
		{
			name: 'mode',
			type: "'auto' | 'full' | 'degraded' | 'flat'",
			default: "'auto'",
			description:
				'Tier override. Plain blur() works everywhere backdrop-filter does, so only flat changes anything: it swaps the band for a denser scrim.'
		},
		{
			name: 'class / style',
			type: 'string',
			description: 'Extra classes and inline style on the band element.'
		}
	]
};

export default meta;
