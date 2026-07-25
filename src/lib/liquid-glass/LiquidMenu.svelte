<script lang="ts">
	import { animate } from 'motion';
	import { untrack, type Snippet } from 'svelte';
	import LiquidButton from './LiquidButton.svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { DropletMorph } from './runtime/dropletMorph.svelte.js';
	import { acquireGlassTransform, type GlassTransform } from './runtime/glassMotion.js';
	import { MENU_GEOMETRY, MENU_GLASS_OPEN, MENU_GLASS_REST } from './runtime/glassTokens.js';
	import { MENU_PUDDLE, MENU_RISE_DELAY, springFor } from './runtime/motionTokens.js';

	export interface LiquidMenuItem {
		/** Stable identifier, reported by `onselect`. */
		id: string;
		label: string;
		/** Second line, smaller and dimmer — iOS uses these for context. */
		hint?: string;
		disabled?: boolean;
		/** Destructive styling. Reads as "delete", as it does on iOS. */
		destructive?: boolean;
		/** Draw a hairline separator above this item. */
		separated?: boolean;
	}

	export type MenuPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

	interface Props {
		items: LiquidMenuItem[];
		/** Bindable. */
		open?: boolean;
		/** Which corner the panel grows from, and which side of the trigger it sits on. */
		placement?: MenuPlacement;
		disabled?: boolean;
		/** Accessible name for the menu. Defaults to being labelled by the trigger. */
		menuLabel?: string;
		quality?: GlassQuality;
		mode?: GlassMode;
		class?: string;
		style?: string;
		onselect?: (id: string) => void;
		onopenchange?: (open: boolean) => void;
		/** Trigger content. */
		children?: Snippet;
		/** Replaces the default item body. Receives the item. */
		item?: Snippet<[LiquidMenuItem]>;
	}

	let {
		items,
		open = $bindable(false),
		placement = 'bottom-start',
		disabled = false,
		menuLabel,
		quality = 'high',
		mode = 'auto',
		class: className = '',
		style = '',
		onselect,
		onopenchange,
		children,
		item
	}: Props = $props();

	const uid = $props.id();
	const menuId = `${uid}-menu`;
	const triggerId = `${uid}-trigger`;

	let wrapperElement = $state<HTMLElement | null>(null);
	let triggerElement = $state<HTMLElement | null>(null);
	let panelElement = $state<HTMLElement | null>(null);
	let panelTransform = $state<GlassTransform | null>(null);
	let itemElements = $state<Record<string, HTMLButtonElement | undefined>>({});

	/**
	 * Whether the panel occupies space in the interaction and accessibility trees.
	 *
	 * Distinct from `open` because it has to outlive it: the collapse has to finish
	 * playing before the panel is hidden, so this only goes false when the exit
	 * animation settles. It is what drives `visibility`, which is the whole reason the
	 * panel can stay mounted — see the comment on the panel's styles.
	 */
	let present = $state(open);

	/**
	 * The item that currently has focus, tracked by id rather than index so it
	 * survives the list changing under it.
	 *
	 * Focus *is* the highlight here: pointing at an item moves focus to it, the way
	 * native menus behave. Keeping two separate notions — a hovered item and a focused
	 * item — is what makes a menu announce one thing to a screen reader while showing
	 * another.
	 */
	let activeId = $state<string | null>(null);

	const enabled = $derived(items.filter((entry) => !entry.disabled));

	/**
	 * The panel is glass that has not settled yet.
	 *
	 * A puddle 6% of its final height has no thickness to refract with, so the
	 * refraction, tint and rim all grow with the spread rather than being switched on
	 * at the end. Every one of those is a live filter attribute, so none of it touches
	 * the displacement map — it is rasterised once, while the panel is still hidden.
	 *
	 * The drop shadow rides the same progress (see the panel's `shadowIntensity`): a
	 * puddle lying on the page has almost no elevation to cast one, and letting it grow
	 * in is what makes the panel look like it lifts off as it fills rather than sliding
	 * out already floating.
	 */
	const droplet = new DropletMorph({ rest: MENU_GLASS_REST, active: MENU_GLASS_OPEN });
	$effect(() => droplet.setReduced(reducedMotion.current));
	$effect(() => () => droplet.destroy());

	/*
	 * Acquisition, in its own effect and depending on nothing but the element.
	 *
	 * `open` must never be *tracked* here, and this is not a style preference. Reading
	 * it makes the effect depend on it, so every single toggle runs the cleanup first:
	 * `release()` drops the last holder, the channels are destroyed and
	 * `element.style.transform` is cleared — the panel jumps to full size within the
	 * click's own frame. A fresh set of channels is then created at identity (1, 1),
	 * and the reveal effect below dutifully animates from 1 to 1. The result is a menu
	 * that appears instantly no matter what the springs say, which is exactly what it
	 * did until this comment existed.
	 *
	 * Hence `untrack`: the initial state is genuinely wanted, the dependency is not.
	 *
	 * A closed panel is parked at the puddle imperatively rather than animated into it:
	 * that is its initial state, not a transition, and animating would play a collapse
	 * on mount.
	 */
	$effect(() => {
		if (!panelElement) return;
		const transform = acquireGlassTransform(panelElement);
		if (!untrack(() => open)) {
			transform.revealX.set(MENU_PUDDLE.scaleX);
			transform.revealY.set(MENU_PUDDLE.scaleY);
		}
		panelTransform = transform;
		return () => {
			panelTransform = null;
			transform.revealX.set(1);
			transform.revealY.set(1);
			transform.release();
		};
	});

	/**
	 * The spread.
	 *
	 * Two springs on two channels, the vertical one delayed behind the horizontal
	 * (see {@link MENU_PUDDLE} and {@link MENU_RISE_DELAY}): the panel spills sideways
	 * out of the trigger and then rises, which is what separates a puddle finding its
	 * edges from a rectangle being scaled up. `transform-origin` puts the source at
	 * whichever corner the trigger is on, and lives in CSS because Motion owns
	 * `transform` but not its origin.
	 *
	 * Closing is one stiff spring on both axes at once, with no lag. Dismissal should
	 * be over before it is noticed; only the opening is worth watching.
	 *
	 * Nothing here animates width, height, radius or bezel — those are the
	 * displacement map's cache key. The whole reveal is a transform plus a handful of
	 * live filter attributes.
	 */
	$effect(() => {
		const transform = panelTransform;
		if (!transform) return;

		const reduced = reducedMotion.current;
		const opening = open;

		if (opening) {
			present = true;
			droplet.engage();
		} else {
			droplet.release();
		}

		// `will-change: transform` for the duration of the reveal only. Left on
		// permanently it would keep a compositor layer alive for every menu on the page.
		transform.setActive(true);
		let settled = false;
		const settle = () => {
			if (settled) return;
			settled = true;
			transform.setActive(false);
		};

		const spreadX = animate(
			transform.revealX,
			opening ? 1 : MENU_PUDDLE.scaleX,
			springFor(opening ? 'spread' : 'snap', reduced)
		);
		const riseY = animate(
			transform.revealY,
			opening ? 1 : MENU_PUDDLE.scaleY,
			opening
				? { ...springFor('rise', reduced), delay: reduced ? 0 : MENU_RISE_DELAY }
				: springFor('snap', reduced)
		);

		let cancelled = false;
		Promise.all([spreadX.finished, riseY.finished])
			.then(() => {
				if (cancelled) return;
				settle();
				// Hiding is deferred to here so the collapse is allowed to play out. A
				// re-open mid-collapse cancels this run, so it can never hide an open menu.
				if (!opening) present = false;
			})
			.catch(() => {});

		return () => {
			cancelled = true;
			settle();
			spreadX.stop();
			riseY.stop();
		};
	});

	/**
	 * Focus follows `activeId`.
	 *
	 * Guarded on `present`, because a `visibility: hidden` element cannot take focus —
	 * the state is written the moment the menu opens, and the panel is only focusable
	 * once that has reached the DOM.
	 */
	$effect(() => {
		if (!open || !present || !activeId) return;
		const element = itemElements[activeId];
		if (element && document.activeElement !== element) element.focus();
	});

	function setOpen(next: boolean) {
		if (next === open) return;
		open = next;
		onopenchange?.(next);
	}

	/**
	 * Opens with the first or last *enabled* item focused, per the ARIA menu pattern.
	 *
	 * A menu whose every item is disabled still opens, with focus left on the trigger:
	 * seeing why the actions are unavailable is the point of opening it. Only a menu
	 * with no items at all refuses.
	 */
	function openMenu(focus: 'first' | 'last') {
		if (disabled || items.length === 0) return;
		const target = focus === 'last' ? enabled[enabled.length - 1] : enabled[0];
		activeId = target?.id ?? null;
		setOpen(true);
	}

	/**
	 * `returnFocus` is honoured only when focus is still inside the menu. Closing
	 * because the user clicked something else across the page must not yank their
	 * focus back to the trigger.
	 */
	function closeMenu(returnFocus: boolean) {
		if (!open) return;
		const inside = wrapperElement?.contains(document.activeElement);
		setOpen(false);
		activeId = null;
		if (returnFocus && inside) triggerElement?.focus();
	}

	function select(entry: LiquidMenuItem) {
		if (entry.disabled) return;
		onselect?.(entry.id);
		closeMenu(true);
	}

	/** Wraps around, and skips disabled items by walking `enabled` rather than `items`. */
	function move(delta: number) {
		if (enabled.length === 0) return;

		const current = enabled.findIndex((entry) => entry.id === activeId);
		// Nothing focused yet — every disabled menu, and any menu opened by pointer —
		// so enter the list from whichever end the key points at.
		if (current === -1) {
			activeId = (delta > 0 ? enabled[0] : enabled[enabled.length - 1]).id;
			return;
		}

		activeId = enabled[(current + delta + enabled.length) % enabled.length].id;
	}

	/**
	 * Dismissal on an outside press, bound only while open.
	 *
	 * `pointerdown` rather than `click`: a press that starts outside should dismiss
	 * immediately, and by `click` time the browser has already moved focus, which
	 * makes the focus bookkeeping in `closeMenu` unreliable.
	 */
	$effect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (target instanceof Node && wrapperElement?.contains(target)) return;
			closeMenu(false);
		};

		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	});

	function onTriggerKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			openMenu('first');
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			openMenu('last');
		}
	}

	function onMenuKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') move(1);
		else if (event.key === 'ArrowUp') move(-1);
		else if (event.key === 'Home') activeId = enabled[0]?.id ?? null;
		else if (event.key === 'End') activeId = enabled[enabled.length - 1]?.id ?? null;
		// Tab takes focus out of the menu, so the menu should not be left behind. Not
		// prevented — moving on to the next control is exactly what was asked for.
		else if (event.key === 'Tab') return closeMenu(false);
		else return;

		event.preventDefault();
	}

	/** Escape is handled on the wrapper so it works from the trigger and the items alike. */
	function onWrapperKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !open) return;
		event.preventDefault();
		closeMenu(true);
	}

	/**
	 * Focus leaving the whole control closes it. This is what makes the menu behave
	 * when focus moves by any means this component has not enumerated — a screen
	 * reader jumping elsewhere, a browser find, a nested iframe.
	 */
	function onFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next instanceof Node && wrapperElement?.contains(next)) return;
		closeMenu(false);
	}
