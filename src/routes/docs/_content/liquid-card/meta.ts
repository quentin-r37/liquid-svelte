import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';

const meta: DocMeta = {
	slug: 'liquid-card',
	title: 'LiquidCard',
	description:
		'A resting glass container: the primitive with a card’s layout — block flow, padding, optional header and footer — instead of a control’s centring flex. Optically it is LiquidGlass with a container’s rim.',
	demos: [
		{
			id: 'basic',
			title: 'Header, body, footer',
			note: 'The refraction sits in a rim around a flat clear centre the content rests on — the same argument as the menu panel, at card scale. The continuous corner is the default because a card is exactly the surface iOS gives one to.',
			component: Basic,
			stage: { height: '20rem' }
		}
	],
	props: [
		{
			name: 'header',
			type: 'Snippet',
			description: 'Above the body, styled as a title row.'
		},
		{
			name: 'children',
			type: 'Snippet',
			description: 'The card body.'
		},
		{
			name: 'footer',
			type: 'Snippet',
			description: 'Below the body, dimmer — actions and fine print.'
		},
		{
			name: 'width / height',
			type: 'number',
			description: 'Fixed size in CSS pixels. Omit either to size from content.'
		},
		{
			name: 'borderRadius',
			type: 'number',
			default: '28',
			description: 'Corner radius in CSS pixels.'
		},
		{
			name: 'cornerShape',
			type: "'round' | 'continuous' | 'squircle' | number",
			default: "'continuous'",
			description: 'Corner outline. Falls back to round where the browser lacks corner-shape.'
		},
		{
			name: 'bezel',
			type: 'number',
			default: '18',
			description: 'Thickness of the refracting rim in CSS pixels.'
		},
		{
			name: 'variant',
			type: "'regular' | 'clear'",
			default: "'regular'",
			description: 'Material variant. clear is for cards floating over media.'
		},
		{
			name: 'interactive',
			type: 'boolean',
			default: 'false',
			description: 'Track the pointer for the rim glow. Off by default: a card is not a control.'
		},
		{
			name: 'quality',
			type: "'low' | 'medium' | 'high'",
			default: "'medium'",
			description: 'Quality preset. A page dense with cards over a moving backdrop wants low.'
		},
		{
			name: 'mode',
			type: "'auto' | 'full' | 'degraded' | 'flat'",
			default: "'auto'",
			description: 'Per-instance tier override; auto follows capability detection.'
		},
		{
			name: 'tag',
			type: 'keyof HTMLElementTagNameMap',
			default: "'div'",
			description: 'Host element tag — article, section, aside…'
		},
		{
			name: 'element',
			type: 'HTMLElement | null (bindable)',
			description: 'The host element.'
		},
		{
			name: 'class / style',
			type: 'string',
			description:
				'Forwarded to the host. The content padding is overridable via --lg-card-padding.'
		}
	]
};

export default meta;
