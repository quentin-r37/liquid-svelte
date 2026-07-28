<script lang="ts">
	import { animate } from 'motion';
	import { tick, untrack, type Snippet } from 'svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import { matchedRadius } from './displacement/cornerShape.js';
	import type { CornerShape, GlassMode, GlassQuality, GlassVariant } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { acquireGlassTransform, type GlassTransform } from './runtime/glassMotion.js';
	import { DIALOG_GEOMETRY, DIALOG_SURFACE, GLASS_DEFAULTS } from './runtime/glassTokens.js';
	import {
		DIALOG_COLLAPSE,
		DIALOG_ENTER,
		REDUCED_MOTION_TRANSITION,
		SHEET_COLLAPSE,
		springFor
	} from './runtime/motionTokens.js';

	export type DialogPresentation = 'center' | 'sheet';

	/**
	 * A modal glass surface: centered alert, or a sheet floating up from the
	 * bottom edge.
	 *
	 * ## Why this is not in the top layer
	 *
	 * Neither `<dialog>` nor the popover API is used, and it is the library's one
	 * constraint biting again rather than a preference: `backdrop-filter` samples
	 * down to its backdrop root, and a top-layer element's backdrop is not
	 * reliably the page it floats over — which is the only thing a glass modal
	 * exists to refract. So the overlay is an ordinary `position: fixed` element,
	 * and the consumer owns the corollary the whole library carries: rendered
	 * inside a transformed, filtered or `overflow: hidden` ancestor, the modal is
	 * clipped or loses its refraction. Mount it at the page root, or set
	 * `contained` and own the box it fills. Modality is therefore also built here
	 * — focus trap, scroll lock, scrim — rather than delegated to the platform.
	 *
	 * ## Why the entrance is not a puddle
	 *
	 * A popover grows out of its trigger, so liquid spilling from that point is
	 * the honest reading. A modal has no on-screen origin — it is summoned — and
	 * iOS presents alerts nearly at size, arriving from slightly below (see
	 * {@link DIALOG_ENTER}). The 6% scale step also keeps the corner-radius
	 * distortion a transform inflicts under a pixel, which is what lets this
	 * component skip the per-frame radius compensation LiquidMenu needs, and the
	 * near-constant geometry means there is no "not yet glass" state either: the
	 * panel wears its settled optics throughout and the scrim carries the
	 * entrance. The sheet is the same object with the travel on one axis: it
	 * rises from below the viewport on a spring and leaves on a monotone curve.
	 */
	interface Props {
		/** Bindable. */
		open?: boolean;
		/** `center` is an alert; `sheet` floats up from the bottom edge. */
		presentation?: DialogPresentation;
		/**
		 * Whether the scrim press and Escape dismiss. `false` for flows that must
		 * complete — the close button the consumer renders is then the only exit.
		 */
		dismissible?: boolean;
		/**
		 * Fill the nearest positioned ancestor instead of the viewport, and skip
		 * the scroll lock. For demos and split layouts where "modal" means "modal
		 * within this pane".
		 */
		contained?: boolean;
		variant?: GlassVariant;
		cornerShape?: CornerShape;
		/** Accessible name for the dialog. */
		label?: string;
		quality?: GlassQuality;
		mode?: GlassMode;
		class?: string;
		style?: string;
		onopenchange?: (open: boolean) => void;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		presentation = 'center',
		dismissible = true,
		contained = false,
		variant = GLASS_DEFAULTS.variant,
		cornerShape = GLASS_DEFAULTS.cornerShape,
		label,
		quality = 'medium',
		mode = 'auto',
		class: className = '',
		style = '',
		onopenchange,
		children
	}: Props = $props();

	let panelElement = $state<HTMLElement | null>(null);
	let bodyElement = $state<HTMLElement | null>(null);
	let panelTransform = $state<GlassTransform | null>(null);

	/**
	 * The panel frost, and only for `regular`.
	 *
	 * iOS runs one `regular` material at two settings — a control's and a
	 * panel's — and a modal is the panel case (see `PANEL_FROST`). `clear` has no
	 * such split: measured against the platform it behaves identically behind a
	 * panel and behind a button, so it keeps the material's own figures, which is
	 * what leaving these undefined asks the primitive for.
	 */
	const panelBlur = $derived(variant === 'regular' ? DIALOG_SURFACE.blur : undefined);
	const panelSaturation = $derived(variant === 'regular' ? DIALOG_SURFACE.saturation : undefined);

	/** Outlives `open` by the length of the exit — the menu panel's `present`. */
	let present = $state(open);

	/**
	 * How far below its resting place the sheet starts and finishes: its own
	 * height plus the floating inset, i.e. entirely off the bottom edge.
	 *
	 * Measured per opening rather than cached — the panel is `visibility: hidden`
	 * while closed, which is laid out and measurable, and content may have
	 * changed since the last showing. The fallback covers the one unmeasurable
	 * case (a `display: none` ancestor): any figure comfortably past a plausible
	 * sheet, since it is only ever a starting point the spring leaves at once.
	 */
	function sheetOffset(): number {
		const height = panelElement?.offsetHeight ?? 0;
		return height > 0 ? height + DIALOG_GEOMETRY.inset * 2 : 640;
	}

	/** Park the transform in the closed state for the current presentation. */
	function park(transform: GlassTransform) {
		if (presentation === 'sheet') {
			transform.revealX.set(1);
			transform.revealY.set(1);
			transform.y.set(sheetOffset());
		} else {
			transform.revealX.set(DIALOG_ENTER.scale);
			transform.revealY.set(DIALOG_ENTER.scale);
			transform.y.set(DIALOG_ENTER.y);
		}
	}

	/*
	 * Acquisition in its own effect, depending on nothing but the element — see
	 * LiquidMenu for why `open` must never be tracked here.
	 */
	$effect(() => {
		if (!panelElement) return;
		const transform = acquireGlassTransform(panelElement);
		if (!untrack(() => open)) untrack(() => park(transform));
		panelTransform = transform;
		return () => {
			panelTransform = null;
			transform.revealX.set(1);
			transform.revealY.set(1);
			transform.y.set(0);
			transform.release();
		};
	});

	/** The entrance and the exit. */
	$effect(() => {
		const transform = panelTransform;
		if (!transform) return;

		const reduced = reducedMotion.current;
		const opening = open;
		const sheet = untrack(() => presentation) === 'sheet';

		if (opening) {
			// Re-park from rest so a sheet whose content changed since the last
			// showing starts from its own current height — never mid-exit, which
			// would teleport a panel the eye is following.
			if (!untrack(() => present)) untrack(() => park(transform));
			present = true;
		}

		transform.setActive(true);
		let settledFlag = false;
		const settle = () => {
			if (settledFlag) return;
			settledFlag = true;
			transform.setActive(false);
		};

		const collapse = reduced ? REDUCED_MOTION_TRANSITION : sheet ? SHEET_COLLAPSE : DIALOG_COLLAPSE;
		// The centered entrance and the sheet's rise want different springs: the
		// alert is a short settle ('spread' — stiff, barely any overshoot), the
		// sheet a long travel that should arrive with some give ('settle').
		const enter = springFor(sheet ? 'settle' : 'spread', reduced);

		const animations = sheet
			? [animate(transform.y, opening ? 0 : sheetOffset(), opening ? enter : collapse)]
			: [
					animate(transform.revealX, opening ? 1 : DIALOG_ENTER.scale, opening ? enter : collapse),
					animate(transform.revealY, opening ? 1 : DIALOG_ENTER.scale, opening ? enter : collapse),
					animate(transform.y, opening ? 0 : DIALOG_ENTER.y, opening ? enter : collapse)
				];

		let cancelled = false;
		Promise.all(animations.map((animation) => animation.finished))
			.then(() => {
				if (cancelled) return;
				settle();
				if (!opening) present = false;
			})
			.catch(() => {});

		return () => {
			cancelled = true;
			settle();
			for (const animation of animations) animation.stop();
		};
	});

	/**
	 * Focus: into the dialog on open, back where it was on close.
	 *
	 * The container takes it rather than a hunted-for first control — the ARIA
	 * dialog pattern's safe default for arbitrary content. The cleanup returns
	 * focus only if it is still inside the dialog: a close caused by focus
	 * having legitimately moved elsewhere must not yank it back.
	 *
	 * The grab waits a `tick()`, and the wait is load-bearing. `present` is
	 * written by the entrance effect *during* the same flush this one runs in, so
	 * this effect observes it before the `is-present` class has reached the DOM —
	 * and until it does, the overlay is `visibility: hidden`, which is a state
	 * that silently refuses focus. Nothing re-runs the effect afterwards (its
	 * dependencies are already at their new values), so an immediate `focus()`
	 * is not late, it is lost.
	 */
	$effect(() => {
		if (!open || !present) return;
		const previous = document.activeElement;
		let cancelled = false;
		tick().then(() => {
			if (cancelled) return;
			const body = bodyElement;
			// `preventScroll`, and it is not optional: at this instant the sheet is
			// still parked below the edge — the spring has barely left — so a plain
			// `focus()` makes the browser scroll the page to reveal the focused
			// element. The page visibly jumps a few dozen pixels on open and never
			// comes back; the panel is on its way regardless.
			if (body && !body.contains(document.activeElement)) body.focus({ preventScroll: true });
		});
		return () => {
			cancelled = true;
			const inside = bodyElement?.contains(document.activeElement);
			if (inside && previous instanceof HTMLElement && previous.isConnected)
				previous.focus({ preventScroll: true });
		};
	});

	/**
	 * Scroll lock, on the root scroller rather than `body` — overflow on `body`
	 * does not reliably stop root scrolling. Skipped when `contained`: a pane's
	 * modal has no business freezing the page around the pane.
	 */
	$effect(() => {
		if (!open || contained) return;
		const root = document.documentElement;
		const previous = root.style.overflow;
		const previousPadding = root.style.paddingRight;
		// Removing the scrollbar widens the viewport and reflows the whole page a
		// scrollbar's width to the right — the classic modal background jump, and
		// on Windows (classic scrollbars) it is a very visible ~17px. Padding the
		// root by exactly the width the scrollbar occupied holds the layout still;
		// on overlay-scrollbar platforms the measured width is 0 and this is inert.
		const scrollbar = window.innerWidth - root.clientWidth;
		root.style.overflow = 'hidden';
		if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
		return () => {
			root.style.overflow = previous;
			root.style.paddingRight = previousPadding;
		};
	});

	function setOpen(next: boolean) {
		if (next === open) return;
		open = next;
		onopenchange?.(next);
	}

	/**
	 * The focus trap. Tab cycles within the dialog; with nothing focusable the
	 * container keeps it. Handled on the overlay so it also catches focus
	 * mid-flight between the dialog's own controls.
	 */
	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (!open || !dismissible) return;
			event.preventDefault();
			setOpen(false);
			return;
		}
		if (event.key !== 'Tab' || !bodyElement) return;

		const focusable = Array.from(
			bodyElement.querySelectorAll<HTMLElement>(
				'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
			)
		).filter((candidate) => candidate.offsetParent !== null);

		if (focusable.length === 0) {
			event.preventDefault();
			bodyElement.focus();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;

		if (event.shiftKey && (active === first || active === bodyElement)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	/**
	 * `pointerdown`, prevented, so the press neither reaches the page under the
	 * scrim nor drags focus out of the trap; the dismissal itself only when
	 * allowed.
	 */
	function onScrimPress(event: PointerEvent) {
		event.preventDefault();
		if (dismissible) setOpen(false);
	}
</script>

<!--
	Mounted at all times, hidden with `visibility` — the menu panel's reasons: the
	displacement map is rasterised from the measured size (a panel created on open
	would spend the entrance on the degraded tier), and a hidden sheet can still be
	measured for its travel. The overlay carries none of the backdrop-root
	properties; the scrim's fade is an opacity on a *sibling* of the glass, which
	is harmless.
-->
<div
	class={`lg-dialog ${present ? 'is-present' : ''} ${open ? 'is-open' : ''} ${className}`}
	{style}
	data-presentation={presentation}
	data-contained={contained ? 'true' : undefined}
	onkeydowncapture={onKeyDown}
>
	<div class="lg-dialog-scrim" onpointerdown={onScrimPress} aria-hidden="true"></div>

	<LiquidGlass
		bind:element={panelElement}
		borderRadius={matchedRadius(DIALOG_GEOMETRY.radius, cornerShape)}
		{cornerShape}
		bezel={DIALOG_GEOMETRY.bezel}
		specularIntensity={DIALOG_SURFACE.specularIntensity}
		shadowIntensity={DIALOG_SURFACE.shadowIntensity}
		blur={panelBlur}
		saturation={panelSaturation}
		{quality}
		{mode}
		{variant}
		class="lg-dialog-panel"
	>
		<div
			bind:this={bodyElement}
			role="dialog"
			aria-modal="true"
			tabindex={-1}
			aria-label={label}
			class="lg-dialog-body"
		>
			{@render children?.()}
		</div>
	</LiquidGlass>
</div>

<style>
	.lg-dialog {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		box-sizing: border-box;
		/* Mirrors DIALOG_GEOMETRY.inset — the floating margin at every edge. */
		padding: 16px;
		/*
		 * The parked sheet lives a full panel-height below the overlay's bottom
		 * edge, laid out (it must stay measurable) and merely invisible — and a
		 * laid-out box past the edge extends the scrollable overflow of whatever
		 * ancestor scrolls, which under `contained` grows the page by a sheet's
		 * worth of blank scroll. Clipping at the overlay's own bounds costs
		 * nothing (everything past them is off screen by definition) and is safe
		 * on an ancestor of glass: `overflow` is not one of the backdrop-root
		 * properties, unlike the `clip-path` it must never be traded for.
		 */
		overflow: clip;
	}

	.lg-dialog[data-presentation='sheet'] {
		place-items: end center;
	}

	.lg-dialog[data-contained='true'] {
		position: absolute;
	}

	.lg-dialog:not(.is-present) {
		visibility: hidden;
	}

	.lg-dialog:not(.is-open) {
		pointer-events: none;
	}

	/*
	 * The scrim: iOS dims behind a modal, and the dimming is also what carries
	 * the entrance now that the panel arrives nearly at size. Faded via a
	 * transition rather than the transform channels because it is plain paint —
	 * no glass below it in this stacking context, nothing for the opacity to
	 * break.
	 */
	.lg-dialog-scrim {
		position: absolute;
		inset: 0;
		background: rgb(0 0 0 / 0.35);
		opacity: 0;
		transition: opacity 200ms ease;
	}

	.lg-dialog.is-open .lg-dialog-scrim {
		opacity: 1;
	}

	.lg-dialog :global(.lg-dialog-panel) {
		position: relative;
		display: block;
		width: min(400px, 100%);
		max-height: 100%;
		transform-origin: center;
		/* The other half of PANEL_FROST: a panel crushes the backdrop's chroma
		   harder than a control, so it takes none of the veil compensation every
		   control gets. Same rule as `.lg-menu-panel`. */
		--lg-chroma-boost: 1;
	}

	/*
	 * Third face of the split — the panel's dark veil density (see
	 * `--lg-panel-veil-boost` and `.lg-menu-panel`). Scoped to `regular`, unlike
	 * the menu's and popover's, because a clear dialog is the raw clear material
	 * (`DIALOG_SURFACE` only overrides blur and saturation for `regular`) and has
	 * no hand-tuned tint asking for a pin of its own.
	 */
	.lg-dialog :global(.lg-dialog-panel[data-variant='regular']) {
		--lg-veil-boost: var(--lg-panel-veil-boost);
	}

	.lg-dialog[data-presentation='sheet'] :global(.lg-dialog-panel) {
		width: min(560px, 100%);
	}

	.lg-dialog :global(.lg-dialog-panel > .lg-content) {
		display: block;
		max-height: inherit;
	}

	/* Mirrors DIALOG_GEOMETRY.padding. Scrollable so a tall dialog scrolls its
	   content rather than growing past the viewport. */
	.lg-dialog-body {
		box-sizing: border-box;
		padding: 20px;
		max-height: inherit;
		overflow-y: auto;
		outline: none;
		text-align: left;
	}

	@media (prefers-reduced-motion: reduce) {
		.lg-dialog-scrim {
			transition-duration: 0ms;
		}
	}
</style>
