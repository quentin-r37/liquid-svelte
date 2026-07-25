import { motionValue, styleEffect, transformValue, type MotionValue } from 'motion';

/**
 * The single owner of an element's `transform`, shared by every gesture.
 *
 * Hover, press and drag all want to move and scale the same element. If each one
 * wrote `element.style.transform` the last writer would win and the others would
 * be silently discarded. So each gesture instead animates its own *channel*, and
 * one `transformValue` composes them into a single string that `styleEffect`
 * flushes once per frame.
 *
 * `styleEffect` is Motion's own renderer: it batches into the frame loop, so N
 * animated surfaces produce one style-write pass per frame rather than N.
 *
 * Channels are reference-counted per element, so a component can wire up hover
 * and press independently and still share one composed transform.
 */

export interface GlassTransform {
	/** Drag offset, in CSS pixels. */
	x: MotionValue<number>;
	y: MotionValue<number>;
	/** Hover elevation, in CSS pixels. Added to `y`. */
	lift: MotionValue<number>;
	/**
	 * Multiplicative scale channels — composed, so gestures never clobber each
	 * other. One channel per gesture is the whole reason this module exists.
	 */
	hoverScale: MotionValue<number>;
	pressScale: MotionValue<number>;
	dragScale: MotionValue<number>;
	/** Velocity-driven deformation, as multipliers around 1. */
	stretchX: MotionValue<number>;
	stretchY: MotionValue<number>;
	/**
	 * Mark an interaction as in flight. `will-change: transform` is only set while
	 * at least one gesture is active; leaving it on permanently keeps a
	 * compositor layer alive for every glass surface on the page.
	 *
	 * Safe for the refraction only because the element being transformed is the
	 * element carrying the `backdrop-filter`. Chromium drops the effect when a
	 * transform sits on an *ancestor* of it (crbug 1194050) — which is why the
	 * refraction is not a child layer. See the header of liquidGlass.css.
	 */
	setActive(active: boolean): void;
	/** Drop this holder's reference. The channels are torn down at zero. */
	release(): void;
}

interface Entry {
	transform: GlassTransform;
	holders: number;
	activeCount: number;
	stopEffect: () => void;
}

const entries = new WeakMap<HTMLElement, Entry>();

function createEntry(element: HTMLElement): Entry {
	const x = motionValue(0);
	const y = motionValue(0);
	const lift = motionValue(0);
	const hoverScale = motionValue(1);
	const pressScale = motionValue(1);
	const dragScale = motionValue(1);
	const stretchX = motionValue(1);
	const stretchY = motionValue(1);

	// Every channel must be read on the first invocation — that is how
	// `transformValue` discovers what to subscribe to.
	//
	// Deliberately 2-D. `translate3d(…, 0)` would promote a compositor layer for
	// every glass surface permanently, which is the exact thing `setActive` exists
	// to avoid, and a 3-D transform is the shakier of the two footings to stand a
	// `backdrop-filter` on in Chromium. Promotion is `will-change`'s job, for the
	// duration of a gesture only.
	const composed = transformValue(() => {
		const scaleBase = hoverScale.get() * pressScale.get() * dragScale.get();
		const sx = scaleBase * stretchX.get();
		const sy = scaleBase * stretchY.get();
		return `translate(${x.get()}px, ${y.get() + lift.get()}px) scale(${sx}, ${sy})`;
	});

	const stopEffect = styleEffect(element, { transform: composed });

	const entry: Entry = {
		holders: 0,
		activeCount: 0,
		stopEffect,
		transform: {
			x,
			y,
			lift,
			hoverScale,
			pressScale,
			dragScale,
			stretchX,
			stretchY,

			setActive(active) {
				entry.activeCount = Math.max(0, entry.activeCount + (active ? 1 : -1));
				element.style.willChange = entry.activeCount > 0 ? 'transform' : '';
			},

			release() {
				entry.holders -= 1;
				if (entry.holders > 0) return;

				entry.stopEffect();
				for (const value of [x, y, lift, hoverScale, pressScale, dragScale, stretchX, stretchY]) {
					value.stop();
					value.destroy();
				}
				element.style.willChange = '';
				element.style.transform = '';
				entries.delete(element);
			}
		}
	};

	return entry;
}

/** Acquire the element's transform channels, creating them on first use. */
export function acquireGlassTransform(element: HTMLElement): GlassTransform {
	let entry = entries.get(element);
	if (!entry) {
		entry = createEntry(element);
		entries.set(element, entry);
	}
	entry.holders += 1;
	return entry.transform;
}
