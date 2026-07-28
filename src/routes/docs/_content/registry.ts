import type { DocMeta } from './types.js';
import liquidButton from './liquid-button/meta.js';
import liquidCard from './liquid-card/meta.js';
import liquidDialog from './liquid-dialog/meta.js';
import liquidPopover from './liquid-popover/meta.js';
import liquidSwitch from './liquid-switch/meta.js';
import liquidSlider from './liquid-slider/meta.js';
import liquidTabs from './liquid-tabs/meta.js';
import liquidMenu from './liquid-menu/meta.js';
import liquidSearchField from './liquid-search-field/meta.js';
import liquidToolbar from './liquid-toolbar/meta.js';
import liquidNavBar from './liquid-nav-bar/meta.js';
import liquidLens from './liquid-lens/meta.js';
import liquidScrollEdge from './liquid-scroll-edge/meta.js';
import liquidGlass from './liquid-glass/meta.js';
import liquidGlassFilter from './liquid-glass-filter/meta.js';

export type DocGroup = { title: string; slugs: string[] };

/** Sidebar order. The Introduction (/docs) sits above these, hardcoded in the layout. */
export const groups: DocGroup[] = [
	{
		title: 'Components',
		slugs: [
			'liquid-button',
			'liquid-switch',
			'liquid-slider',
			'liquid-tabs',
			'liquid-menu',
			'liquid-popover',
			'liquid-dialog',
			'liquid-card',
			'liquid-search-field',
			'liquid-toolbar',
			'liquid-nav-bar',
			'liquid-lens',
			'liquid-scroll-edge'
		]
	},
	{ title: 'Advanced', slugs: ['liquid-glass', 'liquid-glass-filter'] }
];

export const docs: Record<string, DocMeta> = Object.fromEntries(
	[
		liquidButton,
		liquidSwitch,
		liquidSlider,
		liquidTabs,
		liquidMenu,
		liquidPopover,
		liquidDialog,
		liquidCard,
		liquidSearchField,
		liquidToolbar,
		liquidNavBar,
		liquidLens,
		liquidScrollEdge,
		liquidGlass,
		liquidGlassFilter
	].map((meta) => [meta.slug, meta])
);

export const orderedSlugs: string[] = groups.flatMap((group) => group.slugs);
