<script lang="ts">
	import { animate } from 'motion';
	import type { Snippet } from 'svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import { cornerShapeCss } from './displacement/cornerShape.js';
	import type { CornerShape, GlassMode, GlassQuality } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { acquireGlassTransform, type GlassTransform } from './runtime/glassMotion.js';
	import { springFor } from './runtime/motionTokens.js';
	import { observeSize } from './runtime/sharedResizeObserver.js';

	export interface LiquidTab {
		/** Stable identifier, also used to key the panel. */
		id: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		tabs: LiquidTab[];
		/** Id of the selected tab. Bindable. */
		value?: string;
		/** Accessible name for the tab list. */
		label?: string;
		labelledBy?: string;
		/**
		 * Corner outline of the sliding bubble *and* of the rail it slides in.
		 *
		 * Both, because they cannot differ. The rail is plain translucent CSS rather
		 * than glass — nested `backdrop-filter` does not compose — so it takes the shape
		 * through a custom property instead of through the primitive, and a squircle
		 * bubble sitting in a capsule rail is the one combination that reads as broken.
		 *
		 * The same caveat as `LiquidButton` applies, with more force: both radii are 999
		 * and therefore clamped to half their box, and a clamped squircle has flat ends
		 * rather than a capsule's round ones. This turns a pill of tabs into a
		 * rounded-rectangle of tabs, which is a real design change and not a subtle one.
		 */
		cornerShape?: CornerShape;
		quality?: GlassQuality;
		mode?: GlassMode;
		class?: string;
		style?: string;
		onchange?: (id: string) => void;
		/** Panel content, receives the selected tab id. */
		panel?: Snippet<[string]>;
	}

	let {
		tabs,
		value = $bindable(tabs[0]?.id ?? ''),
		label,
		labelledBy,
		cornerShape = 'round',
		quality = 'high',
		mode = 'auto',
		class: className = '',
		style = '',
		onchange,
		panel
	}: Props = $props();

	const uid = $props.id();
	const tabId = (id: string) => `${uid}-tab-${id}`;
	const panelId = (id: string) => `${uid}-panel-${id}`;

	let listElement = $state<HTMLElement | null>(null);
	let bubbleElement = $state<HTMLElement | null>(null);
	let bubbleTransform = $state<GlassTransform | null>(null);
	let buttons = $state<Record<string, HTMLButtonElement | undefined>>({});

	/** Geometry of the active segment, in list coordinates. */
	let segment = $state({ x: 0, width: 0, height: 0 });

	const selectedIndex = $derived(
		Math.max(
			0,
			tabs.findIndex((tab) => tab.id === value)
		)
	);

	/**
	 * Measured with `offsetLeft` / `offsetWidth` rather than
	 * `getBoundingClientRect`, because the bubble's own live transform would
	 * pollute a rect reading — and these are relative to the positioned list,
	 * which is exactly the coordinate space the transform works in.
	 */
	function measure() {
		const button = buttons[value];
		if (!button) return;

		const next = { x: button.offsetLeft, width: button.offsetWidth, height: button.offsetHeight };
		if (next.x === segment.x && next.width === segment.width && next.height === segment.height) {
			return;
		}
		segment = next;
	}

	// Remeasure on a font swap, container resize or label edit.
	$effect(() => {
		if (!listElement) return;
		return observeSize(listElement, measure);
	});

	// Reading `buttons[value]` inside `measure` registers the dependency, so this
	// runs both when the selection changes and when that button mounts.
	$effect(measure);

	$effect(() => {
		if (!bubbleElement) return;
		const transform = acquireGlassTransform(bubbleElement);
		bubbleTransform = transform;
		return () => {
			bubbleTransform = null;
			transform.release();
		};
	});

	/**
	 * The bubble only ever slides — a single `x` channel, no size animation.
	 *
	 * That is deliberate, and it is why segments are laid out at equal width (see
	 * the `grid-auto-columns: 1fr` in the styles). Animating the bubble's width to
	 * match differently-sized labels would change the glass geometry every frame,
	 * which means regenerating the displacement map every frame — the one thing the
	 * engine is built to avoid. Faking it with `scaleX` is no better: it would
	 * stretch the refraction and the specular hairline along with the box.
	 */
	$effect(() => {
		const transform = bubbleTransform;
		if (!transform || segment.width === 0) return;

		const slide = animate(transform.x, segment.x, springFor('bubble', reducedMotion.current));
		return () => slide.stop();
	});

	function select(tab: LiquidTab) {
		if (tab.disabled || tab.id === value) return;
		value = tab.id;
		onchange?.(tab.id);
	}

	/**
	 * Roving focus with manual activation, per the ARIA tabs pattern.
	 *
	 * Bound to each tab rather than to the tablist: only the selected tab is
	 * focusable, so it is the tab that receives the key event, and putting a handler
	 * on a non-focusable container would be dead weight.
	 */
	function onKeyDown(event: KeyboardEvent) {
		const enabled = tabs.filter((tab) => !tab.disabled);
		if (enabled.length === 0) return;

		const current = enabled.findIndex((tab) => tab.id === value);
		let next: number;

		if (event.key === 'ArrowRight') next = (current + 1) % enabled.length;
		else if (event.key === 'ArrowLeft') next = (current - 1 + enabled.length) % enabled.length;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = enabled.length - 1;
		else return;

		event.preventDefault();
		const tab = enabled[next];
		select(tab);
		buttons[tab.id]?.focus();
	}
