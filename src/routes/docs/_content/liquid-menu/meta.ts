import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';

const meta: DocMeta = {
	slug: 'liquid-menu',
	title: 'LiquidMenu',
	description:
		'A context menu whose trigger morphs into its panel: the button leaves its place as a patch of glass, gathers, spills sideways and rises into the settled panel. Full ARIA menu keyboard behaviour.',
	demos: [
		{
			id: 'basic',
			title: 'Items and placement',
			note: 'The trigger becomes the panel — it is not drawn while the panel is out, so what moves is one object changing shape, not a menu appearing beside a button that is plainly still there. Arrows, Home/End, Escape and an outside press all behave; pointing at an item moves focus to it, as a native menu does.',
			component: Basic,
			stage: { height: '24rem' }
		}
	],
	props: [
		{
			name: 'items',
			type: 'LiquidMenuItem[]',
			description:
				'Entries: { id, label, hint?, disabled?, destructive?, separated? }. id is reported by onselect; hint is a second, dimmer line; separated draws a hairline above the item.'
		},
		{
			name: 'open',
			type: 'boolean (bindable)',
			default: 'false',
			description: 'Whether the panel is out.'
		},
		{
			name: 'placement',
			type: "'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'",
			default: "'bottom-start'",
			description: 'Which corner the panel grows from, and which side of the trigger it sits on.'
		},
		{
			name: 'morph',
			type: 'boolean',
			default: 'true',
			description:
				'Open by transforming the trigger into the panel, iOS-style. false restores the puddle-beside-the-trigger opening, for a trigger that has to stay on screen.'
		},
		{
			name: 'triggerShape',
			type: "'pill' | 'circle'",
			default: "'pill'",
			description: 'Shape of the trigger, forwarded to its LiquidButton.'
		},
		{
			name: 'triggerSize',
			type: "'sm' | 'md' | 'lg'",
			default: "'md'",
			description: 'Size of the trigger, on the shared 30/38/46 ladder.'
		},
		{
			name: 'variant',
			type: "'regular' | 'clear'",
			default: "'regular'",
			description:
				'One material for trigger and panel: the panel takes the trigger’s place on a frame, so different materials would pop at the handoff.'
		},
		{
			name: 'cornerShape',
			type: "'round' | 'continuous' | 'squircle' | number",
			default: "'continuous'",
			description:
				'Corner of the settled panel. The panel flies round and takes the superellipse only at rest, with the radius compensated to read equally curved.'
		},
		{
			name: 'menuLabel',
			type: 'string',
			description: 'Accessible name for the menu. Defaults to being labelled by the trigger.'
		},
		{
			name: 'quality',
			type: "'low' | 'medium' | 'high'",
			default: "'medium'",
			description:
				'medium holds the frame cap on the library’s largest refracting surface; high buys aberration at triple the displacement fill.'
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
			description: 'Disables the trigger; the menu cannot open.'
		},
		{
			name: 'onselect',
			type: '(id: string) => void',
			description: 'Called with the item’s id. Selecting closes the menu and returns focus.'
		},
		{
			name: 'onopenchange',
			type: '(open: boolean) => void',
			description: 'Called whenever the panel opens or closes.'
		},
		{
			name: 'children',
			type: 'Snippet',
			description: 'Trigger content.'
		},
		{
			name: 'item',
			type: 'Snippet<[LiquidMenuItem]>',
			description: 'Replaces the default item body. Receives the item.'
		},
		{
			name: 'class / style',
			type: 'string',
			description: 'Forwarded to the wrapper element.'
		}
	]
};

export default meta;
