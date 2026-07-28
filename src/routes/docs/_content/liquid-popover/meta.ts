import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';

const meta: DocMeta = {
	slug: 'liquid-popover',
	title: 'LiquidPopover',
	description:
		'A generic anchored panel: the menu’s glass and puddle opening holding arbitrary content instead of a role="menu" list. Non-modal dialog semantics — Escape, an outside press or focus leaving all dismiss it.',
	demos: [
		{
			id: 'basic',
			title: 'Arbitrary content',
			note: 'The panel spills sideways out of the trigger and rises, exactly as the menu does — but the trigger stays on screen, pressed, because a popover’s trigger is a toggle rather than the panel’s previous form. Focus moves to the panel on open and back to the trigger on Escape.',
			component: Basic,
			stage: { height: '24rem' }
		}
	],
	props: [
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
			name: 'trigger',
			type: 'Snippet',
			description: 'Trigger content, rendered inside the component’s own LiquidButton.'
		},
		{
			name: 'children',
			type: 'Snippet',
			description: 'Panel content.'
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
			description: 'One material for trigger and panel, for the menu’s reason.'
		},
		{
			name: 'cornerShape',
			type: "'round' | 'continuous' | 'squircle' | number",
			default: "'continuous'",
			description:
				'Corner of the settled panel. The panel flies round and takes the superellipse only at rest.'
		},
		{
			name: 'label',
			type: 'string',
			description: 'Accessible name for the panel. Defaults to being labelled by the trigger.'
		},
		{
			name: 'quality',
			type: "'low' | 'medium' | 'high'",
			default: "'medium'",
			description: 'Quality preset for trigger and panel.'
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
			description: 'Disables the trigger; the panel cannot open.'
		},
		{
			name: 'onopenchange',
			type: '(open: boolean) => void',
			description: 'Called whenever the panel opens or closes.'
		},
		{
			name: 'class / style',
			type: 'string',
			description:
				'Forwarded to the wrapper element. The panel padding is overridable via --lg-popover-padding.'
		}
	]
};

export default meta;