</script>

<div class={`lg-tabs ${className}`} {style}>
	<div
		bind:this={listElement}
		role="tablist"
		aria-label={labelledBy ? undefined : label}
		aria-labelledby={labelledBy}
		class="lg-tabs-list"
		style:--lg-tabs-corner={cornerShapeCss(cornerShape)}
	>
		<span class="lg-tabs-rail"></span>

		{#if segment.width > 0}
			<LiquidGlass
				bind:element={bubbleElement}
				width={segment.width}
				height={segment.height}
				borderRadius={999}
				{cornerShape}
				bezel={Math.max(8, segment.height / 2.6)}
				opacity={0.1}
				saturation={1.9}
				specularIntensity={0.9}
				shadowIntensity={0.55}
				{quality}
				{mode}
				class="lg-tabs-bubble"
			/>
		{/if}

		{#each tabs as tab, index (tab.id)}
			<button
				bind:this={buttons[tab.id]}
				type="button"
				role="tab"
				id={tabId(tab.id)}
				aria-selected={tab.id === value}
				aria-controls={panel ? panelId(tab.id) : undefined}
				aria-disabled={tab.disabled ? 'true' : undefined}
				disabled={tab.disabled}
				tabindex={index === selectedIndex ? 0 : -1}
				class="lg-tabs-tab"
				onclick={() => select(tab)}
				onkeydown={onKeyDown}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if panel}
		<div role="tabpanel" id={panelId(value)} aria-labelledby={tabId(value)} tabindex="0">
			{@render panel(value)}
		</div>
	{/if}
</div>

<style>
	.lg-tabs {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/*
	 * `grid-auto-columns: 1fr` sizes every segment to the widest label, which keeps
	 * the bubble a fixed size — see the comment on the slide effect for why that
	 * matters. It is also how native segmented controls behave.
	 *
	 * The rail is plain translucent CSS, not a second refracting surface: nesting
	 * one backdrop-filter inside another does not compose, since the inner one would
	 * only ever see the outer one's output.
	 */
	.lg-tabs-list {
		position: relative;
		display: inline-grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		align-self: flex-start;
		max-width: 100%;
		padding: 4px;
		border-radius: 999px;
		/*
		 * Written by the `cornerShape` prop, defaulting here rather than in the markup so
		 * the stylesheet still stands on its own. Restated on the rail below because
		 * `corner-shape` does not inherit — only the custom property does.
		 */
		corner-shape: var(--lg-tabs-corner, round);
		box-sizing: border-box;
	}

	.lg-tabs-rail {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		corner-shape: var(--lg-tabs-corner, round);
		background: rgb(255 255 255 / 0.08);
		box-shadow:
			inset 0 1px 2px rgb(0 0 0 / 0.2),
			inset 0 0 0 1px rgb(255 255 255 / 0.1);
		pointer-events: none;
	}

	/*
	 * Anchored at the padding origin; every subsequent movement is Motion's
	 * transform, so `left`/`top` stay static and nothing competes with it.
	 */
	.lg-tabs-list :global(.lg-tabs-bubble) {
		position: absolute;
		top: 4px;
		left: 4px;
		pointer-events: none;
	}

	.lg-tabs-tab {
		position: relative;
		z-index: 1;
		appearance: none;
		border: 0;
		margin: 0;
		padding: 0.55rem 1.15rem;
		border-radius: 999px;
		background: none;
		color: inherit;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		opacity: 0.7;
		/* Decorative only — the bubble carries the movement. */
		transition: opacity 200ms ease;
	}

	.lg-tabs-tab[aria-selected='true'] {
		opacity: 1;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
	}

	.lg-tabs-tab:hover:not([aria-disabled='true']) {
		opacity: 0.95;
	}

	.lg-tabs-tab[aria-disabled='true'] {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.lg-tabs-tab:focus-visible {
		outline: 2px solid rgb(255 255 255 / 0.85);
		outline-offset: 2px;
	}

	[role='tabpanel']:focus-visible {
		outline: 2px solid rgb(255 255 255 / 0.6);
		outline-offset: 4px;
		border-radius: 8px;
	}

	@media (prefers-reduced-motion: reduce) {
		.lg-tabs-tab {
			transition-duration: 0ms;
		}
	}
</style>
