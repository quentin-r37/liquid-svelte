/**
 * The whole /docs subtree is static: highlighting happens in `.server.ts` files, so
 * prerendering turns Shiki into a build-time-only dependency. SSR renders the degraded
 * tier by design; client capability detection upgrades it after hydration.
 */
export const prerender = true;
