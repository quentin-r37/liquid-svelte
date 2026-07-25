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
	/**
	 * Positional offset, in CSS pixels — a drag's, and also the travel of a surface
	 * that opens from somewhere other than where it rests (`LiquidMenu`'s panel
	 * starts on top of its trigger and glides off it).
	 */
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
	 * Entrance and exit deformation, per axis, as multipliers around 1.
	 *
	 * Separate from the gesture channels because it is not a gesture: a surface that
	 * spreads open on one axis before the other (see `LiquidMenu`) has to drive the
	 * two independently, and it must be able to do so *while* hover or press are
	 * live without either side clobbering the other.
	 *
	 * Two channels rather than reusing `stretchX`/`stretchY`, which belong to
	 * `applyStretch` — a surface that both reveals itself and reacts to velocity
	 * would otherwise have one animation cancel the other mid-flight.
	 */
	revealX: MotionValue<number>;
	revealY: MotionValue<number>;
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

/**
 * Round a translation onto the device-pixel grid.
 *
 * `backdrop-filter` is what forces this. Chromium captures the backdrop over a
 * region snapped to whole device pixels, so while a surface's translation carries
 * a fractional part, that part drifts across the rounding boundary as the surface
 * moves — one axis at a time — and the captured backdrop shifts a pixel under a
 * displacement map that did not move. At the rim the map's gradient is savage (the
 * profile LUT falls from 1.0 to 0.47 within a tenth of the bezel), so one pixel of
 * misalignment there moves the refracted edge by dozens: the edge visibly jumps
 * and the surface reads as having suddenly grown taller or wider.
 *
 * It only shows up when moving *slowly*. A fast drag crosses several boundaries
 * per frame and they average into the motion; a slow one delivers them one at a
 * time, on whichever axis crossed first. It also needs a fractional pointer
 * position to begin with, which is why it appears on a scaled Windows display and
 * not under keyboard stepping, where every position is a whole number of pixels.
 *
 * Landing on the grid costs nothing perceptible — a device pixel is the finest
 * thing the display can resolve, and the sub-pixel remainder was only ever being
 * antialiased away. It does not need the element's *layout* position to be on the
 * grid either: a constant misalignment is invisible, it is the changing one that
 * is seen.
 */
function snapToDevicePixel(value: number): number {
	const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
	return Math.round(value * ratio) / ratio;
}

function createEntry(element: HTMLElement): Entry {
	const x = motionValue(0);
	const y = motionValue(0);
	const lift = motionValue(0);
	const hoverScale = motionValue(1);
	const pressScale = motionValue(1);
	const dragScale = motionValue(1);
	const stretchX = motionValue(1);
	const stretchY = motionValue(1);
	const revealX = motionValue(1);
	const revealY = motionValue(1);

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
		const sx = scaleBase * stretchX.get() * revealX.get();
		const sy = scaleBase * stretchY.get() * revealY.get();
		const tx = snapToDevicePixel(x.get());
		const ty = snapToDevicePixel(y.get() + lift.get());
		return `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
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
			revealX,
			revealY,

			setActive(active) {
				entry.activeCount = Math.max(0, entry.activeCount + (active ? 1 : -1));
				element.style.willChange = entry.activeCount > 0 ? 'transform' : '';
			},

			release() {
				entry.holders -= 1;
				if (entry.holders > 0) return;

				entry.stopEffect();
				for (const value of [
					x,
					y,
					lift,
					hoverScale,
					pressScale,
					dragScale,
					stretchX,
					stretchY,
					revealX,
					revealY
				]) {
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
