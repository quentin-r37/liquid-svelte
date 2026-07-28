<script lang="ts">
	let { html, code = '' }: { html: string; code?: string } = $props();

	let copied = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => (copied = false), 1600);
		} catch {
			/* clipboard unavailable (permissions, insecure context) — button stays inert */
		}
	}
</script>

<div class="code-block">
	{#if code}
		<button class="copy" type="button" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags — Shiki output, generated at build time -->
	{@html html}
</div>

<style>
	.code-block {
		position: relative;
	}

	.code-block :global(pre.shiki) {
		margin: 0;
		padding: 1rem 1.15rem;
		border-radius: 14px;
		overflow-x: auto;
		font-size: 0.8rem;
		line-height: 1.6;
		font-family: ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace;
		background-color: var(--shiki-light-bg);
		box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.18);
	}

	.code-block :global(pre.shiki span) {
		color: var(--shiki-light);
	}

	:global([data-scheme='dark']) .code-block :global(pre.shiki) {
		background-color: var(--shiki-dark-bg);
	}

	:global([data-scheme='dark']) .code-block :global(pre.shiki span) {
		color: var(--shiki-dark);
	}

	.copy {
		position: absolute;
		top: 0.55rem;
		right: 0.55rem;
		padding: 0.3rem 0.65rem;
		border: 1px solid rgb(128 128 128 / 0.35);
		border-radius: 8px;
		background: rgb(128 128 128 / 0.12);
		color: inherit;
		font: inherit;
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		cursor: pointer;
	}

	.copy:hover {
		background: rgb(128 128 128 / 0.22);
	}
</style>
