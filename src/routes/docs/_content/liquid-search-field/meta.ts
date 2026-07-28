import type { DocMeta } from '../types.js';
import Basic from './demos/Basic.svelte';
import Expandable from './demos/Expandable.svelte';

const meta: DocMeta = {
	slug: 'liquid-search-field',
	title: 'LiquidSearchField',
	description:
		'A native <input type="search"> in a glass capsule, laid out on the button ladder’s 30/38/46 heights so it rows up with the circular buttons it shares a bar with. Optionally collapses into a circular button that morphs into the field on demand.',
	demos: [
		{
			id: 'basic',
			title: 'Sizes and submission',
			note: 'The whole pill is the target — press anywhere and the caret lands in the field. Enter submits, Escape clears a non-empty field (an empty one lets the key through), and the clear button hands focus straight back, because a cleared search is the start of the next one.',
			component: Basic
		},
		{
			id: 'expandable',
			title: 'Expandable',
			note: 'The toolbar’s unroll with a text field inside: the trigger is not drawn while the field is out, the collapsed patch is its exact box, and the capsule unrolls from whichever edge anchor pins. Focus lands in the input on expansion, and a field holding a query stays out through outside clicks — an active search is a state, not a transient.',
			component: Expandable
		}
	],
	props: [
		{
			name: 'value',
			type: 'string (bindable)',
			default: "''",
			description: 'Current text.'
		},
		{
			name: 'size',
			type: "'sm' | 'md' | 'lg'",
			default: "'md'",
			description:
				'Height ladder 30/38/46px — the circle buttons’ diameters, which is what makes the expandable morph a single-axis scale.'
		},
		{
			name: 'variant',
			type: "'regular' | 'clear'",
			default: "'regular'",
			description:
				'Material: regular is the frosted iOS control material, clear the over-media one.'
		},
		{
			name: 'clearable',
			type: 'boolean',
			default: 'true',
			description: 'Show the clear affordance while the field holds text.'
		},
		{
			name: 'expandable',
			type: 'boolean',
			default: 'false',
			description:
				'Collapse the field into a circular search button that morphs into the input on demand. The wrapper spans the width the field expands to.'
		},
		{
			name: 'expanded',
			type: 'boolean (bindable)',
			default: 'false',
			description: 'Whether the expandable field is out. Ignored when not expandable.'
		},
		{
			name: 'anchor',
			type: "'start' | 'end' | 'center'",
			default: "'end'",
			description:
				'Which edge the trigger sits on, and the field unrolls from. end, because that is where a bar keeps its glyphs.'
		},
		{
			name: 'triggerLabel',
			type: 'string',
			default: "'Search'",
			description: 'Accessible name for the collapsed trigger. A glyph is not one.'
		},
		{
			name: 'label',
			type: 'string',
			description:
				'Accessible name of the input. Falls back to placeholder — pass this when the placeholder is absent or too cute to announce.'
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
			description: 'Disables the native input and mutes the material.'
		},
		{
			name: 'onsubmit',
			type: '(value: string) => void',
			description: 'Called with the current text when Enter is pressed.'
		},
		{
			name: 'onclear',
			type: '() => void',
			description: 'Called after the field is emptied via the clear button or Escape.'
		},
		{
			name: 'onexpandedchange',
			type: '(expanded: boolean) => void',
			description: 'Called whenever the expandable field expands or collapses.'
		},
		{
			name: 'icon',
			type: 'Snippet',
			description: 'Replaces the default magnifier — in the field and on the trigger alike.'
		},
		{
			name: 'element',
			type: 'HTMLElement | null (bindable)',
			description: 'The glass host — the field itself, in either mode.'
		},
		{
			name: 'input',
			type: 'HTMLInputElement | null (bindable)',
			description: 'The native input, for imperative focus.'
		},
		{
			name: 'class / style',
			type: 'string',
			description: 'Forwarded to the field, or to the wrapper when expandable.'
		},
		{
			name: '…HTMLInputAttributes',
			type: 'HTMLInputAttributes',
			description: 'Everything else lands on the native input; type is always "search".'
		}
	]
};

export default meta;
