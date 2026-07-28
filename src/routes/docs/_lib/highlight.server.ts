import { codeToHtml } from 'shiki';

export type SnippetLang = 'svelte' | 'ts' | 'sh';

/**
 * Server-only on purpose (`.server.ts`): the docs subtree is prerendered, so Shiki and
 * its grammars are a build-time cost and never reach the client bundle. The `codeToHtml`
 * shorthand keeps one shared highlighter behind the scenes, so per-page loads only pay
 * for tokenisation.
 *
 * Dual themes with `defaultColor: false` emit `--shiki-light`/`--shiki-dark` variables
 * per token instead of inline colours — `CodeBlock.svelte` picks one per `data-scheme`,
 * which is what lets the docs' scheme toggle restyle code without re-rendering anything.
 */
export function highlight(code: string, lang: SnippetLang): Promise<string> {
	return codeToHtml(code.trim(), {
		lang,
		themes: { light: 'github-light-default', dark: 'github-dark-default' },
		defaultColor: false
	});
}
