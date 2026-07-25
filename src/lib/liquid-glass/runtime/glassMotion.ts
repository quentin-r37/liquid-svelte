import { animate, hover, press } from 'motion';
import type { Attachment } from 'svelte/attachments';
import { acquireGlassTransform, type GlassTransform } from './glassTransform.js';
import {
	DRAG_ACTIVE_SCALE,
	DRAG_INERTIA_SECONDS,
	DRAG_OVERSHOOT_DECAY,
	DRAG_REST_SCALE,
	HOVER_LIFT,
	HOVER_SCALE,
	HOVER_SPECULAR_BOOST,
	KEYBOARD_STEP,
	KEYBOARD_STEP_COARSE,
	MAX_STRETCH,
	PRESS_SCALE,
	STRETCH_CROSS_RATIO,
	STRETCH_VELOCITY_FLOOR,
	STRETCH_VELOCITY_REFERENCE,
	VELOCITY_MIN_SPAN,
	VELOCITY_WINDOW,
	springFor
} from './motionTokens.js';

/**
 * Gesture behaviours for glass surfaces, built on Motion's vanilla gesture and
 * animation APIs.
 *
 * Every one of these returns a teardown, and every one is safe to attach to the
 * same element: they animate separate channels of a shared composed transform
 * (see `glassTransform.ts`), so hover, press and drag coexist rather than
 * fighting over `style.transform`.
 */

interface SharedOptions {
	/** Skip springs, inertia and deformation. Wire this to `reducedMotion.current`. */
	reduced?: boolean;
	/** Ignore the gesture entirely. */
	disabled?: boolean;
}

// ------------------------------------------------------------------ hover ---

export interface HoverOptions extends SharedOptions {
	/**
	 * Upward travel on hover, in CSS pixels. Defaults to {@link HOVER_LIFT}.
	 *
	 * Pass `0` for a surface that is mechanically constrained to one axis. A
	 * switch knob rides a groove and only ever travels on X; lifting it out of
	 * that groove contradicts the constraint the rest of the control spends its
	 * effort selling (end-of-travel overshoot, the droplet deforming as it
	 * slides). The swell and the specular boost still read as a response to the
	 * pointer — which is what the reference does: the knob grows, it does not
	 * levitate. A free-floating surface like a button has nothing to contradict,
	 * so it keeps the lift.
	 */
	lift?: number;
}

/**
 * Swell, lift and brighten on hover.
 *
 * Uses Motion's `hover` rather than raw `pointerenter`, because browsers
 * synthesise hover events from touches, which leaves surfaces stuck in the
 * hovered state after a tap. Motion filters those out.
 */
export function applyHover(element: HTMLElement, options: HoverOptions = {}): () => void {
	if (options.disabled) return () => {};

	const transform = acquireGlassTransform(element);
	const spring = () => springFor('soft', options.reduced ?? false);
	const lift = options.lift ?? HOVER_LIFT;

	const stop = hover(element, () => {
		transform.setActive(true);
		animate(transform.hoverScale, HOVER_SCALE, spring());
		animate(transform.lift, lift, spring());
		element.style.setProperty('--lg-specular-boost', String(HOVER_SPECULAR_BOOST));

		return () => {
			animate(transform.hoverScale, 1, spring());
			animate(transform.lift, 0, spring());
			element.style.setProperty('--lg-specular-boost', '0');
			transform.setActive(false);
		};
	});

	return () => {
		stop();
		element.style.removeProperty('--lg-specular-boost');
		transform.release();
	};
}

// ------------------------------------------------------------------ press ---

export type PressOptions = SharedOptions;

/**
 * Compress on press.
 *
 * Motion's `press` covers pointer *and* keyboard activation, so a button driven
 * with Space or Enter squashes exactly like a clicked one — which a bare
 * `pointerdown` listener would miss.
 */
export function applyPress(element: HTMLElement, options: PressOptions = {}): () => void {
	if (options.disabled) return () => {};

	const transform = acquireGlassTransform(element);
	const spring = () => springFor('snap', options.reduced ?? false);

	const stop = press(element, () => {
		transform.setActive(true);
		animate(transform.pressScale, PRESS_SCALE, spring());

		return () => {
			animate(transform.pressScale, 1, spring());
			transform.setActive(false);
		};
	});

	return () => {
		stop();
		transform.release();
	};
}

// ------------------------------------------------------- velocity stretch ---

/**
 * Deform along the axis of travel: stretch on it, compress across it.
 *
 * Bounded hard by {@link MAX_STRETCH}. The cap is the whole point — an
 * unbounded version of this reads as cartoon rubber rather than a dense object
 * with momentum.
 */
