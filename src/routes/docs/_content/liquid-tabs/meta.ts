import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';
import Icons from './demos/Icons.svelte';

const meta: DocMeta = {
	slug: 'liquid-tabs',
	title: 'LiquidTabs',
	description:
		'A segmented control: a glass rail with a draggable selection bubble that melts into a lens under the hand. Implements the ARIA tabs pattern — roving focus, manual activation, arrow keys, Home/End — with an optional panel per tab.',
	body: [
		'Each entry in tabs is a LiquidTab: { id, label, icon?, iconOnly?, disabled? }. The label is required even for icon-only segments — with iconOnly it moves onto the button’s aria-label, since a glyph is not an accessible name.'
	],
	demos: [
		{
			id: 'basic',
			title: 'Text tabs with a panel',
			note: 'The panel snippet receives the selected id. Drag the bubble or flick it — a tab tapped mid-flight redirects the spring rather than restarting it; the disabled tab is skipped by the keyboard.',
			component: Basic,
			stage: { height: '20rem' }
		},
		{
			id: 'icons',
			title: 'Icon segments',
			note: 'Icons ride beside the label, alone with iconOnly, or above it with iconPlacement="top" the way an iOS tab bar stacks them. The bubble paints over the labels, so the lens refracts the glyphs it crosses — grab one and watch the fringing.',
			component: Icons
		}
	],
	props: [
		{
			name: 'tabs',
			type: 'LiquidTab[]',
			description: 'The segments: { id, label, icon?, iconOnly?, disabled? } each.'
		},
		{
			name: 'value',
			type: 'string (bindable)',
			default: 'first tab id',
			description: 'Id of the selected tab.'
		},
		{
			name: 'label',
			type: 'string',
			description: 'Accessible name for the tab list. Required unless labelledBy is given.'
		},
		{
			name: 'labelledBy',
			type: 'string',
			description: 'Id of an external element that labels the tab list.'
		},
		{
			name: 'iconPlacement',
			type: "'start' | 'top'",
			default: "'start'",
			description:
				'Icons beside the label, or stacked above a caption-sized one; set per row, not per tab.'
		},
		{
			name: 'variant',
			type: "'regular' | 'clear'",
			default: "'regular'",
			description: 'Material variant of the rail; the selection bubble is a fill, not the material.'
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
			description: 'Extra classes for the wrapper.'
		},
		{
			name: 'style',
			type: 'string',
			description: 'Inline style for the wrapper.'
		},
		{
			name: 'onchange',
			type: '(id: string) => void',
			description: 'Called with the tab id after each selection, from taps, drags and the keyboard.'
		},
		{
			name: 'panel',
			type: 'Snippet<[string]>',
			description: 'Optional tabpanel content, rendered below the rail with the selected id.'
		}
	]
};

export default meta;
