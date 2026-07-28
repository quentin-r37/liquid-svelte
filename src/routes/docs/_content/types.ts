import type { Component } from 'svelte';
import type { BackdropKind } from '../../Backdrop.svelte';

/** One row of a component's props table — authored by hand in each `meta.ts`. */
export type PropRow = {
	name: string;
	type: string;
	default?: string;
	description: string;
};

/**
 * One live example on a component page. `id` must be the lowercased filename of the
 * matching `demos/<Name>.svelte` — it is the key the server loader uses to pair the
 * rendered component with its own raw source, so the displayed code can never drift
 * from what is running.
 */
export type DocDemo = {
	id: string;
	title: string;
	note?: string;
	component: Component;
	stage?: {
		kind?: BackdropKind;
		height?: string;
		switchable?: boolean;
	};
};

export type DocMeta = {
	slug: string;
	title: string;
	description: string;
	/** Extra paragraphs rendered between the description and the first demo. */
	body?: string[];
	demos: DocDemo[];
	props: PropRow[];
};
