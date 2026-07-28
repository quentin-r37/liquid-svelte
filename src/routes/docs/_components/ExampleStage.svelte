<script lang="ts">
	import type { Snippet } from 'svelte';
	import Backdrop, { BACKDROP_KINDS, type BackdropKind } from '../../Backdrop.svelte';
	import { getDocsContext } from '../_lib/docsContext.js';
	import CodeBlock from './CodeBlock.svelte';

	let {
		kind = 'grid',
		height = '18rem',
		switchable = true,
		code,
		raw,
		children
	}: {
		kind?: BackdropKind;
		height?: string;
		switchable?: boolean;
		/** Shiki-highlighted HTML of the demo's own source, from the page's server load. */
		code?: string;
		/** The same source as plain text, for the copy button. */
		raw?: string;
		children: Snippet;
	} = $props();

	const ctx = getDocsContext();
	// Writable derived: follows the meta-declared kind, overridable from the select.
	let activeKind = $derived(kind);
	let showCode = $state(false);
</script>

<div class="example">
	<!--
		The stage clips its backdrop with `overflow: hidden` + radius — the one clipping
		mechanism that does not make this box a backdrop root, so the glass inside keeps
		its refraction. Never add filter/opacity/mask/clip-path/blend/transform here.
	-->
	<div class="stage" style:height>
		<Backdrop kind={activeKind} scheme={ctx.scheme} />
		<div class="content">{@render children()}</div>
	</div>
	<div class="bar">
		{#if switchable}
			<label>
				<span>backdrop</span>
				<select bind:value={activeKind}>
					{#each BACKDROP_KINDS as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
		{/if}
		{#if code}
			<button type="button" class="toggle" onclick={() => (showCode = !showCode)}>
				{showCode ? 'Hide code' : 'Show code'}
			</button>
		{/if}
	</div>
	{#if code && showCode}
		<CodeBlock html={code} code={raw} />
	{/if}
</div>

<style>
	.example {
		margin: 0 0 2.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.stage {
		position: relative;
		overflow: hidden;
		border-radius: 18px;
		box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.28);
	}

	.content {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 1.5rem;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.68rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	select {
		padding: 0.3rem 0.45rem;
		border: 1px solid rgb(128 128 128 / 0.35);
		border-radius: 8px;
		background: rgb(128 128 128 / 0.12);
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
		text-transform: none;
		letter-spacing: 0;
	}

	.toggle {
		padding: 0.32rem 0.7rem;
		border: 1px solid rgb(128 128 128 / 0.35);
		border-radius: 8px;
		background: rgb(128 128 128 / 0.12);
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.toggle:hover {
		background: rgb(128 128 128 / 0.22);
	}
</style>
