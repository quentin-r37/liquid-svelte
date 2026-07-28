<script lang="ts">
	import { animate, type MotionValue } from 'motion';
	import { untrack, type Snippet } from 'svelte';
	import LiquidButton from './LiquidButton.svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality, GlassVariant } from './liquidGlass.types.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { acquireGlassTransform, type GlassTransform } from './runtime/glassMotion.js';
	import {
		GLASS_DEFAULTS,
		TOOLBAR_BEZEL_RATIO,
		TOOLBAR_GLASS,
		TOOLBAR_SHADOW,
		TOOLBAR_SIZES,
		type ToolbarSize
	} from './runtime/glassTokens.js';
	import {
		REDUCED_MOTION_TRANSITION,
		TOOLBAR_COLLAPSE,
		TOOLBAR_ITEM_FADE,
		TOOLBAR_ITEM_RISE,
		TOOLBAR_MORPH_GATHER,
		TOOLBAR_MORPH_LEAD,
		TOOLBAR_MORPH_VOLUME,
		springFor
	} from './runtime/motionTokens.js';
	import { observeSize } from './runtime/sharedResizeObserver.js';

	export interface LiquidToolbarItem {
		/** Stable identifier, reported by `onaction`. */
		id: string;
		/**
		 * The item's accessible name, and its visible label when no `icon` is given.
		 *
		 * Required either way. An icon is not an accessible name, and a toolbar is the
		 * one place in this library where every control is a glyph by default.
		 */
		label: string;
		/** Glyph. Omit and the label is rendered as text, which a word-toolbar wants. */
		icon?: Snippet;
		disabled?: boolean;
		/**
		 * On/off item, rendered as a filled well and reported as `aria-pressed`.
		 *
		 * `undefined` — the default — is not "false": an item with no pressed state must
		 * not claim one, or every plain action in the bar announces itself as a toggle
		 * that happens to be off.
		 */
		selected?: boolean;
		destructive?: boolean;
		/** Draw a hairline separator before this item. */
		separated?: boolean;
	}

	/**
	 * Which edge of the collapsed trigger the bar unrolls from, and therefore which
	 * edge stays put while it does.
	 */
	export type ToolbarAnchor = 'start' | 'end' | 'center';

	interface Props {
		items: LiquidToolbarItem[];
		/** Bindable. */
		expanded?: boolean;
		anchor?: ToolbarAnchor;
		disabled?: boolean;
		/**
		 * Sizes the trigger *and* the bar together — see {@link TOOLBAR_SIZES}, where the
		 * two are locked to the same height because the morph is a single-axis scale.
		 * There is deliberately no way to size them apart.
		 */
		size?: ToolbarSize;
		/** Accessible name for the trigger. A glyph is not one. */
		triggerLabel?: string;
		/** Accessible name for the bar itself. */
		label?: string;
		/**
		 * Material variant, forwarded to the trigger `LiquidButton` *and* driving the
		 * shell's optics (see `TOOLBAR_GLASS`). One prop for both on purpose: the
		 * collapsed shell has to pass as the trigger it replaces on a frame, which it
		 * cannot do wearing a different material.
		 */
		variant?: GlassVariant;
		quality?: GlassQuality;
		mode?: GlassMode;
		class?: string;
		style?: string;
		onaction?: (id: string) => void;
		onexpandedchange?: (expanded: boolean) => void;
		/** Trigger glyph. */
		children?: Snippet;
	}

	let {
		items,
		expanded = $bindable(false),
		anchor = 'start',
		disabled = false,
		size = 'md',
		triggerLabel = 'More actions',
		label,
		variant = GLASS_DEFAULTS.variant,
		quality = 'medium',
		mode = 'auto',
		class: className = '',
		style = '',
		onaction,
		onexpandedchange,
		children
	}: Props = $props();

	const uid = $props.id();
	const barId = `${uid}-bar`;
	const triggerId = `${uid}-trigger`;

	const geometry = $derived(TOOLBAR_SIZES[size]);
	const bezel = $derived(geometry.height * TOOLBAR_BEZEL_RATIO);

	let wrapperElement = $state<HTMLElement | null>(null);
	let triggerElement = $state<HTMLElement | null>(null);
	let shellElement = $state<HTMLElement | null>(null);
	let rowElement = $state<HTMLElement | null>(null);
	let shellTransform = $state<GlassTransform | null>(null);
	let itemElements = $state<Record<string, HTMLButtonElement | undefined>>({});

	/**
	 * Whether the bar occupies space in the interaction and accessibility trees.
	 *
	 * Outlives `expanded` on the way out, exactly as `LiquidMenu`'s does: the retraction
	 * has to finish playing before the bar is hidden. It is what drives `visibility`,
	 * which is the whole reason the bar can stay mounted.
	 */
	let present = $state(expanded);

	/** The item that holds the toolbar's single tab stop. */
	let activeId = $state<string | null>(null);

	/**
	 * The unroll, `0`–`1`: how far the bar has extended, normalised so that `0` is the
	 * collapsed patch and `1` is the settled bar.
	 *
	 * Mirrored into `$state` from the transform channel because the optics below are
	 * *props* on the primitive, and a prop has to be read in a reactive scope. One state
	 * write per frame for the duration of the morph, which lands on a handful of live
	 * filter attributes and nothing else — the same arrangement `DropletMorph` uses, and
	 * the reason this component does not simply use it is below.
	 */
	let unroll = $state(expanded ? 1 : 0);

	/** Shell width, in CSS pixels. Derived from the row rather than measured — see below. */
	let shellWidth = $state(0);

	/** Per-item share of the unroll at which its reveal starts. */
	let thresholds = $state<Record<string, number>>({});

	const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

	const enabled = $derived(items.filter((entry) => !entry.disabled));

	/**
	 * The single tab stop, per the ARIA toolbar pattern: arrows move between items and
	 * Tab leaves the toolbar entirely, so exactly one item may be tabbable.
	 *
	 * Falls back to the first enabled item rather than to nothing, so a toolbar that has
	 * never been focused is still reachable by keyboard — and re-resolves if the item
	 * holding the stop is removed or disabled under it.
	 */
	const tabStopId = $derived(
		activeId !== null && enabled.some((entry) => entry.id === activeId)
			? activeId
			: (enabled[0]?.id ?? null)
	);

	/**
	 * Optics interpolated against the unroll, rather than sprung independently.
	 *
	 * This is where the toolbar parts company with `DropletMorph`, which every other
	 * morph in the library uses, and the reason is a hard constraint rather than a
	 * preference. The refraction has to be absent while the shell is squeezed — see
	 * {@link TOOLBAR_GLASS} for why the baked end caps cannot survive it — and
	 * "while the shell is squeezed" *is* the unroll. A separate spring, however close
	 * its timing, could bring the lens up while the patch is still narrow; driving the
	 * two off one value makes that unrepresentable.
	 *
	 * It also means the optics reverse as the bar retracts, which `LiquidMenu`
	 * explicitly refuses to let happen. The objection there was a dense rest tint
	 * running backwards over the collapse; here the endpoints share the `regular`
	 * material — tint, frost and saturation are equal at both ends — so what
	 * actually reverses is the lens and the rim, and that is precisely the
	 * collapsed *button*'s appearance being restored as the bar becomes one again.
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
		/** Scales on the two reveal channels. */
		scaleX: number;
		scaleY: number;
		/** Offset of the collapsed patch from the shell's own centre, in CSS pixels. */
		x: number;
		y: number;
		/** Seconds the travel gets to itself before the unroll joins it. */
		lead: number;
		/** Fraction of its own width the patch pinches to first. 1 is no pinch. */
		gather: number;
	}

	/**
	 * The state the bar starts from and retracts into: a patch of the bar the size of the
	 * trigger, sitting on the trigger.
	 *
	 * Both figures are *measured*, and that is what makes this a morph rather than a
	 * transition between two shapes that resemble each other. The trigger's box is
	 * whatever `LiquidButton` laid it out at and the bar's is whatever its items made it,
	 * so a scale computed from the tokens would be right only until a consumer changed a
	 * font.
	 *
	 * `scaleY` is 1 in every arrangement the tokens allow — that is the law
	 * {@link TOOLBAR_SIZES} exists to enforce — and is measured anyway, because a
	 * consumer restyling the trigger through `class` is not the component's business to
	 * forbid and a silent 4px vertical jump is a poor way to find out.
	 *
	 * Read at the top of every morph rather than cached: a hidden bar is still laid out
	 * and still measurable, but one whose items changed in the meantime would otherwise
	 * unroll out of a box that no longer exists.
	 */
	function morphStart(): MorphStart {
		const settled = { scaleX: 1, scaleY: 1, x: 0, y: 0, lead: 0, gather: 1 };
		if (!triggerElement || !shellElement) return settled;

		const width = shellElement.offsetWidth;
		const height = shellElement.offsetHeight;
		// No layout yet — measured before the first one, or inside a `display: none`
		// ancestor. Dividing by that would park the bar at `scale(Infinity)`, which is not
		// a state it can animate out of.
		if (width === 0 || height === 0) return settled;

		const triggerWidth = triggerElement.offsetWidth;
		const triggerHeight = triggerElement.offsetHeight;

		return {
			scaleX: triggerWidth / width,
			scaleY: triggerHeight / height,
			/*
			 * Both boxes measured against the wrapper, which is the offset parent of the
			 * absolutely positioned shell and of the static trigger alike.
			 *
			 * `offsetLeft`/`offsetTop` rather than `getBoundingClientRect`, and that is not
			 * a preference: these are *layout* positions, untouched by the transform this is
			 * about to write, while the rect would report the shell's currently translated
			 * and scaled box and feed the animation straight back into itself.
			 */
			x: triggerElement.offsetLeft + triggerWidth / 2 - (shellElement.offsetLeft + width / 2),
			y: triggerElement.offsetTop + triggerHeight / 2 - (shellElement.offsetTop + height / 2),
			lead: TOOLBAR_MORPH_LEAD,
			gather: TOOLBAR_MORPH_GATHER.scale
		};
	}

	/**
	 * Where the unrolling edge has to reach before each item has room, as a fraction of
	 * the extension.
	 *
	 * The stagger is geometry, not timing — see {@link TOOLBAR_ITEM_FADE}. An item is lit
	 * when the bar is wide enough to hold it, measured from whichever edge is anchored,
	 * so the reveal front and the leading edge are the same thing by construction and
	 * cannot drift apart when either the springs or the item widths change.
	 *
	 * Every reading is a layout position inside the row, so none of it is polluted by the
	 * live transform on the shell — and the row's own counter-scale is a transform too,
	 * which `offsetLeft` is likewise blind to.
	 */
	function measureItems() {
		const row = rowElement;
		if (!row) return;

		const rowWidth = row.offsetWidth;
		if (rowWidth === 0) return;

		const pad = geometry.padding;
		const width = rowWidth + pad * 2;
		shellWidth = width;

		/*
		 * Half the bar, published for the `center` anchor's negative margin — see the
		 * stylesheet for why that anchor needs a *layout* offset rather than a translation.
		 *
		 * Written here rather than derived in the template because it has to land before
		 * `morphStart` reads `offsetLeft`, and the two are separated by exactly one effect
		 * flush: this function runs from the first effect declared in the component, the
		 * morph from the last. Writing it through a `style:` directive on the shell is not
		 * available anyway — that is a glass surface, and the attribute is off limits.
		 */
		shellElement?.style.setProperty('--lg-toolbar-half', `${width / 2}px`);

		// The collapsed width, and therefore the width the extension starts from. Measured
		// so it agrees with `morphStart`; the tokens say it is `geometry.height`.
		const collapsed = triggerElement?.offsetWidth || geometry.height;
		const span = Math.max(1, width - collapsed);

		const next: Record<string, number> = {};
		for (const entry of items) {
			const element = itemElements[entry.id];
			if (!element) continue;

			const x = element.offsetLeft;
			const w = element.offsetWidth;

			/*
			 * How wide the bar has to be for this item to be inside it.
			 *
			 * `start` and `end` measure from the pinned edge to the item's far side. `center`
			 * grows both ways at once, so what matters is the item's distance from the middle
			 * — doubled, since the bar spends half its width on each side. An item straddling
			 * the centre therefore needs almost nothing and lights first, and the bar fills
			 * outwards symmetrically.
			 */
			const reach =
				anchor === 'end'
					? pad + (rowWidth - x)
					: anchor === 'center'
						? 2 * Math.max(rowWidth / 2 - x, x + w - rowWidth / 2)
						: pad + x + w;

			// Scaled by `1 − fade` so the ramp *starts* here and the last item still finishes
			// exactly as the bar settles. See TOOLBAR_ITEM_FADE.
			next[entry.id] = clamp01((reach - collapsed) / span) * (1 - TOOLBAR_ITEM_FADE);
		}

		thresholds = next;
	}

	// Runs when the items change (through `items` and `itemElements`), when they mount,
	// and — via the observer — on a font swap or a label edit. The row is observed rather
	// than the shell, which the primitive already measures: the shared observer holds one
	// callback per element, so observing it here would displace that measurement.
	$effect(measureItems);

	$effect(() => {
		if (!rowElement) return;
		return observeSize(rowElement, measureItems);
	});

	/*
	 * Acquisition, in its own effect and depending on nothing but the element.
	 *
	 * `expanded` must never be *tracked* here. Reading it would make the effect depend on
	 * it, so every toggle would run the cleanup first: `release()` drops the last holder,
	 * the channels are destroyed and `element.style.transform` is cleared — the bar jumps
	 * to full width inside the click's own frame — and the fresh channels then animate
	 * from 1 to 1. Hence `untrack`: the initial state is wanted, the dependency is not.
	 *
	 * A collapsed bar is parked imperatively rather than animated: that is its initial
	 * state, not a transition, and animating would play a retraction on mount.
	 */
	$effect(() => {
		if (!shellElement) return;
		const transform = acquireGlassTransform(shellElement);
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
	 * Everything the shell publishes about its own deformation, written per frame.
	 *
	 * Three jobs, one subscription, because all three are functions of the same composed
	 * scale and splitting them would mean three per-frame passes over the same channels.
	 *
	 * **The corner.** A transform scales the border radius along with the box, and this
	 * one scales hard and on one axis only: a capsule squeezed to a seventh of its width
	 * keeps its 19px vertical radius and is drawn with a 2.6px horizontal one, which is a
	 * rectangle with rounded-ish corners standing in for a circular button. So the radius
	 * is asked for *pre-multiplied by the inverse* of the scale it is about to be
	 * multiplied by, per axis, from the one figure that makes a capsule a capsule: half
	 * its shorter drawn side.
	 *
	 * Deriving both radii from `min(drawn width, drawn height) / 2` rather than from the
	 * height is what makes the gather work. The gathered patch is 33px wide and 42px tall
	 * — *taller than it is wide* — so the capsule turns through ninety degrees for a few
	 * frames, and a rule that always divided the height would ask for a horizontal radius
	 * past half the box and let CSS clamp both radii proportionally, flattening the ends
	 * at the one moment the surface is meant to look most liquid. One `min` covers both
	 * orientations and the CSS clamp never engages.
	 *
	 * At the collapsed extreme it comes out exactly at the limit — `2 × radiusX = width`
	 * precisely when the trigger's diameter equals the bar's height, which is the law
	 * {@link TOOLBAR_SIZES} enforces. The collapsed patch being a perfect circle is that
	 * equality, restated.
	 *
	 * **The counter-scale**, published for the row to undo the shell's scale with. Nothing
	 * inside a glass surface may be deformed by it: text squashed to a seventh of its
	 * width is the one part of this that would read as cheap, and it is why `LiquidMenu`
	 * has to hold its items back behind a delay. A row that cancels the scale is at its
	 * settled size and position from the first frame, so the items can be revealed by the
	 * unrolling edge itself rather than by a timer that hopes to have waited long enough.
	 *
	 * **The unroll**, normalised against the collapsed scale so `0` and `1` mean the two
	 * resting states rather than two arbitrary scale values. It drives the item reveals
	 * (in CSS, off one inherited property) and the optics (through the `$state` mirror).
	 * Taken from `revealX` alone, not the composed scale: the deformation channels are a
	 * wobble on top of the extension, not a measure of how far along it is, and feeding
	 * them in here would make the items flicker with the volume.
	 *
	 * All of it is CSS custom properties feeding declarations that are already
	 * repainting, on a surface that is already moving. None of it is a prop, and none of
	 * it touches the displacement map's cache key — the maps are rasterised once, for the
	 * settled bar, before it is ever opened.
	 */
	$effect(() => {
		const transform = shellTransform;
		const shell = shellElement;
		const width = shellWidth;
		const height = geometry.height;
		if (!transform || !shell || width === 0) return;

		const collapsedScale = untrack(morphStart).scaleX;
		const span = Math.max(0.01, 1 - collapsedScale);

		const write = () => {
			const revealX = transform.revealX.get();
			const scaleX = Math.max(0.01, revealX * transform.stretchX.get());
			const scaleY = Math.max(0.01, transform.revealY.get() * transform.stretchY.get());

			const radius = Math.min(width * scaleX, height * scaleY) / 2;
			shell.style.setProperty('--lg-radius-x', `${radius / scaleX}px`);
			shell.style.setProperty('--lg-radius-y', `${radius / scaleY}px`);

			shell.style.setProperty('--lg-toolbar-counter-x', String(1 / scaleX));
			shell.style.setProperty('--lg-toolbar-counter-y', String(1 / scaleY));

			const next = clamp01((revealX - collapsedScale) / span);
			shell.style.setProperty('--lg-toolbar-unroll', String(next));
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
			// Back to the plain `--lg-radius` the primitive writes, rather than to a computed
			// copy of it. The counter and the unroll fall back to their own defaults, both of
			// which describe a settled bar — see the stylesheet for why that is the safe end.
			shell.style.removeProperty('--lg-radius-x');
			shell.style.removeProperty('--lg-radius-y');
			shell.style.removeProperty('--lg-toolbar-counter-x');
			shell.style.removeProperty('--lg-toolbar-counter-y');
			shell.style.removeProperty('--lg-toolbar-unroll');
		};
	});

	/**
	 * The unroll.
	 *
	 * One axis, and the sequencing is what keeps it from being a scale. The bar starts as
	 * a patch the trigger's size sitting on the trigger; for {@link TOOLBAR_MORPH_LEAD} it
	 * has the stage to itself, *travelling* toward the centre of the box it is about to
	 * fill while *pinching* in as it goes ({@link TOOLBAR_MORPH_GATHER}), and only then
	 * does it extend out of that gather. Without the lead the extension outruns the travel
	 * inside two frames and what is left is a bar that appeared; without the pinch there
	 * is no anticipation and the extension reads as a box being resized.
	 *
	 * `transform-origin: center` plus a measured translation is what makes the anchored
	 * edge stay put through all of it — see the stylesheet. A corner origin would pin one
	 * end of the *growing* box, which swings the collapsed patch off the trigger the
	 * instant the scale moves.
	 *
	 * Retracting is neither sequenced nor sprung: both axes and the travel collapse
	 * together on a plain monotone curve ({@link TOOLBAR_COLLAPSE}), because a dismissal
	 * must not overshoot and must be provably over. The items retract with it, in reverse
	 * order, for free — the unroll runs backwards and their thresholds do not move.
	 *
	 * Nothing here animates width, height, radius or bezel. Two scale channels, two
	 * deformation channels and a translation.
	 */
	$effect(() => {
		const transform = shellTransform;
		if (!transform) return;

		const reduced = reducedMotion.current;
		const opening = expanded;
		const start = untrack(morphStart);

		if (opening) {
			// Re-park on the box just measured, before anything moves: the parked values come
			// from two elements that may have been resized — or had their content replaced —
			// since the bar was last closed, and a morph that starts from a stale box starts
			// with a jump. Only ever from rest, since the same write against a bar that is
			// still retracting would teleport it mid-flight.
			if (!untrack(() => present)) {
				transform.revealX.set(start.scaleX);
				transform.revealY.set(start.scaleY);
				transform.x.set(start.x);
				transform.y.set(start.y);
				// The deformation is something the unroll applies and takes back; parking both
				// channels at square guarantees the patch is the trigger's box exactly, on the
				// frame the trigger stops being drawn.
				transform.stretchX.set(1);
				transform.stretchY.set(1);
			}
			present = true;
		}

		// `will-change: transform` for the duration of the morph only. Left on permanently
		// it would keep a compositor layer alive for every toolbar on the page.
		transform.setActive(true);
		let settled = false;
		const settle = () => {
			if (settled) return;
			settled = true;
			transform.setActive(false);
		};

		const collapse = reduced ? REDUCED_MOTION_TRANSITION : TOOLBAR_COLLAPSE;
		const spread = springFor('spread', reduced);

		// The travel to the centre of the final box, on the same spring as the extension it
		// leads. Retracting runs it on the collapse curve alongside everything else — the
		// bar shrinks *and* returns inside one 150ms move, because an exit that retraced the
		// entrance's sequence backwards would outlast the entrance it is undoing.
		const animations = [
			animate(transform.x, opening ? 0 : start.x, opening ? spread : collapse),
			animate(transform.y, opening ? 0 : start.y, opening ? spread : collapse),
			animate(
				transform.revealX,
				opening ? 1 : start.scaleX,
				opening ? { ...spread, delay: reduced ? 0 : start.lead } : collapse
			),
			/*
			 * Normally an animation from 1 to 1, and deliberately run anyway.
			 *
			 * The height is constant by construction, so this channel exists for the case the
			 * construction does not hold — a consumer who restyled the trigger's box. Skipping
			 * it when the two heights agree would mean the arrangement that needs it most is
			 * the one that never gets it, and a no-op spring costs a frame's arithmetic.
			 */
			animate(
				transform.revealY,
				opening ? 1 : start.scaleY,
				opening ? { ...spread, delay: reduced ? 0 : start.lead } : collapse
			)
		];

		/*
		 * The deformation: the gather on the width ({@link TOOLBAR_MORPH_GATHER}) and the
		 * volume it displaces on the height ({@link TOOLBAR_MORPH_VOLUME}).
		 *
		 * On the stretch channels rather than the reveal ones because the composed transform
		 * multiplies the two: the extension keeps its spring to itself and the deformation
		 * rides on top, instead of one animation having to describe a departure and a return
		 * at once. Which is also why these are keyframed — a spring goes somewhere and stays,
		 * and both of these leave 1 only to come back to it. The first keyframe is read off
		 * the channel rather than assumed, so a morph interrupted mid-deformation resumes
		 * from where the surface actually stood.
		 *
		 * `easeInOut` throughout on purpose: the slow start of each segment after the first
		 * holds the surface at its extreme for a few frames, which is the beat that makes the
		 * extension read as a release rather than as a scale.
		 *
		 * Reduced motion skips them outright — squash, stretch and anticipation are precisely
		 * the extra movement that setting asks not to be shown — while the `else` branch is
		 * what returns a half-deformed bar to square on the way out.
		 */
		const deforming = opening && !reduced && start.gather < 1;

		/** One deformation channel: keyframed away from square and back, or sent home. */
		function deform(channel: MotionValue<number>, keyframes: number[], times: number[]) {
			if (!deforming) {
				if (channel.get() !== 1) animations.push(animate(channel, 1, collapse));
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
			[start.lead, start.lead + TOOLBAR_MORPH_GATHER.release]
		);
		deform(
			transform.stretchY,
			[TOOLBAR_MORPH_VOLUME.swell, TOOLBAR_MORPH_VOLUME.flatten, 1],
			[start.lead, start.lead + TOOLBAR_MORPH_VOLUME.dip, start.lead + TOOLBAR_MORPH_VOLUME.release]
		);

		let cancelled = false;
		Promise.all(animations.map((animation) => animation.finished))
			.then(() => {
				if (cancelled) return;
				settle();
				// The retraction is over, so the bar leaves the interaction and accessibility
				// trees. A re-open mid-retraction cancels this run, so it can never happen to a
				// bar that is on its way back out.
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
	 * Focus follows `activeId` while the bar is out.
	 *
	 * Guarded on `present`, because a `visibility: hidden` element cannot take focus — the
	 * state is written the moment the bar opens, and the bar is only focusable once that
	 * has reached the DOM.
	 *
	 * Focus moves into the bar on every expansion, pointer or keyboard, which is what
	 * keeps focus off the trigger while the trigger is not drawn. The ring stays
	 * `:focus-visible`, so a click does not leave one behind.
	 */
	$effect(() => {
		if (!expanded || !present || !activeId) return;
		const element = itemElements[activeId];
		if (element && document.activeElement !== element) element.focus();
	});

	function setExpanded(next: boolean) {
		if (next === expanded) return;
		expanded = next;
		onexpandedchange?.(next);
	}

	/**
	 * A bar whose every item is disabled still opens — seeing why the actions are
	 * unavailable is the point of opening it — with focus left wherever it was. Only a bar
	 * with no items at all refuses.
	 */
	function expand(focus: 'first' | 'last') {
		if (disabled || items.length === 0) return;
		const target = focus === 'last' ? enabled[enabled.length - 1] : enabled[0];
		activeId = target?.id ?? null;
		setExpanded(true);
	}

	/**
	 * `returnFocus` is honoured only when focus is still inside the control. Collapsing
	 * because the user clicked elsewhere across the page must not yank their focus back to
	 * the trigger.
	 */
	function collapse(returnFocus: boolean) {
		if (!expanded) return;
		const inside = wrapperElement?.contains(document.activeElement);
		setExpanded(false);
		activeId = null;
		if (returnFocus && inside) triggerElement?.focus();
	}

	/**
	 * Acting on an item leaves the bar open, which is the whole difference between a
	 * toolbar and a menu: these are repeatable actions against a subject that is still on
	 * screen, not a single choice that dismisses what asked for it.
	 */
	function act(entry: LiquidToolbarItem) {
		if (entry.disabled) return;
		activeId = entry.id;
		onaction?.(entry.id);
	}

	/** Wraps around, and skips disabled items by walking `enabled` rather than `items`. */
	function move(delta: number) {
		if (enabled.length === 0) return;

		const current = enabled.findIndex((entry) => entry.id === activeId);
		// Nothing focused yet, so enter the row from whichever end the key points at.
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
	 * immediately, and by `click` time the browser has already moved focus, which makes
	 * the focus bookkeeping in `collapse` unreliable.
	 */
	$effect(() => {
		if (!expanded) return;

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (target instanceof Node && wrapperElement?.contains(target)) return;
			collapse(false);
		};

		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	});

	function onTriggerKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			expand('first');
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			expand('last');
		}
	}

	/**
	 * Arrow keys move focus; Tab is left alone.
	 *
	 * That is the ARIA toolbar pattern and it is the opposite of the menu's: a toolbar is
	 * one tab stop that arrows navigate *within*, so Tab has to fall through and take
	 * focus out of the control entirely — where `onFocusOut` collapses it.
	 */
	function onRowKeyDown(event: KeyboardEvent) {
		/*
		 * Tab is not prevented — moving on to the next control is exactly what was asked
		 * for — but the bar does not get to stay behind, and this is the one dismissal that
		 * cannot be left to `onFocusOut`.
		 *
		 * The trigger is invisible while the bar is out, and it is the *previous* thing in
		 * the tab order. So a bar left open behind departing focus is a bar the user can
		 * shift-Tab back into and land on nothing they can see. Collapsing here puts the
		 * button back before focus has gone anywhere.
		 */
		if (event.key === 'Tab') return collapse(false);

		if (event.key === 'ArrowRight') move(1);
		else if (event.key === 'ArrowLeft') move(-1);
		else if (event.key === 'Home') activeId = enabled[0]?.id ?? null;
		else if (event.key === 'End') activeId = enabled[enabled.length - 1]?.id ?? null;
		else return;

		event.preventDefault();
	}

	/** Escape is handled on the wrapper so it works from the trigger and the items alike. */
	function onWrapperKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !expanded) return;
		event.preventDefault();
		collapse(true);
	}

	/**
	 * Focus moving *to* somewhere outside collapses the bar — the backstop for every way
	 * focus can leave that this component has not enumerated: a screen reader jumping
	 * elsewhere, a browser find, a nested iframe.
	 *
	 * A null `relatedTarget` is deliberately not one of them, and this is where the toolbar
	 * has to part company with `LiquidMenu`'s otherwise identical handler. Null means focus
	 * was *dropped* rather than moved, and the ordinary way to drop it is to press a part
	 * of this control that cannot take it — the bar's own padding, or the two pixels of gap
	 * between two icons. On a menu that is a rare press on a panel that was about to close
	 * anyway. On a bar built to stay open it is a dismissal every time the user aims
	 * slightly wide of a target, which is the sort of bug that gets described as "it closes
	 * randomly".
	 *
	 * Nothing is lost by ignoring it. A press that genuinely lands outside is already
	 * handled — by the `pointerdown` listener above, which does not care whether what it
	 * hit was focusable — and a window losing focus is not a dismissal in the first place.
	 */
	function onFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next === null) return;
		if (next instanceof Node && wrapperElement?.contains(next)) return;
		collapse(false);
	}
</script>

<!--
	Positioned relative to the trigger with plain absolute positioning, deliberately not
	the top layer: `backdrop-filter` inside a popover would sample a backdrop the bar is
	no longer part of. The corollary is the consumer's to own — an ancestor with
	`overflow: hidden` clips the bar, and (as everywhere in this library) a transformed
	ancestor kills its refraction.
-->
<div
	bind:this={wrapperElement}
	class={`lg-toolbar ${className}`}
	{style}
	style:--lg-toolbar-pad={`${geometry.padding}px`}
	style:--lg-toolbar-well={`${geometry.well}px`}
	style:--lg-toolbar-gap={`${geometry.gap}px`}
	style:--lg-toolbar-icon={`${geometry.icon}px`}
	style:--lg-toolbar-fade={TOOLBAR_ITEM_FADE}
	style:--lg-toolbar-rise={TOOLBAR_ITEM_RISE}
	data-anchor={anchor}
	onkeydowncapture={onWrapperKeyDown}
	onfocusout={onFocusOut}
>
	<!--
		The trigger is out of the tab order for exactly as long as it is not drawn, and no
		longer.

		`opacity: 0` leaves an element focusable, which this one has to be — Escape and a
		collapse both return focus here, and from a `visibility: hidden` button it would land
		on the body instead, which is the one place a keyboard user cannot continue from.
		What it must not be is *reachable by Tab* while invisible: it sits immediately before
		the bar in the tab order, so shift-Tab out of the bar would otherwise land on a
		control that is not there. `-1` keeps `.focus()` working and takes the sequence away.
	-->
	<LiquidButton
		bind:element={triggerElement}
		id={triggerId}
		{disabled}
		shape="circle"
		{size}
		{variant}
		{quality}
		{mode}
		class={`lg-toolbar-trigger ${present ? 'is-yielded' : ''}`}
		aria-label={triggerLabel}
		aria-expanded={expanded}
		aria-controls={barId}
		tabindex={present ? -1 : undefined}
		onclick={() => (expanded ? collapse(true) : expand('first'))}
		onkeydown={onTriggerKeyDown}
	>
		{@render children?.()}
	</LiquidButton>

	<!--
		Mounted at all times, hidden with `visibility` rather than `{#if}`.

		Two reasons, and they compound. The displacement map is rasterised from the
		measured size, so a bar created on expand would spend its first frames on the
		degraded tier and snap into refraction once the PNG arrived — visible, and exactly
		during the animation that matters. And `visibility: hidden` is measured by
		`ResizeObserver` (unlike `display: none`), yet is out of the tab order and out of
		the accessibility tree, which is what a collapsed toolbar has to be. Both the item
		thresholds and the morph's own scale are measurements taken while hidden.
	-->
	<LiquidGlass
		bind:element={shellElement}
		height={geometry.height}
		borderRadius={geometry.height / 2}
		{bezel}
		displacement={optics.displacement}
		opacity={optics.opacity}
		saturation={optics.saturation}
		blur={optics.blur}
		specularIntensity={optics.specularIntensity}
		shadowIntensity={optics.shadowIntensity}
		{variant}
		{quality}
		{mode}
		class={`lg-toolbar-shell ${present ? 'is-present' : ''} ${expanded ? 'is-open' : ''}`}
	>
		<!--
			`tabindex="-1"` keeps the container out of the tab order while leaving it a
			legitimate target for the key handler. The toolbar's single tab stop lives on an
			*item* (see `tabStopId`), which is what the ARIA pattern asks for — the container
			must never be focusable in sequence, or Tab would land on the bar itself before
			reaching anything in it.
		-->
		<div
			bind:this={rowElement}
			id={barId}
			role="toolbar"
			tabindex={-1}
			aria-label={label}
			aria-orientation="horizontal"
			class="lg-toolbar-row"
			onkeydown={onRowKeyDown}
		>
			{#each items as entry (entry.id)}
				{#if entry.separated}
					<!-- Shares the following item's threshold: the hairline belongs to the gap
					     the item is about to occupy, so it must not light ahead of it. -->
					<span
						class="lg-toolbar-veil lg-toolbar-separator"
						style:--lg-toolbar-at={thresholds[entry.id] ?? 0}
						aria-hidden="true"
					></span>
				{/if}
				<button
					bind:this={itemElements[entry.id]}
					type="button"
					class="lg-toolbar-veil lg-toolbar-item"
					class:lg-toolbar-text={!entry.icon}
					class:lg-toolbar-selected={entry.selected}
					class:lg-toolbar-destructive={entry.destructive}
					style:--lg-toolbar-at={thresholds[entry.id] ?? 0}
					disabled={entry.disabled}
					aria-disabled={entry.disabled ? 'true' : undefined}
					aria-label={entry.icon ? entry.label : undefined}
					aria-pressed={entry.selected === undefined ? undefined : entry.selected}
					tabindex={entry.id === tabStopId ? 0 : -1}
					onclick={() => act(entry)}
					onfocus={() => (activeId = entry.id)}
				>
					{#if entry.icon}
						{@render entry.icon()}
					{:else}
						{entry.label}
					{/if}
				</button>
			{/each}
		</div>
	</LiquidGlass>
</div>

<style>
	.lg-toolbar {
		position: relative;
		display: inline-block;
	}

	/*
	 * The other half of the morph: the trigger *is* the bar for as long as the bar is
	 * out, so it stops being drawn for exactly that long — `present`, not `expanded`,
	 * which is what makes it come back at the end of the retraction rather than at the
	 * start of it. The shrinking patch is the button on its way home; a button
	 * reappearing underneath it while it is still travelling is two of them.
	 *
	 * Switched, never transitioned. Any opacity strictly between 0 and 1 turns the button
	 * into a backdrop root and kills its own refraction, so a fade would spend its whole
	 * length showing a flat disc where a lens was. There is nothing to fade anyway: both
	 * swaps happen on a frame where the bar is parked exactly over the trigger, at its
	 * size, in its place.
	 *
	 * `opacity: 0` rather than `visibility: hidden` because a hidden element cannot take
	 * focus, and collapsing returns focus here — from a hidden trigger it would land on
	 * the body instead, which is the one place a keyboard user cannot continue from.
	 * Invisible and focusable is also what the trigger has to be for a screen reader,
	 * which is still being told there is an expanded control here.
	 */
	.lg-toolbar :global(.lg-toolbar-trigger.is-yielded) {
		opacity: 0;
	}

	.lg-toolbar :global(.lg-toolbar-shell) {
		position: absolute;
		z-index: 30;
		top: 0;
		padding: var(--lg-toolbar-pad);

		/*
		 * The bar grows from the middle of the box it is going to fill, and the anchored
		 * edge is held by the *translation* rather than by the origin.
		 *
		 * That looks backwards and is not. The collapsed patch is placed on the trigger by
		 * a measured translation, and a scale about the centre leaves that translation
		 * meaning the same thing at every scale: the patch stays centred on wherever it has
		 * travelled to. A corner origin would instead pin one end of the growing box and
		 * swing the patch off the button the moment the scale moved. With both in place the
		 * anchored edge is stationary as an *arithmetic consequence* — at the collapsed end
		 * the translation is exactly the half-width difference, at the settled end both are
		 * zero, and the spring between them keeps the two in step.
		 */
		transform-origin: center;
	}

	/*
	 * Which edge the bar keeps. `left`/`right` are layout, so `morphStart`'s `offsetLeft`
	 * reading picks them up and the travel comes out right for all three without a
	 * special case anywhere in the script.
	 */
	.lg-toolbar[data-anchor='start'] :global(.lg-toolbar-shell) {
		left: 0;
	}

	.lg-toolbar[data-anchor='end'] :global(.lg-toolbar-shell) {
		right: 0;
	}

	/*
	 * Centred on the trigger by a negative margin over `left: 50%`, and the margin is why
	 * this is not `translate: -50%`.
	 *
	 * A translation would be invisible to `offsetLeft`, so the measured travel would be
	 * out by half the bar's width and the collapsed patch would park half a bar away from
	 * the trigger. Margins are layout; `offsetLeft` includes them, and the same arithmetic
	 * that serves the other two anchors serves this one. It also keeps `transform` the
	 * sole property Motion writes on this element, which is the rule everywhere else in
	 * this library.
	 *
	 * `-50%` resolves against the *containing block*, not the element, so it cannot be
	 * used here — hence the pair of custom properties. `--lg-toolbar-half` is unset until
	 * the row has been measured, and until then the bar is hidden.
	 */
	.lg-toolbar[data-anchor='center'] :global(.lg-toolbar-shell) {
		left: 50%;
		margin-left: calc(-1 * var(--lg-toolbar-half, 0px));
	}

	/*
	 * The row cancels the shell's scale, so nothing inside the glass is ever deformed by
	 * it — see the per-frame writer for why that matters. `1` in both fallbacks so the
	 * settled bar is what renders before the first write and if scripting never runs.
	 *
	 * The origin is the *anchored edge of the shell*, which is a padding-width outside the
	 * row's own box: cancelling a scale about a different point than the shell's anchored
	 * edge leaves a drift proportional to the offset. It converges to zero as the bar
	 * settles either way, so `left` would be a few pixels wrong for a few frames rather
	 * than broken — but the exact origin is one `calc` and no arithmetic.
	 *
	 * The CSS `scale` property rather than `transform`, deliberately: `transform` on this
	 * element would be a second, separate owner of a property that Motion owns two levels
	 * up, and a reader looking for who writes transforms should keep finding one answer.
	 */
	.lg-toolbar-row {
		position: relative;
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: var(--lg-toolbar-gap);
		scale: var(--lg-toolbar-counter-x, 1) var(--lg-toolbar-counter-y, 1);
	}

	.lg-toolbar[data-anchor='start'] .lg-toolbar-row {
		transform-origin: calc(-1 * var(--lg-toolbar-pad)) center;
	}

	.lg-toolbar[data-anchor='end'] .lg-toolbar-row {
		transform-origin: calc(100% + var(--lg-toolbar-pad)) center;
	}

	.lg-toolbar[data-anchor='center'] .lg-toolbar-row {
		transform-origin: center;
	}

	/*
	 * The shell is a row that fills its box, overriding the primitive's centring
	 * inline-flex — and it must not shrink. An absolutely positioned box is sized
	 * shrink-to-fit against the space from its anchored edge to the containing block's,
	 * which here is the width of one trigger; it comes out at the row's min-content width
	 * only because nothing in the row may wrap or compress.
	 */
	.lg-toolbar :global(.lg-toolbar-shell > .lg-content) {
		display: block;
	}

	/*
	 * Hidden, but still laid out and still measured — see the markup. `visibility` is safe
	 * on a glass surface in a way `opacity` is not: it is not one of the properties that
	 * turns an element into a backdrop root.
	 */
	.lg-toolbar :global(.lg-toolbar-shell:not(.is-present)) {
		visibility: hidden;
	}

	/* Ignore presses at once on collapse, while the retraction is still playing out. */
	.lg-toolbar :global(.lg-toolbar-shell:not(.is-open)) {
		pointer-events: none;
	}

	/*
	 * Each item's reveal, computed from one inherited number.
	 *
	 * The whole stagger is this declaration. `--lg-toolbar-unroll` is written once per
	 * frame on the shell and inherits; `--lg-toolbar-at` is the item's own geometric
	 * threshold, static until the bar is remeasured. So N items reveal in sequence off a
	 * single style write, with no per-item animation, no timer, and nothing to keep in
	 * step — and the retraction plays it backwards for free.
	 *
	 * Both fallbacks describe a settled bar (`unroll: 1`, `at: 0`), so an item renders
	 * visible on the server and before the first frame is written. That is the safe end:
	 * a collapsed bar is `visibility: hidden` regardless, while a bar rendered expanded
	 * has to arrive with its items in it.
	 */
	.lg-toolbar-veil {
		--lg-toolbar-reveal: clamp(
			0,
			calc((var(--lg-toolbar-unroll, 1) - var(--lg-toolbar-at, 0)) / var(--lg-toolbar-fade)),
			1
		);

		opacity: var(--lg-toolbar-reveal);
	}

	.lg-toolbar-item {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		width: var(--lg-toolbar-well);
		height: var(--lg-toolbar-well);
		box-sizing: border-box;
		appearance: none;
		border: 0;
		margin: 0;
		padding: 0;
		border-radius: 999px;
		background: none;
		color: inherit;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.28);

		/*
		 * Riding the same reveal as the opacity, so the wells grow into place as the edge
		 * passes them. The counter-scale holds them at their settled size and position from
		 * the first frame, so without this they would cross-fade in place — correct, and
		 * inert.
		 */
		scale: calc(var(--lg-toolbar-rise) + (1 - var(--lg-toolbar-rise)) * var(--lg-toolbar-reveal));
		transition: background-color 140ms ease;
	}

	/*
	 * A text item is a word, not a glyph, so it is allowed its own width.
	 *
	 * Driven by a class rather than by `:not(:has(svg))`, which is the selector this
	 * obviously wants: the `svg` would be consumer content arriving through a snippet, and
	 * Svelte's unused-CSS analysis has no way to know it is ever there. The class is
	 * decided from the same `icon` the markup branches on, so the two cannot disagree.
	 */
	.lg-toolbar-text {
		width: auto;
		min-width: var(--lg-toolbar-well);
		padding-inline: 0.6rem;
	}

	/*
	 * Same sizing contract as `LiquidButton`'s circles, and the same parity argument — see
	 * TOOLBAR_SIZES. `--lg-icon-size` stays the consumer's override and is read first, so
	 * setting it anywhere up the tree still wins.
	 */
	.lg-toolbar-item :global(svg) {
		display: block;
		flex: 0 0 auto;
		width: var(--lg-icon-size, var(--lg-toolbar-icon));
		height: var(--lg-icon-size, var(--lg-toolbar-icon));
	}

	.lg-toolbar-item:hover:not(:disabled) {
		background: rgb(255 255 255 / 0.14);
	}

	.lg-toolbar-item:active:not(:disabled) {
		background: rgb(255 255 255 / 0.24);
	}

	/*
	 * `:focus-visible` only, and no `:focus` highlight — the opposite of `LiquidMenu`.
	 * Focus moves into the bar on every expansion, including a pointer one, so a
	 * highlight on plain focus would put a mark on the first item every time the bar is
	 * clicked open.
	 */
	.lg-toolbar-item:focus-visible {
		outline: 2px solid rgb(255 255 255 / 0.85);
		outline-offset: -2px;
	}

	/* The pressed well of a toggle item. Reads as inset, against the raised glass. */
	.lg-toolbar-selected {
		background: rgb(255 255 255 / 0.22);
		box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.18);
	}

	.lg-toolbar-destructive {
		color: rgb(255 138 128);
	}

	.lg-toolbar-item:disabled {
		cursor: not-allowed;
		/*
		 * Multiplied into the reveal rather than set outright, or a disabled item would be
		 * the one thing in the bar that is visible before the edge reaches it.
		 */
		opacity: calc(var(--lg-toolbar-reveal) * 0.4);
	}

	.lg-toolbar-separator {
		flex: 0 0 auto;
		align-self: center;
		width: 1px;
		height: calc(var(--lg-toolbar-well) * 0.55);
		margin-inline: calc(var(--lg-toolbar-gap) / 2);
		background: rgb(255 255 255 / 0.18);
	}

	@media (prefers-reduced-motion: reduce) {
		.lg-toolbar-item {
			transition-duration: 0ms;
		}
	}
</style>
