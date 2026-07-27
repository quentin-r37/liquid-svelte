<script lang="ts">
	import { animate, type MotionValue } from 'motion';
	import { untrack, type Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import LiquidButton from './LiquidButton.svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality, GlassVariant } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { acquireGlassTransform, type GlassTransform } from './runtime/glassMotion.js';
	import {
		BUTTON_CIRCLE_SIZES,
		GLASS_DEFAULTS,
		SEARCH_BEZEL_RATIO,
		TOOLBAR_GLASS,
		TOOLBAR_SHADOW
	} from './runtime/glassTokens.js';
	import {
		HOVER_SPECULAR_BOOST,
		REDUCED_MOTION_TRANSITION,
		SEARCH_COLLAPSE,
		SEARCH_MORPH_GATHER,
		SEARCH_MORPH_LEAD,
		SEARCH_MORPH_VOLUME,
		springFor
	} from './runtime/motionTokens.js';
	import { observeSize } from './runtime/sharedResizeObserver.js';

	/**
	 * Deliberately the button's own size scale: the field is laid out at
	 * {@link BUTTON_CIRCLE_SIZES}' heights so it rows up with the circular buttons
	 * it shares a bar with. See {@link SEARCH_BEZEL_RATIO} for why that identity
	 * is a decision rather than a reuse of convenience — and the `expandable` morph
	 * below is where it stops being aesthetic and becomes load-bearing: the trigger
	 * circle's diameter *is* the field's height, so the morph is a single-axis
	 * scale by construction, exactly the law `TOOLBAR_SIZES` enforces for the bar.
	 */
	export type SearchFieldSize = keyof typeof BUTTON_CIRCLE_SIZES;

	/** Which edge of the wrapper the trigger sits on, and the field unrolls from. */
	export type SearchAnchor = 'start' | 'end' | 'center';

	interface Props extends Omit<
		HTMLInputAttributes,
		'class' | 'style' | 'size' | 'type' | 'value' | 'onsubmit'
	> {
		/** Current text. Bindable. */
		value?: string;
		size?: SearchFieldSize;
		/**
		 * Material variant — `regular` (default) is the frosted material; `clear` for
		 * a field floating over media. See {@link GlassVariant}.
		 */
		variant?: GlassVariant;
		quality?: GlassQuality;
		mode?: GlassMode;
		disabled?: boolean;
		/** Show the clear affordance while the field holds text. */
		clearable?: boolean;
		/**
		 * Collapse the field into a circular search button that morphs into the input
		 * on demand — the toolbar's unroll, with a text field inside. The wrapper spans
		 * the width the field will expand to (`width: 100%` unless restyled), and the
		 * trigger sits at `anchor`.
		 */
		expandable?: boolean;
		/** Whether the expandable field is out. Bindable; ignored when not `expandable`. */
		expanded?: boolean;
		/** Which edge the trigger sits on. `end`, because that is where a bar keeps its glyphs. */
		anchor?: SearchAnchor;
		/** Accessible name for the collapsed trigger. A glyph is not one. */
		triggerLabel?: string;
		/**
		 * Accessible name of the input. Falls back to `placeholder`, which is the
		 * common case for a search field — pass this when the placeholder is absent
		 * or too cute to announce.
		 */
		label?: string;
		/** Called with the current text when Enter is pressed. */
		onsubmit?: (value: string) => void;
		/** Called after the field is emptied via the clear button or Escape. */
		onclear?: () => void;
		onexpandedchange?: (expanded: boolean) => void;
		/** Bindable reference to the glass host (the field itself, in either mode). */
		element?: HTMLElement | null;
		/** Bindable reference to the native input, for imperative focus. */
		input?: HTMLInputElement | null;
		class?: string;
		style?: string;
		/** Replaces the default magnifier — in the field and on the trigger alike. */
		icon?: Snippet;
	}

	let {
		value = $bindable(''),
		size = 'md',
		variant = GLASS_DEFAULTS.variant,
		quality = GLASS_DEFAULTS.quality,
		mode = 'auto',
		disabled = false,
		clearable = true,
		expandable = false,
		expanded = $bindable(false),
		anchor = 'end',
		triggerLabel = 'Search',
		label,
		placeholder,
		onsubmit,
		onclear,
		onexpandedchange,
		element = $bindable(null),
		input = $bindable(null),
		class: className = '',
		style = '',
		icon,
		// Pulled out so the component's own handler composes with the consumer's
		// instead of one silently replacing the other.
		onkeydown,
		...rest
	}: Props = $props();

	const uid = $props.id();
	const fieldId = `${uid}-field`;

	const height = $derived(BUTTON_CIRCLE_SIZES[size]);

	/**
	 * `height × 0.26`, the flat-centre law. The height itself is not passed to the
	 * primitive in the static mode — it lives in the per-size CSS below, so the box
	 * is right in the server render — but the bezel has to be derived from the same
	 * figure or the rim and the layout disagree about where the flat centre is.
	 */
	const bezel = $derived(height * SEARCH_BEZEL_RATIO);

	let highlighted = $state(false);

	/**
	 * The same affordance as `LiquidButton`'s: hover or focus brightens the SVG rim.
	 * A text field gets no press or hover *transform* — it is a place, not a control
	 * that reacts by moving — so the rim light and the pointer glow are the whole of
	 * its liveliness, which is also how the platform treats its fields.
	 */
	const specularIntensity = $derived(
		GLASS_DEFAULTS.specularIntensity + (highlighted && !disabled ? HOVER_SPECULAR_BOOST : 0)
	);

	/* ------------------------------------------------------------- the morph --- */

	let wrapperElement = $state<HTMLElement | null>(null);
	let triggerElement = $state<HTMLElement | null>(null);
	let shellTransform = $state<GlassTransform | null>(null);

	/**
	 * Whether the field occupies space in the interaction and accessibility trees.
	 * Outlives `expanded` on the way out, exactly as the toolbar's does: the
	 * retraction has to finish playing before the field is hidden. It drives
	 * `visibility`, which is the whole reason the field can stay mounted.
	 */
	let present = $state(expanded);

	/**
	 * The unroll, `0`–`1`. Mirrored into `$state` from the transform channel because
	 * the optics below are *props* on the primitive, and a prop has to be read in a
	 * reactive scope. See `LiquidToolbar` for the full argument — this is its
	 * arrangement, unchanged.
	 */
	let unroll = $state(expanded ? 1 : 0);

	/** Wrapper width — which is the shell's width, since the shell spans it. */
	let shellWidth = $state(0);

	const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

	/**
	 * Optics interpolated against the unroll, off {@link TOOLBAR_GLASS} — imported,
	 * not restated, and deliberately so where the motion constants are the opposite.
	 * Both morphs pin their rest state to the same object: a circular `LiquidButton`
	 * in the same variant, which the collapsed patch replaces on a frame and has to
	 * pass for. Two tables would be two claims about one button's appearance, free
	 * to drift apart; the import *is* the invariant. The physics is also shared: the
	 * maps are baked for the settled capsule, whose end caps cannot survive being
	 * squeezed to a fraction of their width, so the lens has to arrive with the
	 * unroll (`displacementRatio: 0` at rest).
	 */
	const optics = $derived.by(() => {
		const t = unroll;
		const { rest, active } = TOOLBAR_GLASS[variant];
		const mix = (from: number, to: number) => from + (to - from) * t;
		return {
			displacement: bezel * mix(rest.displacementRatio, active.displacementRatio),
			opacity: mix(rest.opacity, active.opacity),
			saturation: mix(rest.saturation, active.saturation),
			blur: mix(rest.blur, active.blur),
			specularIntensity: mix(rest.specularIntensity, active.specularIntensity),
			shadowIntensity: mix(TOOLBAR_SHADOW.rest, TOOLBAR_SHADOW.open)
		};
	});

	interface MorphStart {
		scaleX: number;
		scaleY: number;
		x: number;
		y: number;
		lead: number;
		gather: number;
	}

	/**
	 * The state the field starts from and retracts into: a patch of the field the
	 * trigger's size, sitting on the trigger. Measured, not derived from the tokens,
	 * for the toolbar's reason: the trigger's box is whatever `LiquidButton` laid out
	 * and the shell's is whatever the wrapper's layout made it, so a computed scale
	 * would be right only until a consumer restyled either.
	 */
	function morphStart(): MorphStart {
		const settled = { scaleX: 1, scaleY: 1, x: 0, y: 0, lead: 0, gather: 1 };
		const shell = element;
		if (!triggerElement || !shell) return settled;

		const width = shell.offsetWidth;
		const shellHeight = shell.offsetHeight;
		// No layout yet — measured before the first one, or inside a `display: none`
		// ancestor. Dividing by that would park the field at `scale(Infinity)`.
		if (width === 0 || shellHeight === 0) return settled;

		const triggerWidth = triggerElement.offsetWidth;
		const triggerHeight = triggerElement.offsetHeight;

		return {
			scaleX: triggerWidth / width,
			scaleY: triggerHeight / shellHeight,
			/*
			 * Layout positions against the wrapper — `offsetLeft`, never a rect, which
			 * would report the currently transformed box and feed the animation straight
			 * back into itself.
			 */
			x: triggerElement.offsetLeft + triggerWidth / 2 - (shell.offsetLeft + width / 2),
			y: triggerElement.offsetTop + triggerHeight / 2 - (shell.offsetTop + shellHeight / 2),
			lead: SEARCH_MORPH_LEAD,
			gather: SEARCH_MORPH_GATHER.scale
		};
	}

	/*
	 * The wrapper is observed rather than the shell, and that is a constraint, not a
	 * choice: the shared observer holds one callback per element, and the primitive
	 * is already measuring the shell for its maps. The two boxes agree by
	 * construction — the shell is `inset: 0` inside the wrapper.
	 */
	$effect(() => {
		if (!expandable || !wrapperElement) return;
		let last = -1;
		return observeSize(wrapperElement, (width) => {
			const rounded = Math.round(width);
			if (rounded === last) return;
			last = rounded;
			shellWidth = rounded;
		});
	});

	/*
	 * Acquisition, in its own effect and depending on nothing but the element.
	 * `expanded` must never be tracked here — see `LiquidToolbar` for the failure
	 * that produces. A collapsed field is parked imperatively rather than animated:
	 * that is its initial state, not a transition.
	 */
	$effect(() => {
		const shell = element;
		if (!expandable || !shell) return;
		const transform = acquireGlassTransform(shell);
		if (!untrack(() => expanded)) {
			const start = untrack(morphStart);
			transform.revealX.set(start.scaleX);
			transform.revealY.set(start.scaleY);
			transform.x.set(start.x);
			transform.y.set(start.y);
			transform.stretchX.set(1);
			transform.stretchY.set(1);
		}
		shellTransform = transform;
		return () => {
			shellTransform = null;
			transform.revealX.set(1);
			transform.revealY.set(1);
			transform.x.set(0);
			transform.y.set(0);
			transform.stretchX.set(1);
			transform.stretchY.set(1);
			transform.release();
		};
	});

	/**
	 * The per-frame writer: corner compensation, counter-scale, unroll. The
	 * toolbar's, with its names — see `LiquidToolbar` for the full derivation of the
	 * radius rule (`min(drawn width, drawn height) / 2`, divided back out per axis),
	 * which is what keeps the squeezed capsule a capsule and the collapsed patch a
	 * perfect circle. All of it lands on CSS custom properties feeding declarations
	 * that are already repainting; none of it touches the map cache key.
	 */
	$effect(() => {
		const transform = shellTransform;
		const shell = element;
		const width = shellWidth;
		if (!transform || !shell || width === 0) return;

		const collapsedScale = untrack(morphStart).scaleX;
		const span = Math.max(0.01, 1 - collapsedScale);
		const boxHeight = height;

		const write = () => {
			const revealX = transform.revealX.get();
			const scaleX = Math.max(0.01, revealX * transform.stretchX.get());
			const scaleY = Math.max(0.01, transform.revealY.get() * transform.stretchY.get());

			const radius = Math.min(width * scaleX, boxHeight * scaleY) / 2;
			shell.style.setProperty('--lg-radius-x', `${radius / scaleX}px`);
			shell.style.setProperty('--lg-radius-y', `${radius / scaleY}px`);

			shell.style.setProperty('--lg-search-counter-x', String(1 / scaleX));
			shell.style.setProperty('--lg-search-counter-y', String(1 / scaleY));

			const next = clamp01((revealX - collapsedScale) / span);
			shell.style.setProperty('--lg-search-unroll', String(next));
			unroll = next;
		};

		write();
		const unsubscribe = [
			transform.revealX.on('change', write),
			transform.revealY.on('change', write),
			transform.stretchX.on('change', write),
			transform.stretchY.on('change', write)
		];

		return () => {
			for (const stop of unsubscribe) stop();
			shell.style.removeProperty('--lg-radius-x');
			shell.style.removeProperty('--lg-radius-y');
			shell.style.removeProperty('--lg-search-counter-x');
			shell.style.removeProperty('--lg-search-counter-y');
			shell.style.removeProperty('--lg-search-unroll');
		};
	});

	/**
	 * The unroll and the retraction — the toolbar's sequencing, unchanged: a lead
	 * for the travel, a gather on the width, the displaced volume on the height,
	 * and a plain monotone collapse. See `LiquidToolbar` for why each piece is what
	 * it is; nothing here animates width, height, radius or bezel.
	 */
	$effect(() => {
		const transform = shellTransform;
		if (!expandable || !transform) return;

		const reduced = reducedMotion.current;
		const opening = expanded;
		const start = untrack(morphStart);

		if (opening) {
			// Re-park on the box just measured, before anything moves — only ever from
			// rest, since the same write against a field still retracting would teleport
			// it mid-flight.
			if (!untrack(() => present)) {
				transform.revealX.set(start.scaleX);
				transform.revealY.set(start.scaleY);
				transform.x.set(start.x);
				transform.y.set(start.y);
				transform.stretchX.set(1);
				transform.stretchY.set(1);
			}
			present = true;
		}

		transform.setActive(true);
		let settled = false;
		const settle = () => {
			if (settled) return;
			settled = true;
			transform.setActive(false);
		};

		const collapseCurve = reduced ? REDUCED_MOTION_TRANSITION : SEARCH_COLLAPSE;
		const spread = springFor('spread', reduced);

		const animations = [
			animate(transform.x, opening ? 0 : start.x, opening ? spread : collapseCurve),
			animate(transform.y, opening ? 0 : start.y, opening ? spread : collapseCurve),
			animate(
				transform.revealX,
				opening ? 1 : start.scaleX,
				opening ? { ...spread, delay: reduced ? 0 : start.lead } : collapseCurve
			),
			// Normally 1 → 1, run anyway: the heights agree by the size-scale law, and
			// the arrangement that breaks it (a restyled trigger) is the one that needs
			// the channel most.
			animate(
				transform.revealY,
				opening ? 1 : start.scaleY,
				opening ? { ...spread, delay: reduced ? 0 : start.lead } : collapseCurve
			)
		];

		const deforming = opening && !reduced && start.gather < 1;

		function deform(channel: MotionValue<number>, keyframes: number[], times: number[]) {
			if (!deforming) {
				if (channel.get() !== 1) animations.push(animate(channel, 1, collapseCurve));
				return;
			}
			const duration = times[times.length - 1];
			animations.push(
				animate(channel, [channel.get(), ...keyframes], {
					duration,
					times: [0, ...times.map((time) => time / duration)],
					ease: 'easeInOut'
				})
			);
		}

		deform(
			transform.stretchX,
			[start.gather, 1],
			[start.lead, start.lead + SEARCH_MORPH_GATHER.release]
		);
		deform(
			transform.stretchY,
			[SEARCH_MORPH_VOLUME.swell, SEARCH_MORPH_VOLUME.flatten, 1],
			[start.lead, start.lead + SEARCH_MORPH_VOLUME.dip, start.lead + SEARCH_MORPH_VOLUME.release]
		);

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
	 * Focus lands in the input on every expansion, pointer or keyboard — the field
	 * exists to be typed into, and the trigger is not drawn while it is out. Guarded
	 * on `present` because a `visibility: hidden` input cannot take focus.
	 */
	$effect(() => {
		if (!expandable || !expanded || !present) return;
		if (input && document.activeElement !== input) input.focus();
	});

	function setExpanded(next: boolean) {
		if (next === expanded) return;
		expanded = next;
		onexpandedchange?.(next);
	}

	/**
	 * `returnFocus` is honoured only while focus is still inside the control —
	 * collapsing because the user clicked elsewhere must not yank it back.
	 */
	function collapseField(returnFocus: boolean) {
		if (!expanded) return;
		const inside = wrapperElement?.contains(document.activeElement);
		setExpanded(false);
		if (returnFocus && inside) triggerElement?.focus();
	}

	/**
	 * Dismissal on an outside press, bound only while open — and only while the
	 * field is *empty*. A field holding a query is a state the user is in, not a
	 * transient to be dismissed by a stray click; it stays out until cleared, which
	 * is how the platform treats an active search.
	 */
	$effect(() => {
		if (!expandable || !expanded) return;

		const onPointerDown = (event: PointerEvent) => {
			if (value !== '') return;
			const target = event.target;
			if (target instanceof Node && wrapperElement?.contains(target)) return;
			collapseField(false);
		};

		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	});

	/**
	 * Focus leaving collapses an empty field — the backstop for every departure this
	 * component has not enumerated. A null `relatedTarget` is deliberately not one:
	 * it means focus was *dropped*, and the ordinary way to drop it is a press on
	 * the field's own padding. See `LiquidToolbar`'s identical guard.
	 */
	function onFocusOut(event: FocusEvent) {
		if (!expanded || value !== '') return;
		const next = event.relatedTarget;
		if (next === null) return;
		if (next instanceof Node && wrapperElement?.contains(next)) return;
		collapseField(false);
	}

	/**
	 * The whole pill is the target, exactly like the native control — but the host
	 * is a `div`, not a `label`. A label would do this for free and would also be
	 * invalid: the clear affordance is a real `<button>`, and HTML forbids
	 * interactive content inside a label. `preventDefault` keeps the press from
	 * moving focus (or starting a selection on the icon) before the input takes it.
	 */
	function focusFromHost(event: PointerEvent): void {
		if (disabled) return;
		const target = event.target as HTMLElement;
		if (target === input || target.closest('.lg-search-clear')) return;
		event.preventDefault();
		input?.focus();
	}

	/**
	 * Clearing keeps focus in the field, as the platform does — a cleared search is
	 * the start of the next one, not the end of this one. The clear button's own
	 * `pointerdown` is prevented below so focus never visibly leaves on the way.
	 */
	function clear(): void {
		value = '';
		onclear?.();
		input?.focus();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			onsubmit?.(value);
		} else if (event.key === 'Escape' && value !== '') {
			// Consumed: Escape empties a non-empty field, and must not also dismiss
			// whatever surface the field is sitting in. An already-empty field lets
			// the key through — except into the morph below, so the ladder is
			// clear → retract → and only a third press reaches the surrounding surface.
			event.stopPropagation();
			clear();
		} else if (event.key === 'Escape' && expandable && expanded) {
			event.stopPropagation();
			event.preventDefault();
			collapseField(true);
		}
		onkeydown?.(event as never);
	}
</script>

{#snippet magnifier()}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<circle cx="11" cy="11" r="8" />
		<path d="m21 21-4.35-4.35" />
	</svg>
{/snippet}

{#snippet fieldContent()}
	<span class="lg-search-icon" aria-hidden="true">
		{#if icon}
			{@render icon()}
		{:else}
			{@render magnifier()}
		{/if}
	</span>
	<input
		bind:this={input}
		bind:value
		type="search"
		aria-label={label ?? placeholder}
		{placeholder}
		{disabled}
		onkeydown={handleKeydown}
		{...rest}
	/>
	{#if clearable && value !== '' && !disabled}
		<button
			type="button"
			class="lg-search-clear"
			aria-label="Clear search"
			onpointerdown={(event) => event.preventDefault()}
			onclick={clear}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
			>
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>
	{/if}
{/snippet}

{#if expandable}
	<!--
		The wrapper spans the width the field will unroll to, and is a `search`
		landmark: the control is a search however it is drawn. Positioning is plain
		absolute, deliberately not the top layer — `backdrop-filter` inside a popover
		would sample a backdrop the field is no longer part of.
	-->
	<div
		bind:this={wrapperElement}
		role="search"
		class={`lg-search-morph ${className}`}
		{style}
		data-anchor={anchor}
		onfocusout={onFocusOut}
	>
		<!--
			The trigger is not drawn for as long as the field is out — `present`, not
			`expanded`, so it comes back at the end of the retraction rather than at the
			start of it. Switched, never faded: any opacity strictly between 0 and 1
			turns the button into a backdrop root and kills its own refraction. Kept
			focusable while invisible (`opacity: 0`, `tabindex="-1"`) so a collapse can
			return focus somewhere a keyboard user can continue from.
		-->
		<LiquidButton
			bind:element={triggerElement}
			shape="circle"
			{size}
			{variant}
			{quality}
			{mode}
			{disabled}
			class={`lg-search-trigger ${present ? 'is-yielded' : ''}`}
			aria-label={triggerLabel}
			aria-expanded={expanded}
			aria-controls={fieldId}
			tabindex={present ? -1 : undefined}
			onclick={() => (expanded ? collapseField(true) : setExpanded(true))}
		>
			{#if icon}
				{@render icon()}
			{:else}
				{@render magnifier()}
			{/if}
		</LiquidButton>

		<!--
			Mounted at all times, hidden with `visibility` rather than `{#if}`, for the
			toolbar's two compounding reasons: the displacement map is rasterised from
			the measured settled box before the field is ever opened, and a hidden-but-
			laid-out shell is still measurable while staying out of the tab order and
			the accessibility tree.
		-->
		<LiquidGlass
			bind:element
			height={BUTTON_CIRCLE_SIZES[size]}
			borderRadius={BUTTON_CIRCLE_SIZES[size] / 2}
			{bezel}
			displacement={optics.displacement}
			opacity={optics.opacity}
			saturation={optics.saturation}
			blur={optics.blur}
			specularIntensity={optics.specularIntensity}
			shadowIntensity={optics.shadowIntensity}
			{quality}
			{mode}
			{disabled}
			interactive
			class={`lg-search lg-search-${size} lg-search-shell ${present ? 'is-present' : ''} ${expanded ? 'is-open' : ''}`}
			onpointerdown={focusFromHost}
		>
			<div class="lg-search-row" id={fieldId}>
				{@render fieldContent()}
			</div>
		</LiquidGlass>
	</div>
{:else}
	<LiquidGlass
		bind:element
		borderRadius={999}
		{bezel}
		{variant}
		{specularIntensity}
		{quality}
		{mode}
		{disabled}
		interactive
		class={`lg-search lg-search-${size} ${className}`}
		{style}
		onpointerdown={focusFromHost}
		onpointerenter={() => (highlighted = true)}
		onpointerleave={() => (highlighted = false)}
		onfocusin={() => (highlighted = true)}
		onfocusout={() => (highlighted = false)}
	>
		{@render fieldContent()}
	</LiquidGlass>
{/if}

<style>
	/*
	 * Sizing and typography only — every glass surface style lives in
	 * liquidGlass.css. Global because the classes land on a child component's
	 * element.
	 */
	:global(.lg-search) {
		display: flex;
		width: 100%;
		cursor: text;
	}

	/*
	 * Heights mirror BUTTON_CIRCLE_SIZES for the same SSR reason the circles state
	 * theirs in CSS: the primitive's width/height props are written by an effect and
	 * absent from the server render, and a field with no laid-out height would render
	 * as a text line and jump on hydration. These must stay in step with the token,
	 * which is what the bezel is derived from. Font sizes are the pill buttons', so a
	 * field and the button beside it type at the same scale.
	 */
	:global(.lg-search-sm) {
		--lg-search-icon: 13px;
		height: 30px;
		font-size: 0.8125rem;
	}

	:global(.lg-search-md) {
		--lg-search-icon: 16px;
		height: 38px;
		font-size: 0.9375rem;
	}

	:global(.lg-search-lg) {
		--lg-search-icon: 18px;
		height: 46px;
		font-size: 1.0625rem;
	}

	:global(.lg-search > .lg-content) {
		flex: 1 1 auto;
		justify-content: flex-start;
		gap: 0.4em;
		height: 100%;
		min-width: 0;
		padding: 0 0.9em;
	}

	:global(.lg-search-icon) {
		display: flex;
		flex: 0 0 auto;
		/* Secondary, like the placeholder it introduces — the field's content is the
		   text, and a full-strength glyph competes with it. */
		opacity: 0.55;
	}

	:global(.lg-search-icon svg) {
		display: block;
		width: var(--lg-icon-size, var(--lg-search-icon));
		height: var(--lg-icon-size, var(--lg-search-icon));
	}

	:global(.lg-search input) {
		flex: 1 1 auto;
		min-width: 0;
		height: 100%;
		appearance: none;
		background: transparent;
		border: 0;
		margin: 0;
		padding: 0;
		font: inherit;
		color: inherit;
		/* The ring is drawn on the pill (see :has below); a second one inside it
		   would outline the text area against the glass it is supposed to be part of. */
		outline: none;
	}

	/* Scheme-agnostic: whatever colour the text inherits, the placeholder is a
	   fainter run of the same ink. */
	:global(.lg-search input::placeholder) {
		color: inherit;
		opacity: 0.55;
	}

	/* The native × — this component draws its own, so it can keep focus in the
	   field and carry an accessible name. */
	:global(.lg-search input::-webkit-search-cancel-button),
	:global(.lg-search input::-webkit-search-decoration) {
		-webkit-appearance: none;
		appearance: none;
	}

	/* The focus ring belongs to the pill, not the input: the pill is the control
	   the user sees, and it is what a keyboard user needs outlined. */
	:global(.lg-search:has(input:focus-visible)) {
		outline: 2px solid rgb(255 255 255 / 0.85);
		outline-offset: 3px;
	}

	:global(.lg-search-clear) {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		width: 1.3em;
		height: 1.3em;
		border: 0;
		margin: 0;
		padding: 0;
		border-radius: 999px;
		/*
		 * iOS's systemGray fill, scheme-constant on purpose: on glass the backdrop
		 * behind the button is unknowable, and a mid-grey at moderate alpha is the one
		 * fill that reads as a chip on both a white veil and a smoked one. Deriving it
		 * from --lg-shade would vanish it against dark glass.
		 */
		background: rgb(120 120 128 / 0.4);
		color: #fff;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	:global(.lg-search-clear svg) {
		display: block;
		width: 0.62em;
		height: 0.62em;
	}

	:global(.lg-search-clear:focus-visible) {
		outline: 2px solid rgb(255 255 255 / 0.85);
		outline-offset: 2px;
	}

	/*
	 * Dimming the *content*, never the host. `opacity < 1` on the glass root would
	 * create a backdrop root and silently kill the refraction underneath.
	 */
	:global(.lg-search[data-disabled='true'] .lg-content) {
		opacity: 0.5;
	}

	/* ---------------------------------------------------------- the morph --- */

	/*
	 * The wrapper spans the width the field expands to, and the trigger sits at the
	 * anchor edge in ordinary flex flow — so its `offsetLeft` is real layout and the
	 * measured travel in `morphStart` comes out right for all three anchors with no
	 * special case in the script.
	 */
	:global(.lg-search-morph) {
		position: relative;
		display: flex;
		width: 100%;
	}

	:global(.lg-search-morph[data-anchor='start']) {
		justify-content: flex-start;
	}

	:global(.lg-search-morph[data-anchor='end']) {
		justify-content: flex-end;
	}

	:global(.lg-search-morph[data-anchor='center']) {
		justify-content: center;
	}

	/*
	 * The trigger *is* the field for as long as the field is out. Switched, never
	 * transitioned — see the markup comment, and `LiquidToolbar`'s identical rule.
	 */
	:global(.lg-search-morph .lg-search-trigger.is-yielded) {
		opacity: 0;
	}

	/*
	 * The shell spans the wrapper — its layout box never animates; the unroll is
	 * entirely the transform's. `transform-origin: center` plus the measured
	 * translation is what holds the anchored edge still; see `LiquidToolbar` for
	 * the arithmetic.
	 */
	:global(.lg-search-shell) {
		position: absolute;
		inset: 0;
		z-index: 30;
		transform-origin: center;
	}

	/* The row does the layout the static mode's `.lg-content` does; the shell's
	   content box goes plain so the counter-scaled row owns everything inside. */
	:global(.lg-search-shell > .lg-content) {
		display: block;
		height: 100%;
		padding: 0;
	}

	/*
	 * The counter-scale: nothing inside a glass surface may be deformed by its
	 * transform — text squeezed to a seventh of its width is the one part of this
	 * that would read as cheap. The row cancels the shell's scale about the anchored
	 * edge, so it sits at its settled size and position from the first frame.
	 *
	 * The reveal is one ramp over the tail of the unroll rather than the toolbar's
	 * per-item thresholds: the content here is a single object — a text line with
	 * its glyph and caret — and it lands as the bar settles, which is also when the
	 * end caps it would otherwise overlap have reached the width they were baked
	 * for. Fallbacks describe the settled field (`unroll: 1`), the safe end: a
	 * collapsed shell is `visibility: hidden` regardless.
	 */
	:global(.lg-search-row) {
		display: flex;
		align-items: center;
		gap: 0.4em;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		padding: 0 0.9em;
		scale: var(--lg-search-counter-x, 1) var(--lg-search-counter-y, 1);
		opacity: clamp(0, calc((var(--lg-search-unroll, 1) - 0.55) / 0.35), 1);
	}

	:global(.lg-search-morph[data-anchor='start'] .lg-search-row) {
		transform-origin: left center;
	}

	:global(.lg-search-morph[data-anchor='end'] .lg-search-row) {
		transform-origin: right center;
	}

	:global(.lg-search-morph[data-anchor='center'] .lg-search-row) {
		transform-origin: center;
	}

	/*
	 * Hidden, but still laid out and still measured — `visibility` is safe on a
	 * glass surface in a way `opacity` is not: it does not create a backdrop root.
	 */
	:global(.lg-search-shell:not(.is-present)) {
		visibility: hidden;
	}

	/* Ignore presses at once on collapse, while the retraction is still playing. */
	:global(.lg-search-shell:not(.is-open)) {
		pointer-events: none;
	}
</style>