export function applyStretch(
	transform: GlassTransform,
	velocityX: number,
	velocityY: number,
	reduced: boolean
): void {
	const spring = springFor('settle', reduced);

	if (reduced) {
		animate(transform.stretchX, 1, spring);
		animate(transform.stretchY, 1, spring);
		return;
	}

	const speed = Math.hypot(velocityX, velocityY);
	if (speed < STRETCH_VELOCITY_FLOOR) {
		animate(transform.stretchX, 1, spring);
		animate(transform.stretchY, 1, spring);
		return;
	}

	// Normalise *then* scale. Clamping `speed / REFERENCE` against `MAX_STRETCH`
	// directly — which is what this used to do — makes the two constants multiply:
	// the deformation saturated at `MAX_STRETCH * REFERENCE`, i.e. 360px/s rather
	// than 3000. A leisurely drag sat pinned at the cap, and everything slower swept
	// the whole 0–12% range over a 300px/s spread, so an ordinary hand tremor
	// visibly resized the surface.
	const amount = MAX_STRETCH * Math.min(1, speed / STRETCH_VELOCITY_REFERENCE);
	const unitX = Math.abs(velocityX / speed);
	const unitY = Math.abs(velocityY / speed);

	animate(transform.stretchX, 1 + amount * unitX - amount * STRETCH_CROSS_RATIO * unitY, spring);
	animate(transform.stretchY, 1 + amount * unitY - amount * STRETCH_CROSS_RATIO * unitX, spring);
}

// ------------------------------------------------------------------- drag ---

export interface DragBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

export interface DragRelease {
	x: number;
	y: number;
	velocityX: number;
	velocityY: number;
	/**
	 * Straight-line distance travelled since the drag started, in CSS pixels.
	 *
	 * Measured on the *pointer*, not on the surface: a surface pushed against a bound
	 * stops moving while the finger keeps going, and measuring the surface would then
	 * report a deliberate 40px shove as a 2px one — which is how a tap-versus-drag
	 * test ends up calling it a tap.
	 */
	distance: number;
}

