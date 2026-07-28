import { getContext, setContext } from 'svelte';

/**
 * The docs layout owns the colour scheme; stages and code blocks read it from context so
 * every backdrop and token colour follows the one toggle. The getter keeps it reactive —
 * the layout passes `{ get scheme() { … } }` over its `$state`, so consumers reading
 * `ctx.scheme` inside markup re-render on change without any store plumbing.
 */
export type DocsContext = {
	readonly scheme: 'light' | 'dark';
};

const KEY = Symbol('liquid-svelte docs');

export function setDocsContext(ctx: DocsContext): void {
	setContext(KEY, ctx);
}

export function getDocsContext(): DocsContext {
	return getContext<DocsContext>(KEY);
}
