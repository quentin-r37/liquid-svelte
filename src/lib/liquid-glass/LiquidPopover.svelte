<script lang="ts">
	import { animate } from 'motion';
	import { tick, untrack, type Snippet } from 'svelte';
	import LiquidButton, { type ButtonShape } from './LiquidButton.svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import { cornerExponent, cornerShapeCss, matchedRadius } from './displacement/cornerShape.js';
	import type { CornerShape, GlassMode, GlassQuality, GlassVariant } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { DropletMorph } from './runtime/dropletMorph.svelte.js';
	import { acquireGlassTransform, type GlassTransform } from './runtime/glassMotion.js';
	import { GLASS_DEFAULTS, POPOVER_GEOMETRY, POPOVER_GLASS } from './runtime/glassTokens.js';
	import {
		POPOVER_COLLAPSE,
		POPOVER_PUDDLE,
		POPOVER_PUDDLE_ROUNDNESS,
		POPOVER_RISE_DELAY,
		REDUCED_MOTION_TRANSITION,
		springFor
	} from './runtime/motionTokens.js';

	export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

	/**
	 * A generic anchored panel: `LiquidMenu`'s glass with the menu taken out.
	 *
	 * The menu is a popover that happens to contain a `role="menu"` list; this is
	 * the same surface holding whatever the consumer puts in it — a small form, a
	 * share row, a colour picker — with `role="dialog"` semantics (non-modal:
	 * the page behind stays live, and focus leaving the control dismisses it).
	 *
	 * It deliberately plays only the *puddle* opening, never the trigger morph.
	 * The morph's premise is that the trigger becomes the panel and stops being
	 * drawn; a popover's trigger is a toggle that stays on screen, pressed,
	 * pointing at the panel it opened — which is exactly the `morph={false}`
	 * reading the menu keeps around for triggers that must not vanish.
	 */
	interface Props {
		/** Bindable. */
		open?: boolean;
		/** Which corner the panel grows from, and which side of the trigger it sits on. */
		placement?: PopoverPlacement;
		disabled?: boolean;
		/** Shape and size of the trigger, forwarded to its `LiquidButton`. */
		triggerShape?: ButtonShape;
		triggerSize?: 'sm' | 'md' | 'lg';
		/**
		 * Material variant, forwarded to the trigger *and* driving the panel's morph
		 * endpoints (see `POPOVER_GLASS`) — one prop for both, for the menu's reason:
		 * two materials on the two halves of one control is a visible seam.
		 */
		variant?: GlassVariant;
		/** Corner outline of the settled panel. See LiquidMenu for the flight/rest split. */
		cornerShape?: CornerShape;
		/** Accessible name for the panel. Defaults to being labelled by the trigger. */
		label?: string;
		quality?: GlassQuality;
		mode?: GlassMode;
		class?: string;
		style?: string;
		onopenchange?: (open: boolean) => void;
		/** Trigger content. */
		trigger?: Snippet;
		/** Panel content. */
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		placement = 'bottom-start',
		disabled = false,
		triggerShape = 'pill',
		triggerSize = 'md',
		variant = GLASS_DEFAULTS.variant,
		cornerShape = GLASS_DEFAULTS.cornerShape,
		label,
		quality = 'medium',
		mode = 'auto',
		class: className = '',
		style = '',
		onopenchange,
		trigger,
		children
	}: Props = $props();

	const uid = $props.id();
	const panelId = `${uid}-panel`;
	const triggerId = `${uid}-trigger`;

	let wrapperElement = $state<HTMLElement | null>(null);
	let triggerElement = $state<HTMLElement | null>(null);
	let panelElement = $state<HTMLElement | null>(null);
	let bodyElement = $state<HTMLElement | null>(null);
	let panelTransform = $state<GlassTransform | null>(null);

	/**
	 * Whether the panel occupies space in the interaction and accessibility trees —
	 * outliving `open` by the length of the collapse, exactly as the menu's does.
	 */
	let present = $state(open);

	/** The panel is glass that has not settled yet — see LiquidMenu's droplet. */
	const droplet = new DropletMorph(POPOVER_GLASS[untrack(() => variant)]);
	$effect(() => droplet.setEndpoints(POPOVER_GLASS[variant]));
	$effect(() => droplet.setReduced(reducedMotion.current));
	$effect(() => () => droplet.destroy());

	/*
	 * Acquisition in its own effect, depending on nothing but the element —
	 * LiquidMenu documents at length why `open` must never be tracked here (the
	 * cleanup would tear the transform down on every toggle). A closed panel is
	 * parked at the puddle imperatively: initial state, not a transition.
	 */
	$effect(() => {
		if (!panelElement) return;
		const transform = acquireGlassTransform(panelElement);
		if (!untrack(() => open)) {
			transform.revealX.set(POPOVER_PUDDLE.scaleX);
			transform.revealY.set(POPOVER_PUDDLE.scaleY);
		}
		panelTransform = transform;
		return () => {
			panelTransform = null;
			transform.revealX.set(1);
			transform.revealY.set(1);
			transform.release();
		};
	});

	/** `superellipse()` K of the settled panel — see LiquidMenu's `settledK`. */
	const settledK = $derived(cornerExponent(cornerShape) / 2);

	/**
	 * The K the panel currently renders — `1` for the whole flight, `settledK`
	 * only at rest. A step, not an ease: rewriting a `superellipse()` per frame
	 * re-tessellates every layer's clip. The measurement and the argument live on
	 * LiquidMenu's `renderedK`; this is the same mechanism on the same surface.
	 */
	let renderedK = $state(1);

	/**
	 * The corner, driven against the scale — LiquidMenu's radius compensation
	 * without the deformation channels, which a popover does not drive. The
	 * radius asked for is the panel's own times a roundness that eases to 1 as
	 * the reveal completes, divided by the scale it is about to be multiplied
	 * by; the division cancels the transform, the roundness is the puddle shape.
	 */
	$effect(() => {
		const transform = panelTransform;
		const panel = panelElement;
		if (!transform || !panel) return;

		const k = Math.min(renderedK, settledK);
		if (settledK !== 1) {
			panel.style.setProperty('--lg-corner-shape-live', cornerShapeCss(k));
		}

		const write = () => {
			const scaleX = transform.revealX.get();
			const scaleY = transform.revealY.get();
			const settled = Math.min(1, Math.max(0, scaleY));

			const radius =
				matchedRadius(POPOVER_GEOMETRY.radius, k) *
				(1 + (POPOVER_PUDDLE_ROUNDNESS - 1) * (1 - settled));

			panel.style.setProperty('--lg-radius-x', `${radius / Math.max(scaleX, 0.01)}px`);
			panel.style.setProperty('--lg-radius-y', `${radius / Math.max(scaleY, 0.01)}px`);
		};

		write();
		const unsubscribe = [
			transform.revealX.on('change', write),
			transform.revealY.on('change', write)
		];

		return () => {
			for (const stop of unsubscribe) stop();
			panel.style.removeProperty('--lg-radius-x');
			panel.style.removeProperty('--lg-radius-y');
			panel.style.removeProperty('--lg-corner-shape-live');
		};
	});

	/**
	 * The spread: two springs on two channels, the rise delayed behind the spill
	 * (see POPOVER_RISE_DELAY's source, MENU_RISE_DELAY). Closing collapses both
	 * axes together on a monotone curve — exits must not overshoot.
	 */
	$effect(() => {
		const transform = panelTransform;
		if (!transform) return;

		const reduced = reducedMotion.current;
		const opening = open;

		if (opening) {
			if (!untrack(() => present)) {
				transform.revealX.set(POPOVER_PUDDLE.scaleX);
				transform.revealY.set(POPOVER_PUDDLE.scaleY);
			}
			present = true;
			droplet.engage();
		}

		renderedK = 1;
		transform.setActive(true);
		let settled = false;
		const settle = () => {
			if (settled) return;
			settled = true;
			transform.setActive(false);
		};

		const collapse = reduced ? REDUCED_MOTION_TRANSITION : POPOVER_COLLAPSE;

		const spreadX = animate(
			transform.revealX,
			opening ? 1 : POPOVER_PUDDLE.scaleX,
			opening ? springFor('spread', reduced) : collapse
		);
		const riseY = animate(
			transform.revealY,
			opening ? 1 : POPOVER_PUDDLE.scaleY,
			opening
				? { ...springFor('rise', reduced), delay: reduced ? 0 : POPOVER_RISE_DELAY }
				: collapse
		);

		let cancelled = false;
		Promise.all([spreadX.finished, riseY.finished])
			.then(() => {
				if (cancelled) return;
				settle();
				if (opening) {
					renderedK = untrack(() => settledK);
					return;
				}
				present = false;
				droplet.release();
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
	 * Focus moves into the panel on open — the container, not a hunted-for first
	 * control: a popover's content is arbitrary, and per the dialog pattern
	 * focusing the surface and letting Tab reach its controls is the one
	 * behaviour that is right whatever it holds. Gated on `present` because a
	 * `visibility: hidden` element cannot take focus.
	 */
	$effect(() => {
		if (!open || !present) return;
		let cancelled = false;
		// After a tick, not immediately: `present` was written during this same
		// flush, so the class that lifts `visibility: hidden` has not reached the
		// DOM yet — and a hidden element silently refuses focus. See LiquidDialog's
		// focus effect for the full argument.
		tick().then(() => {
			if (cancelled) return;
			const body = bodyElement;
			// `preventScroll` for LiquidDialog's reason: the panel is a 6%-height
			// puddle at this instant, and a scroll to reveal it shifts the page.
			if (body && !body.contains(document.activeElement)) body.focus({ preventScroll: true });
		});
		return () => {
			cancelled = true;
		};
	});

	function setOpen(next: boolean) {
		if (next === open) return;
		open = next;
		onopenchange?.(next);
	}

	/** `returnFocus` is honoured only while focus is still inside — LiquidMenu's rule. */
	function closePopover(returnFocus: boolean) {
		if (!open) return;
		const inside = wrapperElement?.contains(document.activeElement);
		setOpen(false);
		if (returnFocus && inside) triggerElement?.focus();
	}

	/** Dismissal on an outside press — `pointerdown`, not `click`, for the menu's reason. */
	$effect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (target instanceof Node && wrapperElement?.contains(target)) return;
			closePopover(false);
		};

		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	});

	/** Escape works from the trigger and from anywhere in the panel alike. */
	function onWrapperKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !open) return;
		event.preventDefault();
		closePopover(true);
	}

	/** Focus leaving the whole control closes it — screen-reader jumps included. */
	function onFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next instanceof Node && wrapperElement?.contains(next)) return;
		closePopover(false);
	}