export interface DragOptions extends SharedOptions {
	axis?: 'x' | 'y' | 'both';
	/** Evaluated on every drag start, so it can follow a resized container. */
	bounds?: () => DragBounds | null;
	/**
	 * How far past `bounds` the pointer may drag the surface, in CSS pixels — an
	 * asymptote, not a limit that can be reached. `0` (the default) clamps hard.
	 *
	 * Only applies to pointer dragging: an arrow key stops at the bound, because
	 * there is no held gesture for the surface to spring back from.
	 */
	overshoot?: number;
	/** Scale applied while at rest. Set to 1 to disable the pick-up effect. */
	restScale?: number;
	/** Support arrow keys when the element has focus. */
	keyboard?: boolean;
	/**
	 * Choose the resting position on release. Return `null` to keep the default
	 * behaviour, which is to glide a little further along the release velocity.
	 *
	 * This is what turns a free drag into a detented one — a switch thumb snapping
	 * to whichever end it was thrown towards, for instance.
	 */
	snap?: (release: DragRelease) => { x: number; y: number } | null;
	onStart?: () => void;
	onMove?: (x: number, y: number) => void;
	onEnd?: (release: DragRelease) => void;
	/** Fired when a drag is abandoned with Escape, after the position is restored. */
	onCancel?: () => void;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Pointer, touch, stylus and keyboard dragging.
 *
 * `setPointerCapture` is essential here rather than optional: the element being
 * dragged is the element the pointer is over, so the pointer leaves it on
 * basically every movement. Without capture the drag would drop constantly.
 */
export function applyDrag(element: HTMLElement, options: DragOptions = {}): () => void {
	const {
		axis = 'both',
		bounds,
		overshoot = 0,
		restScale = DRAG_REST_SCALE,
		keyboard = true,
		reduced = false,
		disabled = false,
		snap,
		onStart,
		onMove,
		onEnd,
		onCancel
	} = options;

	if (disabled) return () => {};

	const transform = acquireGlassTransform(element);
	const allowX = axis !== 'y';
	const allowY = axis !== 'x';

	// The resting scale is a static state, not a gesture, so it is set directly on
	// the drag channel — `pressScale` belongs to `applyPress` and both may be
	// attached to the same element.
	transform.dragScale.set(restScale);

	let activePointer: number | null = null;
	let startPointerX = 0;
	let startPointerY = 0;
	let pointerX = 0;
	let pointerY = 0;
	let originX = 0;
	let originY = 0;
	let limits: DragBounds | null = null;

	/**
	 * Manual velocity tracking: the values are `set` during a drag, not animated,
	 * so `motionValue.getVelocity()` would report zero.
	 *
	 * Measured over a trailing window rather than between consecutive events — see
	 * {@link VELOCITY_WINDOW} for why the naive version makes a slowly dragged
	 * surface jump. Positions sampled here are the *surface's*, already clamped, so
	 * a surface held against a bound correctly reports no velocity.
	 */
	const samples: { x: number; y: number; time: number }[] = [];
	let velocityX = 0;
	let velocityY = 0;
	let lastStretchTime = 0;

	function sampleVelocity(x: number, y: number, time: number) {
		samples.push({ x, y, time });

		// Drop a sample only while the one behind it is still older than the window,
		// so exactly one sample survives on the far side of it. Pruning everything
		// older than the window instead would let the span collapse back to the gap
		// between the last two events — the very thing this exists to avoid.
		while (samples.length > 2 && time - samples[1].time >= VELOCITY_WINDOW) samples.shift();

		const oldest = samples[0];
		const elapsed = time - oldest.time;
		if (elapsed < VELOCITY_MIN_SPAN) return;

		velocityX = ((x - oldest.x) / elapsed) * 1000;
		velocityY = ((y - oldest.y) / elapsed) * 1000;
	}

	/**
	 * Exponential resistance past a bound: the finger's travel is unbounded, the
	 * surface's is not, and it approaches `overshoot` without ever arriving. See
	 * {@link DRAG_OVERSHOOT_DECAY}.
	 */
	function resist(value: number, min: number, max: number): number {
		if (overshoot <= 0) return clamp(value, min, max);
		if (value < min) return min - overshoot * (1 - Math.exp((value - min) / DRAG_OVERSHOOT_DECAY));
		if (value > max) return max + overshoot * (1 - Math.exp((max - value) / DRAG_OVERSHOOT_DECAY));
		return value;
	}

	function positionAt(x: number, y: number) {
		const nextX = limits ? resist(x, limits.minX, limits.maxX) : x;
		const nextY = limits ? resist(y, limits.minY, limits.maxY) : y;
		if (allowX) transform.x.set(nextX);
		if (allowY) transform.y.set(nextY);
		onMove?.(nextX, nextY);
		return { x: nextX, y: nextY };
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0 || activePointer !== null) return;

		activePointer = event.pointerId;
		element.setPointerCapture(event.pointerId);

		limits = bounds?.() ?? null;
		startPointerX = event.clientX;
		startPointerY = event.clientY;
		pointerX = event.clientX;
		pointerY = event.clientY;
		// A release glide or a keyboard step may still be running on these channels.
		// Motion keeps writing an animated value every frame, so it would spend the
		// whole tail of the spring fighting `positionAt` for the position — the
		// surface stuttering between the two, and the velocity sampler reading that
		// stutter as speed. Stopping leaves the value where it stands, which is
		// exactly the origin the drag should start from.
		transform.x.stop();
		transform.y.stop();

		originX = transform.x.get();
		originY = transform.y.get();
		samples.length = 0;
		samples.push({ x: originX, y: originY, time: event.timeStamp });
		lastStretchTime = event.timeStamp;
		velocityX = 0;
		velocityY = 0;

		window.addEventListener('keydown', onWindowKeyDown);
		transform.setActive(true);
		animate(transform.dragScale, DRAG_ACTIVE_SCALE, springFor('snap', reduced));
		onStart?.();
	}

	function onPointerMove(event: PointerEvent) {
		if (event.pointerId !== activePointer) return;

		pointerX = event.clientX;
		pointerY = event.clientY;

		const { x, y } = positionAt(
			originX + (event.clientX - startPointerX),
			originY + (event.clientY - startPointerY)
		);

		sampleVelocity(x, y, event.timeStamp);

		// At most one deformation update per frame: a 1000Hz mouse would otherwise
		// restart both stretch springs a thousand times a second for a result the
		// display cannot show.
		if (event.timeStamp - lastStretchTime >= VELOCITY_MIN_SPAN) {
			lastStretchTime = event.timeStamp;
			applyStretch(transform, velocityX, velocityY, reduced);
		}
	}