</script>

<!--
	Positioned relative to the trigger with plain absolute positioning, deliberately
	not the top layer: `backdrop-filter` inside a popover would sample a backdrop the
	panel is no longer part of. The corollary is the consumer's to own — an ancestor
	with `overflow: hidden` clips the panel, and (as everywhere in this library) a
	transformed ancestor kills its refraction.
-->
<div
	bind:this={wrapperElement}
	class={`lg-menu ${className}`}
	{style}
	style:--lg-menu-gap={`${MENU_GEOMETRY.gap}px`}
	style:--lg-menu-min-width={`${MENU_GEOMETRY.minWidth}px`}
	data-placement={placement}
	onkeydowncapture={onWrapperKeyDown}
	onfocusout={onFocusOut}
>
	<LiquidButton
		bind:element={triggerElement}
		id={triggerId}
		{disabled}
		{quality}
		{mode}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={menuId}
		onclick={() => (open ? closeMenu(true) : openMenu('first'))}
		onkeydown={onTriggerKeyDown}
	>
		{@render children?.()}
	</LiquidButton>

	<!--
		Mounted at all times, hidden with `visibility` rather than `{#if}`.

		Two reasons, and they compound. The displacement map is rasterised from the
		measured size, so a panel created on open would spend its first frames on the
		degraded tier and snap into refraction once the PNG arrived — visible, and
		exactly during the animation that matters. And `visibility: hidden` is measured
		by `ResizeObserver` (unlike `display: none`), yet is out of the tab order and out
		of the accessibility tree, which is what a closed menu has to be.
	-->
	<LiquidGlass
		bind:element={panelElement}
		borderRadius={MENU_GEOMETRY.radius}
		bezel={MENU_GEOMETRY.bezel}
		displacement={MENU_GEOMETRY.bezel * droplet.visual.displacementRatio}
		opacity={droplet.visual.opacity}
		saturation={droplet.visual.saturation}
		blur={droplet.visual.blur}
		specularIntensity={droplet.visual.specularIntensity}
		shadowIntensity={0.2 + 0.7 * droplet.progress}
		{quality}
		{mode}
		class={`lg-menu-panel ${present ? 'is-present' : ''} ${open ? 'is-open' : ''}`}
	>
		<!--
			`tabindex="-1"` keeps the container out of the tab order while leaving it a
			legitimate target for the key handler: focus lives on the items, per the ARIA
			menu pattern, and only ever moves between them programmatically.
		-->
		<div
			id={menuId}
			role="menu"
			tabindex={-1}
			aria-label={menuLabel}
			aria-labelledby={menuLabel ? undefined : triggerId}
			class="lg-menu-list"
			onkeydown={onMenuKeyDown}
		>
			{#each items as entry (entry.id)}
				{#if entry.separated}
					<span class="lg-menu-separator" role="separator"></span>
				{/if}
				<button
					bind:this={itemElements[entry.id]}
					type="button"
					role="menuitem"
					class="lg-menu-item"
					class:lg-menu-destructive={entry.destructive}
					disabled={entry.disabled}
					aria-disabled={entry.disabled ? 'true' : undefined}
					tabindex={entry.id === activeId ? 0 : -1}
					onclick={() => select(entry)}
					onfocus={() => (activeId = entry.id)}
					onpointerenter={() => itemElements[entry.id]?.focus()}
				>
					{#if item}
						{@render item(entry)}
					{:else}
						<span class="lg-menu-label">{entry.label}</span>
						{#if entry.hint}
							<span class="lg-menu-hint">{entry.hint}</span>
						{/if}
					{/if}
				</button>
			{/each}
		</div>
	</LiquidGlass>
</div>

<style>
	.lg-menu {
		position: relative;
		display: inline-block;
	}

	/*
	 * The panel is a block, overriding the primitive's centring inline-flex: a menu is
	 * a list that fills its box, not a label centred in a pill.
	 */
	.lg-menu :global(.lg-menu-panel) {
		position: absolute;
		z-index: 30;
		display: block;
		min-width: var(--lg-menu-min-width);
		max-width: min(20rem, 80vw);
		padding: 6px;
	}

	.lg-menu :global(.lg-menu-panel > .lg-content) {
		display: block;
	}

	/*
	 * Hidden, but still laid out and still measured — see the markup. `visibility` is
	 * safe on a glass surface in a way `opacity` is not: it is not one of the
	 * properties that turns an element into a backdrop root.
	 */
	.lg-menu :global(.lg-menu-panel:not(.is-present)) {
		visibility: hidden;
	}

	/* Ignore presses at once on close, while the collapse is still playing out. */
	.lg-menu :global(.lg-menu-panel:not(.is-open)) {
		pointer-events: none;
	}

	/*
	 * Placement drives both the anchoring and the corner the liquid grows from. The
	 * origin is CSS rather than part of the animation because Motion owns `transform`
	 * on this element and nothing else may write it.
	 */
	.lg-menu[data-placement='bottom-start'] :global(.lg-menu-panel) {
		top: calc(100% + var(--lg-menu-gap));
		left: 0;
		transform-origin: top left;
	}

	.lg-menu[data-placement='bottom-end'] :global(.lg-menu-panel) {
		top: calc(100% + var(--lg-menu-gap));
		right: 0;
		transform-origin: top right;
	}

	.lg-menu[data-placement='top-start'] :global(.lg-menu-panel) {
		bottom: calc(100% + var(--lg-menu-gap));
		left: 0;
		transform-origin: bottom left;
	}

	.lg-menu[data-placement='top-end'] :global(.lg-menu-panel) {
		bottom: calc(100% + var(--lg-menu-gap));
		right: 0;
		transform-origin: bottom right;
	}

	/*
	 * The items fade in behind the spread rather than with it.
	 *
	 * They are inside the panel, so they are squashed by the same scale that opens it —
	 * and squashed text is the one part of this that would read as cheap. By the time
	 * the delay is up the vertical rise is nearly done, so what fades in is already
	 * close to its final shape. Both properties are on a *descendant* of the glass,
	 * which is why an opacity here is harmless.
	 */
	.lg-menu-list {
		opacity: 0;
		transform: translateY(-6px);
		transition:
			opacity 170ms ease 90ms,
			transform 240ms cubic-bezier(0.2, 0.8, 0.3, 1) 90ms;
	}

	/* `:global()` leads the selector rather than sitting inside it: Svelte only allows
	   it at either end, and the scoped `.lg-menu-list` has to stay scoped. */
	:global(.lg-menu-panel.is-open) .lg-menu-list {
		opacity: 1;
		transform: none;
	}

	.lg-menu-item {
		display: flex;
		flex-direction: column;
		gap: 1px;
		width: 100%;
		box-sizing: border-box;
		appearance: none;
		border: 0;
		margin: 0;
		padding: 0.5rem 0.7rem;
		border-radius: 13px;
		background: none;
		color: inherit;
		font: inherit;
		font-size: 0.875rem;
		text-align: left;
		cursor: pointer;
		transition: background-color 140ms ease;
	}

	/*
	 * `:focus`, not `:focus-visible`: pointing at an item focuses it, so focus is the
	 * highlight for mouse and keyboard alike. The ring is kept separate, and stays
	 * keyboard-only.
	 */
	.lg-menu-item:focus {
		background: rgb(255 255 255 / 0.16);
		outline: none;
	}

	.lg-menu-item:focus-visible {
		outline: 2px solid rgb(255 255 255 / 0.8);
		outline-offset: -2px;
	}

	.lg-menu-item:active:not(:disabled) {
		background: rgb(255 255 255 / 0.24);
	}

	.lg-menu-item:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.lg-menu-label {
		font-weight: 550;
	}

	.lg-menu-destructive {
		color: rgb(255 138 128);
	}

	.lg-menu-hint {
		font-size: 0.75rem;
		opacity: 0.62;
	}

	.lg-menu-separator {
		display: block;
		height: 1px;
		margin: 5px 0.4rem;
		background: rgb(255 255 255 / 0.14);
	}

	@media (prefers-reduced-motion: reduce) {
		.lg-menu-list,
		.lg-menu-item {
			transition-duration: 0ms;
			transition-delay: 0ms;
		}
	}
</style>
