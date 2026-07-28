<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { LiquidButton } from '$lib/liquid-glass/index.js';
	import { Menu, Moon, Sun, X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import Backdrop from '../Backdrop.svelte';
	import { setDocsContext } from './_lib/docsContext.js';
	import { docs, groups } from './_content/registry.js';

	let { children }: { children: Snippet } = $props();

	let scheme = $state<'light' | 'dark'>('dark');
	let sidebarOpen = $state(false);

	setDocsContext({
		get scheme() {
			return scheme;
		}
	});

	/**
	 * Same persistence shape as /demo: restore in an `$effect`, never at `$state` init,
	 * so the first client render matches SSR.
	 */
	const OPTIONS_KEY = 'liquid-svelte:docs-options';
	let optionsRestored = false;

	$effect(() => {
		let stored: Record<string, unknown> = {};
		try {
			stored = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}');
		} catch {
			/* corrupt entry — keep the defaults */
		}
		if (stored.scheme === 'light' || stored.scheme === 'dark') scheme = stored.scheme;
		optionsRestored = true;
	});

	$effect(() => {
		const snapshot = JSON.stringify({ scheme });
		if (optionsRestored) localStorage.setItem(OPTIONS_KEY, snapshot);
	});

	// Close the mobile sidebar whenever navigation lands somewhere.
	$effect(() => {
		void page.url.pathname;
		sidebarOpen = false;
	});

	const introHref = resolve('/docs');
	function hrefFor(slug: string) {
		return resolve('/docs/[slug]', { slug });
	}
	function isActive(href: string) {
		return page.url.pathname === href;
	}
</script>

<div class="docs" data-scheme={scheme}>
	<Backdrop kind="gradient" {scheme} fixed />

	<div class="chrome">
		<LiquidButton
			shape="circle"
			class="nav-toggle"
			aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
			onclick={() => (sidebarOpen = !sidebarOpen)}
		>
			{#if sidebarOpen}<X />{:else}<Menu />{/if}
		</LiquidButton>
		<LiquidButton
			shape="circle"
			aria-label="Switch to {scheme === 'dark' ? 'light' : 'dark'} scheme"
			onclick={() => (scheme = scheme === 'dark' ? 'light' : 'dark')}
		>
			{#if scheme === 'dark'}<Sun />{:else}<Moon />{/if}
		</LiquidButton>
	</div>

	<div class="frame">
		<aside class:open={sidebarOpen}>
			<a class="brand" href={resolve('/')}>liquid-svelte</a>
			<nav>
				<p class="group">Getting started</p>
				<ul>
					<li><a href={introHref} class:active={isActive(introHref)}>Introduction</a></li>
				</ul>
				{#each groups as group (group.title)}
					<p class="group">{group.title}</p>
					<ul>
						{#each group.slugs as slug (slug)}
							{@const href = hrefFor(slug)}
							<li><a {href} class:active={isActive(href)}>{docs[slug].title}</a></li>
						{/each}
					</ul>
				{/each}
			</nav>
		</aside>

		<main>
			{@render children()}
		</main>
	</div>
</div>

<style>
	.docs {
		min-height: 100dvh;
		color: #f4f6fa;
		font-family:
			'Inter Variable',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		line-height: 1.6;
	}

	.docs[data-scheme='light'] {
		color: #0c0e16;
	}

	.frame {
		display: grid;
		grid-template-columns: 260px minmax(0, 1fr);
	}

	aside {
		position: sticky;
		top: 0;
		height: 100dvh;
		overflow-y: auto;
		padding: 1.5rem 1.25rem 2rem;
		box-shadow: inset -1px 0 0 rgb(128 128 128 / 0.22);
	}

	.brand {
		display: block;
		margin-bottom: 1.5rem;
		font-size: 1rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: inherit;
		text-decoration: none;
	}

	.group {
		margin: 1.25rem 0 0.35rem;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.55;
	}

	nav ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	nav li a {
		display: block;
		padding: 0.32rem 0.6rem;
		border-radius: 8px;
		font-size: 0.85rem;
		color: inherit;
		text-decoration: none;
		opacity: 0.75;
	}

	nav li a:hover {
		background: rgb(128 128 128 / 0.14);
		opacity: 1;
	}

	nav li a.active {
		background: rgb(128 128 128 / 0.2);
		font-weight: 600;
		opacity: 1;
	}

	main {
		padding: clamp(1.5rem, 4vw, 3rem) clamp(1.25rem, 4vw, 3.5rem) 4rem;
	}

	.chrome {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 40;
		display: flex;
		gap: 0.6rem;
	}

	/* The hamburger only exists on narrow screens; hide via the class LiquidButton forwards. */
	.chrome :global(.nav-toggle) {
		display: none;
	}

	@media (max-width: 860px) {
		.frame {
			grid-template-columns: minmax(0, 1fr);
		}

		.chrome :global(.nav-toggle) {
			display: inline-flex;
		}

		/*
		 * Overlay panel. `backdrop-filter: blur` is safe here because the sidebar holds
		 * plain links only — no glass descendants that would need to see through it.
		 */
		aside {
			position: fixed;
			inset: 0 30% 0 0;
			z-index: 30;
			min-width: 16rem;
			transform: translateX(-100%);
			transition: transform 160ms ease;
			background: rgb(12 14 22 / 0.82);
			backdrop-filter: blur(18px) saturate(1.2);
			box-shadow: 1px 0 0 rgb(128 128 128 / 0.25);
		}

		.docs[data-scheme='light'] aside {
			background: rgb(244 246 250 / 0.85);
		}

		aside.open {
			transform: translateX(0);
		}
	}
</style>
