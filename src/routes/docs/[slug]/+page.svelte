<script lang="ts">
	import { resolve } from '$app/paths';
	import ExampleStage from '../_components/ExampleStage.svelte';
	import PropsTable from '../_components/PropsTable.svelte';
	import { docs, orderedSlugs } from '../_content/registry.js';

	let { data } = $props();

	const meta = $derived(docs[data.slug]);
	const index = $derived(orderedSlugs.indexOf(data.slug));
	const prev = $derived(index > 0 ? docs[orderedSlugs[index - 1]] : null);
	const next = $derived(index < orderedSlugs.length - 1 ? docs[orderedSlugs[index + 1]] : null);
</script>

<svelte:head>
	<title>{meta.title} — liquid-svelte</title>
	<meta name="description" content={meta.description} />
</svelte:head>

<article>
	<h1>{meta.title}</h1>
	<p class="lede">{meta.description}</p>
	{#each meta.body ?? [] as paragraph (paragraph)}
		<p class="body">{paragraph}</p>
	{/each}

	{#each meta.demos as demo (demo.id)}
		<section>
			<h2>{demo.title}</h2>
			{#if demo.note}
				<p class="note">{demo.note}</p>
			{/if}
			<ExampleStage
				{...demo.stage}
				component={demo.component}
				code={data.code[demo.id].html}
				raw={data.code[demo.id].raw}
			/>
		</section>
	{/each}

	{#if meta.props.length}
		<section>
			<h2>Props</h2>
			<PropsTable rows={meta.props} />
		</section>
	{/if}

	<nav class="pager">
		{#if prev}
			<a href={resolve('/docs/[slug]', { slug: prev.slug })}>← {prev.title}</a>
		{:else}
			<a href={resolve('/docs')}>← Getting started</a>
		{/if}
		{#if next}
			<a class="next" href={resolve('/docs/[slug]', { slug: next.slug })}>{next.title} →</a>
		{/if}
	</nav>
</article>

<style>
	article {
		max-width: 52rem;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: clamp(1.6rem, 4vw, 2.2rem);
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.lede {
		margin: 0 0 1rem;
		font-size: 1rem;
		opacity: 0.85;
		max-width: 46rem;
	}

	.body,
	.note {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		opacity: 0.78;
		max-width: 46rem;
	}

	section {
		margin-top: 2.25rem;
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.65;
	}

	.pager {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin: 3rem 0 1rem;
		font-size: 0.85rem;
	}

	.pager a {
		color: inherit;
		text-underline-offset: 3px;
	}

	.next {
		margin-left: auto;
	}
</style>