</script>

<!--
	Plain absolute positioning against the trigger, deliberately not the top layer —
	see LiquidMenu's markup note. The consumer owns the corollary: an ancestor with
	`overflow: hidden` clips the panel, and a transformed ancestor kills its
	refraction.
-->
<div
	bind:this={wrapperElement}
	class={`lg-popover ${className}`}
	{style}
	style:--lg-popover-gap={`${POPOVER_GEOMETRY.gap}px`}
	style:--lg-popover-min-width={`${POPOVER_GEOMETRY.minWidth}px`}
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
		{variant}
		{quality}
		{mode}
		class="lg-popover-trigger"
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-controls={panelId}
		onclick={() => (open ? closePopover(true) : setOpen(true))}
	>
		{@render trigger?.()}
	</LiquidButton>

	<!--
		Mounted at all times, hidden with `visibility` — the menu panel's two
		compounding reasons: the displacement map is rasterised from the measured
		size (a panel created on open would open on the degraded tier), and
		`visibility: hidden` is measured by ResizeObserver while staying out of the
		tab order and the accessibility tree.
	-->
	<LiquidGlass
		bind:element={panelElement}
		borderRadius={matchedRadius(POPOVER_GEOMETRY.radius, cornerShape)}
		{cornerShape}
		bezel={POPOVER_GEOMETRY.bezel}
		displacement={POPOVER_GEOMETRY.bezel * droplet.visual.displacementRatio}
		opacity={droplet.visual.opacity}
		saturation={droplet.visual.saturation}
		blur={droplet.visual.blur}
		specularIntensity={droplet.visual.specularIntensity}
		shadowIntensity={0.2 + 0.7 * droplet.progress}
		{quality}
		{mode}
		{variant}
		class={`lg-popover-panel ${present ? 'is-present' : ''} ${open ? 'is-open' : ''}`}
	>
		<div
			bind:this={bodyElement}
			id={panelId}
			role="dialog"
			tabindex={-1}
			aria-label={label}
			aria-labelledby={label ? undefined : triggerId}
			class="lg-popover-body"
		>
			{@render children?.()}
		</div>
	</LiquidGlass>
