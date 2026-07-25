<script lang="ts">
	import { animate } from 'motion';
	import { untrack, type Snippet } from 'svelte';
	import LiquidButton, { type ButtonShape } from './LiquidButton.svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { DropletMorph } from './runtime/dropletMorph.svelte.js';
	import { acquireGlassTransform, type GlassTransform } from './runtime/glassMotion.js';
	import { MENU_GEOMETRY, MENU_GLASS_OPEN, MENU_GLASS_REST } from './runtime/glassTokens.js';
	import {
		MENU_COLLAPSE,
		MENU_PUDDLE,
		MENU_RISE_DELAY,
		REDUCED_MOTION_TRANSITION,
		springFor
	} from './runtime/motionTokens.js';

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
		/**
		 * Shape and size of the trigger, forwarded to its `LiquidButton`.
		 *
		 * Here because the trigger is the component's own button and a consumer has no
		 * other way at it. A menu pinned in a nav bar next to circular actions has to be
		 * able to be one too, or it is the one control on the row that is a different
		 * object.
		 */
		triggerShape?: ButtonShape;
		triggerSize?: 'sm' | 'md' | 'lg';
		/**
		 * Open by *transforming the trigger into the panel*, the way iOS does it, rather
		 * than by spilling a panel out beside a trigger that stays put.
		 *
		 * The panel starts as a copy of the trigger's box — same size, same place — and
		 * the trigger stops being drawn for exactly as long as the panel is out, so what
		 * the eye follows is one object changing shape rather than two objects, one of
		 * which appeared. The starting box is measured from the two elements instead of
		 * being taken from {@link MENU_PUDDLE}: it is a morph only if the shape that
		 * appears is the shape that was already there.
		 *
		 * `false` restores the puddle-beside-the-trigger opening. Worth having for a
		 * trigger that has to stay on screen — one that is also the only thing marking
		 * its position in a bar, say, where losing it leaves a hole.
		 */
		morph?: boolean;
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
		triggerShape = 'pill',
		triggerSize = 'md',
		morph = true,
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

	/**
	 * Where the panel comes from, expressed on the channels that open it: a scale per
	 * axis and one vertical offset.
	 *
	 * Under `morph` that is the trigger's own box, and it has to be *measured* — the
	 * two boxes are whatever their content made them. `transform-origin` already sits
	 * on the corner the panel shares with the trigger (see the placement rules), and a
	 * scale leaves its origin where it is, so aligning the two boxes needs no
	 * horizontal travel at all: the shared corner is already in the right column. What
	 * is left is the vertical gap between them — the trigger's height plus
	 * {@link MENU_GEOMETRY.gap}, signed by which side the panel is on.
	 *
	 * Read at the top of every opening rather than cached. The panel is measurable
	 * while closed (`visibility: hidden` is laid out, which is half of why it stays
	 * mounted), but a menu whose items or trigger changed in the meantime would
	 * otherwise morph out of a box that no longer exists.
	 *
	 * Without `morph`, the declared puddle and no travel — the original opening,
	 * unchanged.
	 */
	function morphStart(): { scaleX: number; scaleY: number; offsetY: number } {
		const puddle = { scaleX: MENU_PUDDLE.scaleX, scaleY: MENU_PUDDLE.scaleY, offsetY: 0 };
		if (!morph || !triggerElement || !panelElement) return puddle;

		const panelWidth = panelElement.offsetWidth;
		const panelHeight = panelElement.offsetHeight;
		// No layout yet — measured before the first one, or inside a `display: none`
		// ancestor. Dividing by that would park the panel at `scale(Infinity)`, which is
		// not a state it can animate out of.
		if (panelWidth === 0 || panelHeight === 0) return puddle;

		const triggerHeight = triggerElement.offsetHeight;
		const below = placement.startsWith('bottom');

		return {
			scaleX: triggerElement.offsetWidth / panelWidth,
			scaleY: triggerHeight / panelHeight,
			offsetY: (below ? -1 : 1) * (triggerHeight + MENU_GEOMETRY.gap)
		};
	}

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
	 * A closed panel is parked at its starting box imperatively rather than animated
	 * into it: that is its initial state, not a transition, and animating would play a
	 * collapse on mount.
	 */
	$effect(() => {
		if (!panelElement) return;
		const transform = acquireGlassTransform(panelElement);
		if (!untrack(() => open)) {
			const start = untrack(morphStart);
			transform.revealX.set(start.scaleX);
			transform.revealY.set(start.scaleY);
			transform.y.set(start.offsetY);
		}
		panelTransform = transform;
		return () => {
			panelTransform = null;
			transform.revealX.set(1);
			transform.revealY.set(1);
			transform.y.set(0);
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
	 * A third channel under `morph`: the panel's travel from on top of the trigger to
	 * its resting place beside it (see {@link morphStart}). It rides the *spread*
	 * spring rather than the delayed rise, so the sheet steps off the trigger as it
	 * spills — the alternative is a panel that widens while still sitting on the
	 * button and then slides out from under itself. Off, `offsetY` is zero at both
	 * ends and the animation is a formality.
	 *
	 * Closing is neither sequenced nor sprung: both axes collapse together on a plain
	 * monotone curve — see {@link MENU_COLLAPSE} for why an exit must not overshoot —
	 * and the optics are left alone until the panel is out of sight. Dismissal should be
	 * over before it is noticed; only the opening is worth watching.
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
		const start = untrack(morphStart);

		if (opening) {
			// Re-park on the box just measured, before anything moves. The parked values
			// are derived from two elements that may have been resized — or had their
			// content replaced — since the panel was last closed, and a morph that starts
			// from a stale box starts with a jump. Only ever from rest: the same write
			// against a panel that is still collapsing would teleport it mid-flight.
			if (!untrack(() => present)) {
				transform.revealX.set(start.scaleX);
				transform.revealY.set(start.scaleY);
				transform.y.set(start.offsetY);
			}
			present = true;

			// Only the opening morphs the optics. Reversing the morph *while the panel is
			// still visible* would run its milky rest tint (0.3, versus 0.12 settled)
			// backwards over the collapse, turning the shrinking sheet into an opaque white
			// bar — the one thing guaranteed to draw the eye to a panel that is leaving. So
			// the liquid drains away as clear glass, and the puddle's optics are restored
			// after it is hidden, below.
			droplet.engage();
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

		const collapse = reduced ? REDUCED_MOTION_TRANSITION : MENU_COLLAPSE;

		const spreadX = animate(
			transform.revealX,
			opening ? 1 : start.scaleX,
			opening ? springFor('spread', reduced) : collapse
		);
		const riseY = animate(
			transform.revealY,
			opening ? 1 : start.scaleY,
			opening ? { ...springFor('rise', reduced), delay: reduced ? 0 : MENU_RISE_DELAY } : collapse
		);
		const glideY = animate(
			transform.y,
			opening ? 0 : start.offsetY,
			opening ? springFor('spread', reduced) : collapse
		);

		let cancelled = false;
		Promise.all([spreadX.finished, riseY.finished, glideY.finished])
			.then(() => {
				if (cancelled) return;
				settle();
				if (opening) return;

				// The collapse is over, so the panel goes out of the interaction and
				// accessibility trees — and only now, unseen, are the puddle's optics
				// restored, ready for the next opening. A re-open mid-collapse cancels this
				// run, so neither can ever happen to a menu that is on its way back in.
				present = false;
				droplet.release();
			})
			.catch(() => {});

		return () => {
			cancelled = true;
			settle();
			spreadX.stop();
			riseY.stop();
			glideY.stop();
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
		shape={triggerShape}
		size={triggerSize}
		{quality}
		{mode}
		class={`lg-menu-trigger ${morph && present ? 'is-yielded' : ''}`}
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
	 * The other half of the morph: the trigger *is* the panel for as long as the panel
	 * is out, so it stops being drawn for exactly that long — `present`, not `open`,
	 * which is what makes it come back at the end of the collapse rather than at the
	 * start of it. The shrinking sheet is the button on its way home; a button
	 * reappearing underneath it while it is still travelling is two of them.
	 *
	 * Switched, never transitioned. Any opacity strictly between 0 and 1 turns the
	 * button into a backdrop root and kills its own refraction, so a fade would spend
	 * its whole length showing a flat disc where a lens was. There is nothing to fade
	 * anyway: both swaps happen on a frame where the panel is parked exactly over the
	 * trigger, at its size, in its place.
	 *
	 * `opacity: 0` rather than `visibility: hidden` because a hidden element cannot
	 * take focus, and closing returns focus here — from a hidden trigger it would land
	 * on the body instead, which is the one place a keyboard user cannot continue
	 * from. Invisible and focusable is also what the trigger has to be for a screen
	 * reader, which is still being told there is an expanded menu button here.
	 */
	.lg-menu :global(.lg-menu-trigger.is-yielded) {
		opacity: 0;
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
	/*
	 * This rule is the *exit*, and the transition declared on it is the one the browser
	 * uses on the way out — a transition is read from the state being moved to, which is
	 * what makes each direction independently tunable.
	 *
	 * Leaving out on the way out is not optional. The entrance delay applies in both
	 * directions if it is declared in one place, so the items used to sit there for 90ms
	 * before beginning to fade, and were then squashed flat by the collapse. Out fast,
	 * with no delay: the glass should have nothing left in it by the time it drains.
	 */
	.lg-menu-list {
		opacity: 0;
		transform: translateY(-6px);
		transition:
			opacity 90ms ease,
			transform 90ms ease;
	}

	/* `:global()` leads the selector rather than sitting inside it: Svelte only allows
	   it at either end, and the scoped `.lg-menu-list` has to stay scoped. */
	:global(.lg-menu-panel.is-open) .lg-menu-list {
		opacity: 1;
		transform: none;
		transition:
			opacity 170ms ease 90ms,
			transform 240ms cubic-bezier(0.2, 0.8, 0.3, 1) 90ms;
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
