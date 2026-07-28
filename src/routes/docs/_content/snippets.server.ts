/**
 * Every demo's own source, keyed `<slug>/<demo id>` where the id is the lowercased
 * filename. The demo files import from `$lib`, which is meaningless to a consumer, so
 * the specifier is rewritten to the package name before display — that rewrite is a dumb
 * string replace on purpose, which is why demo files must import from exactly
 * `$lib/liquid-glass/index.js` or `$lib` and nothing deeper.
 */
const modules = import.meta.glob('./*/demos/*.svelte', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

export const snippets: Record<string, string> = {};

for (const [path, source] of Object.entries(modules)) {
	const match = path.match(/^\.\/(.+?)\/demos\/(.+?)\.svelte$/);
	if (!match) continue;
	const [, slug, name] = match;
	snippets[`${slug}/${name.toLowerCase()}`] = source
		.replaceAll("'$lib/liquid-glass/index.js'", "'liquid-svelte'")
		.replaceAll("'$lib'", "'liquid-svelte'");
}
