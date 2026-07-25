import { animate, hover, press } from 'motion';
import type { Attachment } from 'svelte/attachments';
import { acquireGlassTransform, type GlassTransform } from './glassTransform.js';
import {
	DRAG_ACTIVE_SCALE,
	DRAG_INERTIA_SECONDS,
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

export type HoverOptions = SharedOptions;

/**
 * Lift and brighten on hover.
 *
 * Uses Motion's `hover` rather than raw `pointerenter`, because browsers
 * synthesise hover events from touches, which leaves surfaces stuck in the
 * hovered state after a tap. Motion filters those out.
 */
export function applyHover(element: HTMLElement, options: HoverOptions = {}): () => void {
	if (options.disabled) return () => {};

	const transform = acquireGlassTransform(element);
	const spring = () => springFor('soft', options.reduced ?? false);

	const stop = hover(element, () => {
		transform.setActive(true);
		animate(transform.hoverScale, HOVER_SCALE, spring());
		animate(transform.lift, HOVER_LIFT, spring());
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

	const amount = Math.min(MAX_STRETCH, speed / STRETCH_VELOCITY_REFERENCE);
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

export interface DragOptions extends SharedOptions {
	axis?: 'x' | 'y' | 'both';
	/** Evaluated on every drag start, so it can follow a resized container. */
	bounds?: () => DragBounds | null;
	/** Scale applied while at rest. Set to 1 to disable the pick-up effect. */
	restScale?: number;
	/** Support arrow keys when the element has focus. */
	keyboard?: boolean;
	onStart?: () => void;
	onMove?: (x: number, y: number) => void;
	onEnd?: (x: number, y: number) => void;
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
		restScale = DRAG_REST_SCALE,
		keyboard = true,
		reduced = false,
		disabled = false,
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
	let originX = 0;
	let originY = 0;
	let limits: DragBounds | null = null;

	/** Manual velocity tracking: the values are `set` during a drag, not animated,
	 *  so `motionValue.getVelocity()` would report zero. */
	let lastX = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocityX = 0;
	let velocityY = 0;

	function positionAt(x: number, y: number) {
		const nextX = limits ? clamp(x, limits.minX, limits.maxX) : x;
		const nextY = limits ? clamp(y, limits.minY, limits.maxY) : y;
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
		originX = transform.x.get();
		originY = transform.y.get();
		lastX = originX;
		lastY = originY;
		lastTime = event.timeStamp;
		velocityX = 0;
		velocityY = 0;

		transform.setActive(true);
		animate(transform.dragScale, DRAG_ACTIVE_SCALE, springFor('snap', reduced));
		onStart?.();
	}

	function onPointerMove(event: PointerEvent) {
		if (event.pointerId !== activePointer) return;

		const { x, y } = positionAt(
			originX + (event.clientX - startPointerX),
			originY + (event.clientY - startPointerY)
		);

		const elapsed = event.timeStamp - lastTime;
		if (elapsed > 0) {
			velocityX = ((x - lastX) / elapsed) * 1000;
			velocityY = ((y - lastY) / elapsed) * 1000;
			lastX = x;
			lastY = y;
			lastTime = event.timeStamp;
			applyStretch(transform, velocityX, velocityY, reduced);
		}
	}

	function finish(restore: boolean) {
		if (activePointer === null) return;

		if (element.hasPointerCapture(activePointer)) {
			element.releasePointerCapture(activePointer);
		}
		activePointer = null;

		const settle = springFor('settle', reduced);
		animate(transform.dragScale, restScale, springFor('snap', reduced));
		animate(transform.stretchX, 1, settle);
		animate(transform.stretchY, 1, settle);

		if (restore) {
			animate(transform.x, originX, settle);
			animate(transform.y, originY, settle);
			onMove?.(originX, originY);
			onCancel?.();
		} else if (reduced) {
			onEnd?.(transform.x.get(), transform.y.get());
		} else {
			// A little glide on release. Projecting the velocity a few tens of
			// milliseconds ahead and letting the spring resolve it reads as inertia
			// without needing a separate decay animation.
			const projectedX = transform.x.get() + velocityX * DRAG_INERTIA_SECONDS;
			const projectedY = transform.y.get() + velocityY * DRAG_INERTIA_SECONDS;
			const targetX = limits ? clamp(projectedX, limits.minX, limits.maxX) : projectedX;
			const targetY = limits ? clamp(projectedY, limits.minY, limits.maxY) : projectedY;
			if (allowX) animate(transform.x, targetX, settle);
			if (allowY) animate(transform.y, targetY, settle);
			onMove?.(targetX, targetY);
			onEnd?.(targetX, targetY);
		}

		transform.setActive(false);
	}

	function onPointerUp(event: PointerEvent) {
		if (event.pointerId !== activePointer) return;
		finish(false);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && activePointer !== null) {
			event.preventDefault();
			finish(true);
			return;
		}

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
		onEnd?.(targetX, targetY);
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