	function finish(restore: boolean, time: number) {
		if (activePointer === null) return;

		// Re-sample at the moment of release: a finger that stops dead and then lifts
		// emits no further move events, so the last *reading* would otherwise survive
		// the pause and glide the surface away from where it was let go.
		sampleVelocity(transform.x.get(), transform.y.get(), time);

		if (element.hasPointerCapture(activePointer)) {
			element.releasePointerCapture(activePointer);
		}
		activePointer = null;
		window.removeEventListener('keydown', onWindowKeyDown);

		const settle = springFor('settle', reduced);
		animate(transform.dragScale, restScale, springFor('snap', reduced));
		animate(transform.stretchX, 1, settle);
		animate(transform.stretchY, 1, settle);

		if (restore) {
			animate(transform.x, originX, settle);
			animate(transform.y, originY, settle);
			onMove?.(originX, originY);
			onCancel?.();
			transform.setActive(false);
			return;
		}

		const currentX = transform.x.get();
		const currentY = transform.y.get();
		const release: DragRelease = {
			x: currentX,
			y: currentY,
			velocityX: reduced ? 0 : velocityX,
			velocityY: reduced ? 0 : velocityY,
			distance: Math.hypot(pointerX - startPointerX, pointerY - startPointerY)
		};

		// A little glide on release. Projecting the velocity a few tens of
		// milliseconds ahead and letting the spring resolve it reads as inertia
		// without needing a separate decay animation. A `snap` handler overrides it.
		const snapped = snap?.(release) ?? null;
		const projectedX = snapped ? snapped.x : currentX + release.velocityX * DRAG_INERTIA_SECONDS;
		const projectedY = snapped ? snapped.y : currentY + release.velocityY * DRAG_INERTIA_SECONDS;
		const targetX = limits && !snapped ? clamp(projectedX, limits.minX, limits.maxX) : projectedX;
		const targetY = limits && !snapped ? clamp(projectedY, limits.minY, limits.maxY) : projectedY;

		if (allowX) animate(transform.x, targetX, settle);
		if (allowY) animate(transform.y, targetY, settle);
		onMove?.(targetX, targetY);
		onEnd?.({ ...release, x: targetX, y: targetY });

		transform.setActive(false);
	}

	function onPointerUp(event: PointerEvent) {
		if (event.pointerId !== activePointer) return;
		finish(false, event.timeStamp);
	}

	/**
	 * Escape is listened for on the window, not the element.
	 *
	 * A dragged surface is very often not focusable — a switch thumb inside a button,
	 * for instance — so the key event would never reach it. It is only bound while a
	 * drag is actually in flight, so it never competes with anything else.
	 */
	function onWindowKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || activePointer === null) return;
		event.preventDefault();
		finish(true, event.timeStamp);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (!keyboard) return;

		const step = event.shiftKey ? KEYBOARD_STEP_COARSE : KEYBOARD_STEP;
		let deltaX = 0;
		let deltaY = 0;

		if (event.key === 'ArrowLeft') deltaX = -step;
		else if (event.key === 'ArrowRight') deltaX = step;
		else if (event.key === 'ArrowUp') deltaY = -step;
		else if (event.key === 'ArrowDown') deltaY = step;
		else return;

		event.preventDefault();
		limits = bounds?.() ?? null;

		const settle = springFor('settle', reduced);
		const nextX = transform.x.get() + (allowX ? deltaX : 0);
		const nextY = transform.y.get() + (allowY ? deltaY : 0);
		const targetX = limits ? clamp(nextX, limits.minX, limits.maxX) : nextX;
		const targetY = limits ? clamp(nextY, limits.minY, limits.maxY) : nextY;

		if (allowX) animate(transform.x, targetX, settle);
		if (allowY) animate(transform.y, targetY, settle);
		onMove?.(targetX, targetY);
		onEnd?.({ x: targetX, y: targetY, velocityX: 0, velocityY: 0, distance: step });
	}

	element.addEventListener('pointerdown', onPointerDown);
	element.addEventListener('pointermove', onPointerMove);
	element.addEventListener('pointerup', onPointerUp);
	element.addEventListener('pointercancel', onPointerUp);
	element.addEventListener('keydown', onKeyDown);

	return () => {
		if (activePointer !== null && element.hasPointerCapture(activePointer)) {
			element.releasePointerCapture(activePointer);
		}
		window.removeEventListener('keydown', onWindowKeyDown);
		element.removeEventListener('pointerdown', onPointerDown);
		element.removeEventListener('pointermove', onPointerMove);
		element.removeEventListener('pointerup', onPointerUp);
		element.removeEventListener('pointercancel', onPointerUp);
		element.removeEventListener('keydown', onKeyDown);
		transform.release();
	};
}

// ------------------------------------------------------------ attachments ---

/** `{@attach hoverable(...)}` — see {@link applyHover}. */
export function hoverable(options: HoverOptions = {}): Attachment<HTMLElement> {
	return (element) => applyHover(element, options);
}

/** `{@attach pressable(...)}` — see {@link applyPress}. */
export function pressable(options: PressOptions = {}): Attachment<HTMLElement> {
	return (element) => applyPress(element, options);
}

/** `{@attach draggable(...)}` — see {@link applyDrag}. */
export function draggable(options: DragOptions = {}): Attachment<HTMLElement> {
	return (element) => applyDrag(element, options);
}

export { acquireGlassTransform };
export type { GlassTransform };
