import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';

const meta: DocMeta = {
	slug: 'liquid-nav-bar',
	title: 'LiquidNavBar',
	description:
		'A pinned navigation bar over a progressive blur band. The bar itself is not a glass surface — it is a plain layout box beside a LiquidScrollEdge, which is why the glass controls inside it keep their refraction.',
	demos: [
		{
			id: 'basic',
			title: 'Large title handover',
			note: 'Scroll inside the panel. The edge materialises as the large title closes on the bar, and the inline title arrives exactly as the large one goes under — nothing is sprung, the scroll position is the animation. The scroll container must carry no mask, filter, opacity or transform, or the band has nothing left to blur.',
			component: Basic,
			stage: {
				height: '24rem',
				kind: 'grid',
				switchable: true,
				padded: false,
				variantToggle: false
			}
		}
	],
	props: [
		{
			name: 'title',
			type: 'string',
			description: 'Inline title, shown in the centre region.'
		},
		{
			name: 'titleTarget',
			type: 'HTMLElement | null',
			description:
				'A large title living in the scrolled content (bind:this your heading). The bar takes its cue from that element closing on its bottom edge, so the inline title arrives as the large one disappears. Passing the prop declares the intent, even while the binding is still null.'
		},
		{
			name: 'scroller',
			type: 'HTMLElement | null',
			default: 'null',
			description: 'Scroll container to listen to. Omit for the document scroller.'
		},
		{
			name: 'scrollEdge',
			type: 'boolean',
			default: 'true',
			description: 'Materialise on scroll. false leaves the edge permanently blurred.'
		},
		{
			name: 'fade',
			type: 'number',
			default: '24',
			description: 'Scroll distance, in px, over which the edge materialises.'
		},
		{
			name: 'position',
			type: "'sticky' | 'fixed' | 'static'",
			default: "'sticky'",
			description: 'Where the bar sits; static hands positioning back to the consumer.'
		},
		{
			name: 'height',
			type: 'number',
			default: '52',
			description: 'Minimum height of the title row, excluding any safe-area inset.'
		},
		{
			name: 'blur',
			type: 'number',
			default: '12',
			description: 'Peak blur at the edge, in px. Forwarded to the band.'
		},
		{
			name: 'scheme',
			type: "'light' | 'dark'",
			description:
				"Forwarded to the band's legibility scrim; set it when the app forces its own scheme."
		},
		{
			name: 'progress',
			type: 'number (bindable)',
			default: '0',
			description:
				'Materialisation, 0–1. Bindable as a readout: the component owns it whenever scrollEdge is on.'
		},
		{
			name: 'mode',
			type: "'auto' | 'full' | 'degraded' | 'flat'",
			default: "'auto'",
			description: 'Rendering tier override, forwarded to the band.'
		},
		{
			name: 'leading',
			type: 'Snippet',
			description:
				'Leading region — a back button, a logo. Put LiquidButtons here: they sit beside the band, not inside it, so they stay real glass.'
		},
		{
			name: 'trailing',
			type: 'Snippet',
			description: 'Trailing region — actions. Same arrangement as leading.'
		},
		{
			name: 'children',
			type: 'Snippet',
			description: 'Replaces the centre region entirely, ignoring title.'
		},
		{
			name: 'element',
			type: 'HTMLElement | null (bindable)',
			description: 'The underlying header element.'
		},
		{
			name: 'class / style',
			type: 'string',
			description: 'Extra classes and inline style on the host element.'
		}
	]
};

export default meta;
