import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';

const meta: DocMeta = {
	slug: 'liquid-toolbar',
	title: 'LiquidToolbar',
	description:
		'A circular glass button that stretches into a horizontal action bar and back. Acting on an item leaves the bar open — repeatable actions against a subject still on screen, which is the whole difference from a menu.',
	demos: [
		{
			id: 'basic',
			title: 'Icons and a toggle',
			note: 'The trigger is not drawn while the bar is out, so what moves is one object stretching along a single axis. Each item lights when the unrolling edge reaches the width that has room for it — the stagger is geometry, not timing, so it cannot drift from the spring, and the retraction plays it backwards for free. Arrows move between wells; Escape and an outside press retract.',
			component: Basic,
			stage: { height: '14rem' }
		}
	],
	props: [
		{
			name: 'items',
			type: 'LiquidToolbarItem[]',
			description:
				'Entries: { id, label, icon?, disabled?, selected?, destructive?, separated? }. label is the accessible name, and the visible one when icon is omitted; selected renders a pressed well and reports aria-pressed.'
		},
		{
			name: 'expanded',
			type: 'boolean (bindable)',
			default: 'false',
			description: 'Whether the bar is out.'
		},
		{
			name: 'anchor',
			type: "'start' | 'end' | 'center'",
			default: "'start'",
			description:
				'Which edge of the collapsed trigger the bar unrolls from, and therefore which edge stays put while it does.'
		},
		{
			name: 'size',
			type: "'sm' | 'md' | 'lg'",
			default: "'md'",
			description:
				'Sizes the trigger and the bar together — the two are locked to one height because the morph is a single-axis scale. There is deliberately no way to size them apart.'
		},
		{
			name: 'triggerLabel',
			type: 'string',
			default: "'More actions'",
			description: 'Accessible name for the trigger. A glyph is not one.'
		},
		{
			name: 'label',
			type: 'string',
			description: 'Accessible name for the bar itself.'
		},
		{
			name: 'variant',
			type: "'regular' | 'clear'",
			default: "'regular'",
			description:
				'One material for trigger and shell: the collapsed shell has to pass as the trigger it replaces on a frame.'
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
			description: 'Disables the trigger; the bar cannot open.'
		},
		{
			name: 'onaction',
			type: '(id: string) => void',
			description: 'Called with the item’s id. The bar stays open.'
		},
		{
			name: 'onexpandedchange',
			type: '(expanded: boolean) => void',
			description: 'Called whenever the bar expands or collapses.'
		},
		{
			name: 'children',
			type: 'Snippet',
			description: 'Trigger glyph.'
		},
		{
			name: 'class / style',
			type: 'string',
			description: 'Forwarded to the wrapper element.'
		}
	]
};

export default meta;