</div>

<style>
	.lg-popover {
		position: relative;
		display: inline-block;

		/* The panel clears the trigger's full height plus the gap — the menu's
		   non-morph offset, which is the only offset a popover has. */
		--lg-popover-offset: calc(100% + var(--lg-popover-gap));

		/* Content fades in behind the spread — see the menu's content-delay note. */
		--lg-popover-content-delay: 70ms;
	}

	.lg-popover :global(.lg-popover-panel) {
		position: absolute;
		z-index: 30;
		display: block;
		min-width: var(--lg-popover-min-width);
		max-width: min(22rem, 84vw);
	}

	.lg-popover :global(.lg-popover-panel > .lg-content) {
		display: block;
	}

	/* Hidden, still laid out, still measured. `visibility` is safe on glass where
	   `opacity` is not — it creates no backdrop root. */
	.lg-popover :global(.lg-popover-panel:not(.is-present)) {
		visibility: hidden;
	}

	/* Ignore presses at once on close, while the collapse still plays. */
	.lg-popover :global(.lg-popover-panel:not(.is-open)) {
		pointer-events: none;
	}

	.lg-popover[data-placement='bottom-start'] :global(.lg-popover-panel) {
		top: var(--lg-popover-offset);
		left: 0;
		transform-origin: top left;
	}

	.lg-popover[data-placement='bottom-end'] :global(.lg-popover-panel) {
		top: var(--lg-popover-offset);
		right: 0;
		transform-origin: top right;
	}

	.lg-popover[data-placement='top-start'] :global(.lg-popover-panel) {
		bottom: var(--lg-popover-offset);
		left: 0;
		transform-origin: bottom left;
	}

	.lg-popover[data-placement='top-end'] :global(.lg-popover-panel) {
		bottom: var(--lg-popover-offset);
		right: 0;
		transform-origin: bottom right;
	}

	/*
	 * The body carries the padding rather than the panel so the fade below has a
	 * single element to ride; mirrors POPOVER_GEOMETRY.padding.
	 */
	.lg-popover-body {
		box-sizing: border-box;
		padding: var(--lg-popover-padding, 14px);
		outline: none;
		text-align: left;
	}

	/*
	 * Content fades in behind the spread and leaves fast with no delay — both
	 * halves of the menu's item fade, on one element. Opacity is harmless here:
	 * a descendant of the glass, never the glass itself.
	 */
	.lg-popover-body {
		opacity: 0;
		transform: translateY(-6px);
		transition:
			opacity 90ms ease,
			transform 90ms ease;
	}

	:global(.lg-popover-panel.is-open) .lg-popover-body {
		opacity: 1;
		transform: none;
		transition:
			opacity 170ms ease var(--lg-popover-content-delay),
			transform 240ms cubic-bezier(0.2, 0.8, 0.3, 1) var(--lg-popover-content-delay);
	}

	@media (prefers-reduced-motion: reduce) {
		.lg-popover-body {
			transition-duration: 0ms;
			transition-delay: 0ms;
		}
	}
</style>
