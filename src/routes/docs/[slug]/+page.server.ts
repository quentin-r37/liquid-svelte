import { error } from '@sveltejs/kit';
import { docs, orderedSlugs } from '../_content/registry.js';
import { snippets } from '../_content/snippets.server.js';
import { highlight } from '../_lib/highlight.server.js';
import type { EntryGenerator, PageServerLoad } from './$types.js';

/** Prerender every registered page — don't rely on the crawler finding the sidebar. */
export const entries: EntryGenerator = () => orderedSlugs.map((slug) => ({ slug }));

export const load: PageServerLoad = async ({ params }) => {
	const meta = docs[params.slug];
	if (!meta) error(404, `No documentation page for "${params.slug}"`);

	const code: Record<string, { html: string; raw: string }> = {};
	for (const demo of meta.demos) {
		const raw = snippets[`${meta.slug}/${demo.id}`];
		if (!raw) error(500, `Demo "${demo.id}" on "${meta.slug}" has no matching demos/ source file`);
		code[demo.id] = { html: await highlight(raw, 'svelte'), raw };
	}

	return { slug: meta.slug, code };
};
