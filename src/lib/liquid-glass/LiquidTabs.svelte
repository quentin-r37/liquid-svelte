<script lang="ts">
	import { animate, cancelFrame, frame } from 'motion';
	import type { Snippet } from 'svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import type { GlassMode, GlassQuality } from './liquidGlass.types.js';
	import { setGlassProperties } from './runtime/applyGlassStyle.js';
	import { reducedMotion } from './runtime/capabilities.svelte.js';
	import { DropletMorph } from './runtime/dropletMorph.svelte.js';
	import {
		acquireGlassTransform,
		applyDrag,
		stepStretch,
		type GlassTransform
	} from './runtime/glassMotion.js';
	import {
		TABS_BUBBLE,
		TABS_BUBBLE_ACTIVE,
		TABS_BUBBLE_REST,
		TABS_GLASS_ACTIVE,
		TABS_GLASS_REST,
		TABS_RAIL
	} from './runtime/glassTokens.js';
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
		/*
		 * No `cornerShape` here on purpose. Both the rail and the bubble are capsules —
		 * radius saturated at half their box — and a capsule has no straight edge for a
		 * superellipse to meet, so the primitive would demote the corner to `round`
		 * whatever was passed. iOS segmented controls are capsules too. A prop that
		 * provably cannot change the output is worse than no prop.
		 */
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

	/** Pointer travel below which a gesture counts as a tap, not a drag. */
	const TAP_THRESHOLD = 3;

	interface Segment {
		x: number;
		y: number;
		width: number;
		height: number;
	}

	let rowElement = $state<HTMLElement | null>(null);
	let bubbleElement = $state<HTMLElement | null>(null);
	let bubbleTransform = $state<GlassTransform | null>(null);
	let buttons = $state<Record<string, HTMLButtonElement | undefined>>({});
	let dragging = $state(false);

	/** Set when a gesture moved far enough to be a drag, so the click is swallowed. */
	let suppressClick = false;

	/** Geometry of every segment, in the coordinate space of the stack. */
	let segments = $state<Segment[]>([]);
	/** Border-box height of the row, which is also the rail's. */
	let railHeight = $state(0);

	const selectedIndex = $derived(
		Math.max(
			0,
			tabs.findIndex((tab) => tab.id === value)
		)
	);

	const active = $derived<Segment>(segments[selectedIndex] ?? { x: 0, y: 0, width: 0, height: 0 });

	/**
	 * The rail's refracting band. Derived from the *measured* row height rather than
	 * from the segment height plus a padding constant, so the inset stays a fact
	 * about the stylesheet and is never duplicated here to drift out of agreement
	 * with it.
	 */
	const railBezel = $derived(Math.max(TABS_RAIL.bezelMin, railHeight * TABS_RAIL.bezelRatio));

	/**
	 * The box the bubble is *laid out* at, which is its swollen size — see
	 * {@link TABS_BUBBLE.restScale}. It is drawn scaled down for as long as nothing is
	 * touching the control, so this is never the size it reads as.
	 */
	const laidOut = $derived({
		width: Math.round(active.width / TABS_BUBBLE.restScale),
		height: Math.round(active.height / TABS_BUBBLE.restScale)
	});

	const bubbleBezel = $derived(Math.max(4, Math.round(laidOut.height * TABS_BUBBLE.bezelRatio)));
	const bubbleRadius = $derived(Math.round(laidOut.height * TABS_BUBBLE.cornerRatio));

	/**
	 * Where the laid-out box has to sit for the *scaled* one to land on its segment.
	 *
	 * A transform scales about the element's centre, so a box laid out with slack on
	 * every side and drawn at `restScale` ends up centred on the laid-out box —
	 * i.e. half the slack to the right of, and below, where it was placed. Pulling it
	 * back by that half is what makes the idle bubble cover its segment exactly, and
	 * it is the same correction `LiquidSwitch` makes through `geometry.inset`.
	 *
	 * `left` is a constant, so the transform's `x` channel stays in segment
	 * coordinates and the drag's bounds, snap and nearest-segment search need to know
	 * nothing about any of this.
	 */
	const bubbleOrigin = $derived({
		left: -(laidOut.width - active.width) / 2,
		top: active.y - (laidOut.height - active.height) / 2
	});

	/**
	 * Measured with `offsetLeft` / `offsetWidth` rather than
	 * `getBoundingClientRect`, because the bubble's own live transform would pollute
	 * a rect reading — and these are relative to the row, which is in flow at the
	 * origin of the stack and is therefore the same coordinate space the bubble is
	 * positioned in.
	 *
	 * Every segment is measured, not just the selected one: a drag has to know where
	 * the stops are, and the bounds it is given have to cover the whole run.
	 */
	function measure() {
		const next: Segment[] = [];
		for (const tab of tabs) {
			const button = buttons[tab.id];
			if (!button) return;
			next.push({
				x: button.offsetLeft,
				y: button.offsetTop,
				width: button.offsetWidth,
				height: button.offsetHeight
			});
		}

		const unchanged =
			next.length === segments.length &&
			next.every(
				(segment, index) =>
					segment.x === segments[index].x &&
					segment.y === segments[index].y &&
					segment.width === segments[index].width &&
					segment.height === segments[index].height
			);
		if (!unchanged) segments = next;

		const height = rowElement?.offsetHeight ?? 0;
		if (height !== railHeight) railHeight = height;
	}

	// Remeasure on a font swap, container resize or label edit.
	$effect(() => {
		if (!rowElement) return;
		return observeSize(rowElement, measure);
	});

	// Reading every `buttons[id]` inside `measure` registers the dependencies, so
	// this runs both when the selection changes and when a button mounts.
	$effect(measure);

	/*
	 * Acquisition is kept in its own effect, separate from the travel animation.
	 * Releasing and re-acquiring on every selection would tear down the shared
	 * transform and snap the bubble back to zero mid-flight.
	 *
	 * `pressScale` carries the whole idle ↔ swollen morph, so it starts at the idle
	 * scale rather than at 1. Set imperatively, not animated: this is a static state,
	 * and animating it here would make the bubble shrink into place on mount.
	 */
	$effect(() => {
		if (!bubbleElement) return;
		const transform = acquireGlassTransform(bubbleElement);
		transform.pressScale.set(TABS_BUBBLE.restScale);
		bubbleTransform = transform;
		return () => {
			bubbleTransform = null;
			transform.pressScale.set(1);
			transform.release();
		};
	});

	/**
	 * The bubble's placement inside the stack.
	 *
	 * Written with `setProperty` rather than through the `style` attribute because
	 * Motion owns this element's `transform` and Svelte rewrites `cssText` wholesale
	 * whenever the attribute it manages changes. `LiquidGlass` writes its own
	 * `width` / `height` and custom properties onto the same element the same way, so
	 * the two never collide — they touch disjoint keys.
	 *
	 * Both values are constants in practice: segments are laid out at equal width
	 * (see `grid-auto-columns: 1fr` in the styles), which is how iOS lays a segmented
	 * control out too, and is what keeps the bubble's geometry — and therefore its
	 * displacement map — fixed for the life of the control.
	 */
	$effect(() => {
		if (!bubbleElement) return;
		setGlassProperties(bubbleElement, {
			left: `${bubbleOrigin.left}px`,
			top: `${bubbleOrigin.top}px`
		});
	});

	/**
	 * The bubble is the switch knob's morph at a selection fill's weight: a quiet
	 * tinted tile at rest that melts into a lens when the control is touched. Same
	 * mechanism, endpoints of its own — see {@link TABS_BUBBLE_REST} for why the knob's
	 * near-opaque rest state is wrong for one cell of a row.
	 *
	 * That it can be glass at all is the whole reason it is not a child of the rail.
	 * A `backdrop-filter` inside another does not compose: the inner one's backdrop
	 * is the outer element's *content*, which for a glass surface is a couple of
	 * near-transparent tint layers, so a nested bubble would refract nothing and read
	 * as a flat washed-out pill. As a sibling painted over the rail its backdrop is
	 * the page with the rail's own output composited onto it, which is exactly what a
	 * lens sliding across a glass surface should be sampling.
	 */
	const droplet = new DropletMorph({ rest: TABS_BUBBLE_REST, active: TABS_BUBBLE_ACTIVE });

	/**
	 * The rail's own, much smaller morph. A container does not *become* glass the way
	 * a knob does — it is glass throughout, and what this carries is the surface
	 * waking up under the hand: the backdrop saturating, the refraction deepening,
	 * the rim lighting. See {@link TABS_GLASS_REST}.
	 */
	const railGlass = new DropletMorph({ rest: TABS_GLASS_REST, active: TABS_GLASS_ACTIVE });

	$effect(() => {
		droplet.setReduced(reducedMotion.current);
		railGlass.setReduced(reducedMotion.current);
	});
	$effect(() => () => {
		droplet.destroy();
		railGlass.destroy();
		if (meltTimer !== null) clearTimeout(meltTimer);
	});

	/**
	 * The melt, published to CSS so the selected label can follow it.
	 *
	/** Whether the control is currently melted, so repeat engagements are no-ops. */
	let melted = false;
	let meltedAt = 0;
	/** Set while a release is waiting out {@link TABS_BUBBLE.meltFloorMs}. */
	let meltTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Why the control is currently melted. The surface only freezes back once no
	 * reason is left.
	 *
	 * A single boolean was not enough, and the way it failed is worth keeping written
	 * down. `LiquidSwitch` gets away with one because it *is* one element: the only
	 * things that can end its melt are a pointer release and a blur of the switch
	 * itself. A tablist is several focusable elements, and `blur` fires on whichever
	 * one is losing focus — which, when a press lands on a tab that is not the focused
	 * one, is a *different* tab from the one being pressed. So the second drag of a
	 * session (the first having moved the selection, and left focus behind on the tab
	 * it started from) went: press → melt engaged → browser moves focus → blur on the
	 * old tab → melt released → floor timer armed → 180ms later the bubble deflated
	 * with the finger still down.
	 *
	 * Flags rather than a count, because the two pointer engagements — the row's own
	 * `pointerdown` and the drag's `onStart` — are the same physical press reaching
	 * this from two places, so the first release of that press must end it. Two
	 * separate *kinds* of engagement, pointer and keyboard, genuinely can overlap.
	 *
	 * Plain fields, not `$state` and not a `SvelteSet`: nothing reads them but the two
	 * functions below, they are written from event handlers rather than from effects,
	 * and making them reactive would schedule a render pass per press for a value that
	 * never reaches the template — the same reason `melted` and `suppressClick` are
	 * ordinary locals.
	 */
	type MeltReason = 'pointer' | 'key';
	const meltReasons = { pointer: false, key: false };

	function engageMelt(reason: MeltReason) {
		meltReasons[reason] = true;
		melt(true);
	}

	function releaseMelt(reason: MeltReason) {
		if (!meltReasons[reason]) return;
		meltReasons[reason] = false;
		if (!meltReasons.pointer && !meltReasons.key) melt(false);
	}

	/**
	 * Idempotent in both directions, and floored on the way out, for exactly the
	 * reasons spelled out on `LiquidSwitch`'s copy of this: the same gesture reaches
	 * it from more than one place (a press on the selected tab arrives from the
	 * drag's `onStart` *and* from the row's own pointer handler, and a held arrow key
	 * repeats `keydown`), and an unfloored release lets an ordinary click show only
	 * the first third of the morph.
	 *
	 * Not called directly — go through {@link engageMelt} / {@link releaseMelt}, which
	 * are what know whether anything still wants the surface melted.
	 */
	function melt(engaged: boolean) {
		if (engaged) {
			if (meltTimer !== null) {
				clearTimeout(meltTimer);
				meltTimer = null;
			}
			if (melted) return;
			melted = true;
			meltedAt = performance.now();
			droplet.engage();
			railGlass.engage();
			swell(TABS_BUBBLE.activeScale, 'droplet');
			return;
		}

		if (!melted || meltTimer !== null) return;

		const remaining = TABS_BUBBLE.meltFloorMs - (performance.now() - meltedAt);
		if (remaining > 0 && !reducedMotion.current) {
			meltTimer = setTimeout(() => {
				meltTimer = null;
				melt(false);
			}, remaining);
			return;
		}

		melted = false;
		droplet.release();
		railGlass.release();
		swell(TABS_BUBBLE.restScale, 'settle');
	}

	/**
	 * The swell, on the transform's `pressScale` channel — which leaves `x` free for
	 * the travel, `dragScale` free for `applyDrag`, and `stretchX`/`stretchY` free
	 * for the deformation, all composing into one transform per frame.
	 */
	function swell(scale: number, spring: 'droplet' | 'settle') {
		const transform = bubbleTransform;
		if (!transform) return;
		animate(transform.pressScale, scale, springFor(spring, reducedMotion.current));
	}

	/**
	 * Whether the bubble has been placed at all yet. The first placement is a fact
	 * about where the control *starts*, not a movement it makes, so it is `set`
	 * rather than sprung: a page that opens with the third tab selected must not
	 * bounce a capsule in from the left rim on load.
	 */
	let placed = false;

	/**
	 * Travel, and the deformation that goes with it.
	 *
	 * The spring is the switch thumb's — see {@link SPRINGS.elastic}. Both controls
	 * are a tile thrown between fixed stops, and a spring interrupted mid-flight
	 * carries its velocity into the new direction, which is what makes a tab tapped
	 * while the bubble is still moving read as a redirection rather than a restart.
	 *
	 * The squash is the other half of what the switch does, and it needs a frame loop
	 * here because there is no drag supplying one: a tap and an arrow key move the
	 * bubble through `animate`, so the velocity has to be read back off the channel
	 * per frame and turned into deformation. {@link stepStretch} rather than
	 * {@link applyStretch} for the same reason `applyDrag` uses it — a spring
	 * restarted once a frame re-seeds itself from its own discrete velocity and
	 * diverges instead of settling.
	 *
	 * The loop outlives the animation by however long the deformation takes to land
	 * back on 1, which is what `stepStretch`'s return value reports; only once *both*
	 * the travel is finished and the channels have settled does it cancel itself.
	 *
	 * Skipped while a drag is in flight — there the finger owns the position, and
	 * `applyDrag` runs its own tick over the same channels.
	 */
	$effect(() => {
		const transform = bubbleTransform;
		if (!transform || active.width === 0 || dragging) return;

		if (!placed) {
			placed = true;
			transform.x.set(active.x);
			return;
		}

		// The deformation channels are `set` below rather than animated, so a settle
		// spring still running from a release would overwrite every value this writes,
		// once per frame, for as long as its tail lasts — and a spring's tail is long.
		transform.stretchX.stop();
		transform.stretchY.stop();

		let travelling = true;
		const done = () => {
			travelling = false;
		};

		const slide = animate(transform.x, active.x, springFor('elastic', reducedMotion.current));
		slide.finished.then(done, done);

		const tick = ({ delta }: { delta: number }) => {
			const busy = stepStretch(
				transform,
				transform.x.getVelocity(),
				0,
				delta,
				reducedMotion.current
			);
			if (!busy && !travelling) cancelFrame(tick);
		};
		frame.update(tick, true);

		return () => {
			// Unconditionally: `frame.update(…, true)` keeps a callback alive until it is
			// cancelled, so a selection changed mid-travel would otherwise leave the old
			// tick running against the same channels as the new one.
			cancelFrame(tick);
			slide.stop();
		};
	});

	/** Nearest enabled segment to a position, in the bubble's coordinate space. */
	function nearestSegment(x: number): number {
		let best = selectedIndex;
		let bestDistance = Infinity;
		for (let index = 0; index < segments.length; index += 1) {
			if (tabs[index]?.disabled) continue;
			const distance = Math.abs(segments[index].x - x);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = index;
			}
		}
		return best;
	}

	/**
	 * The bubble is draggable, not just tappable — that is how the control behaves on
	 * iOS, and it is the interaction that makes the droplet legible: you push the
	 * selection across and it deforms as it goes.
	 *
	 * Listened on the **selected tab**, not on the bubble, and driven through
	 * `surface`. The bubble is painted underneath the labels and is
	 * `pointer-events: none`, so it can never be the pointer target; listening on the
	 * row instead would be worse still, since a press on a *distant* segment would
	 * start dragging the bubble from wherever it happened to be and the surface would
	 * trail the finger by a whole segment.
	 *
	 * Re-attached whenever the selection moves, which is safe — the bubble's
	 * transform is reference-counted and held open by its own effect, so releasing
	 * this holder never tears the channels down mid-flight.
	 *
	 * `restScale: 1` because the swell already lives on `pressScale`, where `melt`
	 * owns it; the default pick-up shrink would fight it.
	 */
	$effect(() => {
		const element = buttons[value];
		const surface = bubbleElement;
		if (!element || !surface || segments.length === 0) return;

		return applyDrag(element, {
			surface,
			axis: 'x',
			reduced: reducedMotion.current,
			restScale: 1,
			keyboard: false,
			bounds: () => ({
				minX: segments[0].x,
				maxX: segments[segments.length - 1].x,
				minY: 0,
				maxY: 0
			}),
			overshoot: reducedMotion.current ? 0 : active.width * TABS_BUBBLE.overshootRatio,

			snap: ({ x, velocityX, distance }) => {
				// A tap is not a drag: leave the position alone and let `onclick` decide.
				if (distance < TAP_THRESHOLD) return { x: active.x, y: 0 };
				// A flick wins over position, so a short fast push still crosses over.
				return { x: segments[nearestSegment(x + velocityX * TABS_BUBBLE.flickSeconds)].x, y: 0 };
			},

			onStart: () => {
				dragging = true;
				engageMelt('pointer');
			},

			onEnd: ({ x, distance }) => {
				dragging = false;
				releaseMelt('pointer');

				if (distance < TAP_THRESHOLD) return;

				suppressClick = true;
				// `x` is the snapped target, so this resolves to the segment `snap` chose.
				const tab = tabs[nearestSegment(x)];
				if (tab && tab.id !== value) {
					value = tab.id;
					onchange?.(tab.id);
				}
			},

			onCancel: () => {
				dragging = false;
				releaseMelt('pointer');
				suppressClick = true;
			}
		});
	});

	function select(tab: LiquidTab) {
		if (tab.disabled || tab.id === value) return;
		value = tab.id;
		onchange?.(tab.id);
	}

	function onClick(tab: LiquidTab) {
		// A completed drag ends with a click on the tab it started from; swallow it.
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		select(tab);
	}

	/**
	 * A press anywhere on the control melts it, not just a press on the selected
	 * segment. `applyDrag` only knows about gestures that start on the tab it is
	 * attached to, and most presses land on one of the others — which are precisely
	 * the presses that make the bubble travel, so they are the ones the morph is most
	 * worth showing on.
	 *
	 * The release listener goes on the window because the gesture does not have to
	 * end on the control: a press that slides off, or a drag whose pointer capture
	 * ends elsewhere, still has to let the surface freeze back.
	 *
	 * Attached imperatively rather than as an `onpointerdown` in the template, and
	 * not to dodge the a11y lint but because the lint is right: an element with
	 * `role="tablist"` that handles pointer events is asked to be focusable, and under
	 * the ARIA tabs pattern it must *not* be — the roving focus lives on the tabs. The
	 * gesture is not part of the tablist's semantics at all, it is wiring, so it
	 * belongs where the rest of this library's gesture wiring lives.
	 */
	$effect(() => {
		const element = rowElement;
		if (!element) return;

		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 0) return;
			engageMelt('pointer');

			const release = () => {
				releaseMelt('pointer');
				window.removeEventListener('pointerup', release);
				window.removeEventListener('pointercancel', release);
			};
			window.addEventListener('pointerup', release);
			window.addEventListener('pointercancel', release);
		};

		element.addEventListener('pointerdown', onPointerDown);
		return () => element.removeEventListener('pointerdown', onPointerDown);
	});

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
		// Keyboard travel gets the same melt a press does. The floor on the release is
		// what makes it visible at all, since a keystroke has no held phase.
		engageMelt('key');
		const tab = enabled[next];
		select(tab);
		buttons[tab.id]?.focus();
	}
