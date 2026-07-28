<script lang="ts">
	import type { PropRow } from '../_content/types.js';

	let { rows }: { rows: PropRow[] } = $props();
</script>

<div class="scroll">
	<table>
		<thead>
			<tr>
				<th>Prop</th>
				<th>Type</th>
				<th>Default</th>
				<th>Description</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.name)}
				<tr>
					<td><code class="name">{row.name}</code></td>
					<td><code>{row.type}</code></td>
					<td
						>{#if row.default}<code>{row.default}</code>{:else}—{/if}</td
					>
					<td>{row.description}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
		line-height: 1.5;
	}

	th {
		text-align: left;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.6;
	}

	th,
	td {
		padding: 0.55rem 1rem 0.55rem 0;
		border-bottom: 1px solid rgb(128 128 128 / 0.2);
		vertical-align: top;
	}

	td:last-child {
		min-width: 14rem;
	}

	code {
		padding: 0.05em 0.3em;
		border-radius: 4px;
		background: rgb(128 128 128 / 0.18);
		font-size: 0.85em;
		white-space: nowrap;
	}

	code.name {
		font-weight: 600;
	}
</style>