</script>

<div class={`lg-tabs ${className}`} {style}>
	<!--
		Three layers, and the order of them is the whole design.

		The rail and the bubble are both glass, which is only possible because neither
		contains the other. A `backdrop-filter` nested inside another does not compose
		— the inner one's backdrop is the outer element's *content*, which for a glass
		surface is a couple of near-transparent tint layers — so a bubble inside the
		rail would refract nothing at all. Painted as its sibling it samples the page
		with the rail's own output composited onto it, which is what a lens travelling
		across a glass surface should see.

		The labels are a third layer above both, so an opaque bubble can pass under
		them without taking the text with it. That is also what lets the bubble be
		opaque at rest at all, which is the switch knob's defining state.
	-->
	<div class="lg-tabs-stack">
		<LiquidGlass
			borderRadius={999}
			bezel={railBezel}
			displacement={railBezel * railGlass.visual.displacementRatio}
			opacity={railGlass.visual.opacity}
			saturation={railGlass.visual.saturation}
			blur={railGlass.visual.blur}
			specularIntensity={railGlass.visual.specularIntensity}
			shadowIntensity={0.5}
			{quality}
			{mode}
			class="lg-tabs-rail"
		/>

		{#if active.width > 0}
			<LiquidGlass
				bind:element={bubbleElement}
				width={laidOut.width}
				height={laidOut.height}
				borderRadius={bubbleRadius}
				bezel={bubbleBezel}
				displacement={bubbleBezel * droplet.visual.displacementRatio}
				opacity={droplet.visual.opacity}
				saturation={droplet.visual.saturation}
				blur={droplet.visual.blur}
				specularIntensity={droplet.visual.specularIntensity}
				shadowIntensity={0.7}
				{quality}
				{mode}
				class="lg-tabs-bubble"
			/>
		{/if}

		<div
			bind:this={rowElement}
			role="tablist"
			aria-label={labelledBy ? undefined : label}
			aria-labelledby={labelledBy}
			class="lg-tabs-row"
		>
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
					onclick={() => onClick(tab)}
					onkeydown={onKeyDown}
					onkeyup={() => releaseMelt('key')}
					onblur={() => releaseMelt('key')}
				>
					{tab.label}
				</button>
			{/each}
		</div>
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
	 * The row is the only layer in flow, so it is what gives the stack its size; the
	 * rail then fills that and the bubble is placed against it. Doing it the other
	 * way round — rail in flow, labels absolutely positioned over it — would leave the
	 * labels unable to size anything, and a segmented control is sized by its widest
	 * label and nothing else.
	 *
	 * No `overflow`, no `isolation`, and no `z-index` on the stack itself: it must not
	 * become a backdrop root, or both surfaces inside it would lose their refraction.
	 * `position: relative` alone is safe — it creates a containing block, not a
	 * backdrop root.
	 */
	.lg-tabs-stack {
		position: relative;
		align-self: flex-start;
		max-width: 100%;
	}

	.lg-tabs :global(.lg-tabs-rail) {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}

	/*
	 * Anchored by `left`/`top` written from the placement effect — a constant offset
	 * that accounts for the slack the bubble is laid out with. Every subsequent
	 * movement is Motion's transform, so these stay static and nothing competes with
	 * it.
	 *
	 * `pointer-events: none` because the drag is listened on the selected tab above
	 * it (see the `applyDrag` effect); the bubble is never a pointer target.
	 */
	.lg-tabs :global(.lg-tabs-bubble) {
		position: absolute;
		z-index: 1;
		pointer-events: none;
		/*
		 * The one surface in the library tinted *against* its backdrop rather than with
		 * it. Every other piece of glass is a lighter patch of what is behind it, which
		 * is what a sheet of glass over a backdrop is; this is a fill marking one cell of
		 * a row, and it only reads as marked if it contrasts with the rail it sits in.
		 *
		 * Hence the scheme flip, which the rest of the library never needs: on a light
		 * material the selected cell is a shade darker, on a dark one a shade lighter.
		 * That is what iOS does, and it is the same reason its own fill colours are
		 * defined as "system fill" rather than as a grey.
		 *
		 * Only the *face* is recoloured — `--lg-tint-color`, not `--lg-rim`, so the rim
		 * hairline and the specular stay light in both schemes. They are reflections off
		 * a curved edge and have no business following the fill.
		 */
		--lg-tint-color: 60 60 67;
	}

	@media (prefers-color-scheme: dark) {
		.lg-tabs :global(.lg-tabs-bubble) {
			--lg-tint-color: 255 255 255;
		}
	}

	/*
	 * `grid-auto-columns: 1fr` sizes every segment to the widest label, which keeps
	 * the bubble a fixed size — and therefore its displacement map rasterised once
	 * for the life of the control. It is also how native segmented controls behave.
	 *
	 * The padding is the inset between the rail's rim and the bubble, and it lives
	 * here and nowhere else: `railBezel` is derived from the measured row height, so
	 * nothing in the script needs to know this number.
	 */
	.lg-tabs-row {
		position: relative;
		z-index: 2;
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		max-width: 100%;
		padding: 4px;
		box-sizing: border-box;
	}

	.lg-tabs-tab {
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

	/*
	 * The selected label is the accent colour, and that is what carries the selection
	 * as much as the fill does — a quiet tile alone is a weak signal, which is exactly
	 * why iOS pairs the two.
	 *
	 * It is also what let the whole morph-tracking colour machinery go. When the fill
	 * was a near-opaque white tile the ink had to travel with the melt — dark on the
	 * tile, page-ink over clear glass — which meant publishing the morph's progress to
	 * CSS and mixing against it every frame. A fill this quiet never obscures the
	 * label at either end of the morph, so the colour is simply constant.
	 *
	 * No text shadow, unlike the unselected labels' old one: that was there to hold
	 * the text off a moving backdrop, and over a tinted fill it only muddies it.
	 */
	.lg-tabs-tab[aria-selected='true'] {
		opacity: 1;
		cursor: grab;
		color: var(--lg-tabs-accent, rgb(0 122 255));
		/*
		 * Only the selected tab suppresses touch scrolling, and only because it is the
		 * one `applyDrag` listens on — the browser would otherwise claim a horizontal
		 * swipe for the page before the gesture was ever seen. Put on the whole row
		 * instead it would make the control a dead zone for scrolling, which is a lot
		 * to charge for a drag that can only start on one segment of it.
		 */
		touch-action: none;
	}

	.lg-tabs-tab[aria-selected='true']:active {
		cursor: grabbing;
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
