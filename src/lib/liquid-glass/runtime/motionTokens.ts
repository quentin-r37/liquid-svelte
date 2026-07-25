/**
 * Named spring presets and interaction constants.
 *
 * All springs are expressed with Motion's physical parameters (`stiffness`,
 * `damping`, `mass`) rather than durations, so a gesture interrupted mid-flight
 * carries its velocity into the next animation instead of restarting.
 *
 * The numbers are in the same range as the reference implementation
 * (stiffness 400, damping 25–30), which is considerably stiffer than Motion's
 * own defaults of 100/10 — glass should feel dense and settle fast, not wobble.
 */
export const SPRINGS = {
	/** Button press and release. Fast, no visible overshoot. */
	snap: { type: 'spring', stiffness: 620, damping: 34, mass: 1 },
	/** Hover lift and other low-stakes decoration. */
	soft: { type: 'spring', stiffness: 280, damping: 26, mass: 1 },
	/** Switch thumb. Deliberately under-damped so the travel reads as elastic. */
	elastic: { type: 'spring', stiffness: 420, damping: 21, mass: 1 },
	/** Tab bubble sliding between segments. Quick, barely any overshoot. */
	bubble: { type: 'spring', stiffness: 440, damping: 34, mass: 1 },
	/** Returning to rest after a drag, and velocity-driven deformation decay. */
	settle: { type: 'spring', stiffness: 400, damping: 30, mass: 1 },
	/** Slider thumb tracking its value. Stiff enough to feel directly connected. */
	track: { type: 'spring', stiffness: 900, damping: 46, mass: 1 },
	/**
	 * A knob melting into a droplet. Softer and slightly wobbly, so the surface
	 * appears to liquefy rather than snap between two states.
	 */
	droplet: { type: 'spring', stiffness: 300, damping: 20, mass: 1 },
	/**
	 * A puddle spilling sideways — the first half of a menu opening. Loose enough to
	 * overshoot slightly, which is what reads as liquid finding its edges rather than
	 * a box being scaled up.
	 */
	spread: { type: 'spring', stiffness: 360, damping: 22, mass: 1 },
	/**
	 * The same puddle filling out on its other axis. Softer and heavier than
	 * {@link SPRINGS.spread} on purpose: the two axes must not arrive together, or the
	 * whole thing collapses back into a uniform scale-up.
	 */
	rise: { type: 'spring', stiffness: 240, damping: 19, mass: 1.1 }
} as const;

export type SpringName = keyof typeof SPRINGS;

/**
 * Substitute used when `prefers-reduced-motion: reduce` is set. Functionally
 * instant — state changes stay immediately legible, with no spring, no overshoot
 * and no inertia.
 */
export const REDUCED_MOTION_TRANSITION = { duration: 0.001, ease: 'linear' } as const;

/**
 * Deliberately inferred rather than annotated as Motion's `AnimationOptions`.
 * Every animation in this library targets a *motion value*, whose overload takes
 * `ValueAnimationTransition` — a narrower type that `AnimationOptions` is not
 * assignable to, and which Motion does not re-export from its root entry point.
 * Letting inference keep the literal shapes satisfies both.
 */
export type GlassTransition = (typeof SPRINGS)[SpringName] | typeof REDUCED_MOTION_TRANSITION;

export function springFor(name: SpringName, reduced: boolean): GlassTransition {
	return reduced ? REDUCED_MOTION_TRANSITION : SPRINGS[name];
}

/** Scale on hover. Small — glass is heavy, it should not balloon. */
export const HOVER_SCALE = 1.025;
/** Upward travel on hover, in CSS pixels. */
export const HOVER_LIFT = -2;
/** Extra specular boost while hovered, added to `--lg-specular`. */
export const HOVER_SPECULAR_BOOST = 0.25;

/** Scale while pressed. */
export const PRESS_SCALE = 0.955;

/** Scale of a draggable surface at rest, before it is picked up. */
export const DRAG_REST_SCALE = 0.92;
/** Scale while being dragged. */
export const DRAG_ACTIVE_SCALE = 1;

/**
 * Hard ceiling on velocity-driven deformation, as a fraction. 0.12 means a
 * maximum of ±12% on the axis of travel; the reference caps at 0.15. Any higher
 * and the glass stops reading as a dense object and starts looking like rubber.
 */
export const MAX_STRETCH = 0.12;

/** Pointer speed in px/s that saturates the stretch at {@link MAX_STRETCH}. */
export const STRETCH_VELOCITY_REFERENCE = 3000;

/** Perpendicular compression, as a fraction of the along-axis stretch. */
export const STRETCH_CROSS_RATIO = 0.5;

/** Below this speed (px/s) no deformation is applied at all, to avoid jitter. */
export const STRETCH_VELOCITY_FLOOR = 50;

/**
 * How much release velocity carries into the settle spring, in seconds of
 * projected travel. Kept low: glass should glide a little, not skate.
 */
export const DRAG_INERTIA_SECONDS = 0.06;

/**
 * Finger travel, in CSS pixels, over which resistance past a drag bound reaches
 * ~63% of the allowed overshoot.
 *
 * A hard clamp at a bound reads as a dropped gesture — the finger keeps moving and
 * the surface stops dead — while a linear fraction never stops at all. An
 * exponential gives immediately, then refuses: pull 36px past the end and the
 * surface has already spent most of the give it will ever offer. Deliberately
 * short; the point is to show the bound is real, not to make it stretchy.
 */
export const DRAG_OVERSHOOT_DECAY = 36;

/**
 * The shape a menu panel is collapsed into when closed, as scale multipliers on
 * the `revealX` / `revealY` channels.
 *
 * Wide and almost perfectly flat — a puddle, not a dot. Collapsing to a uniform
 * small square and scaling up is the generic "popover zoom" every UI kit ships;
 * starting from something that is already spread on one axis is what makes the
 * opening read as liquid spilling out of the trigger and then rising.
 *
 * Not zero on either axis: `scale(0)` collapses the element to nothing, and a
 * `backdrop-filter` on a zero-area box has no backdrop to sample, so the first
 * frames of the spread would have no refraction to grow out of.
 */
export const MENU_PUDDLE = { scaleX: 0.44, scaleY: 0.06 } as const;

/**
 * How long the vertical rise waits behind the horizontal spill, in seconds.
 *
 * The entire effect lives in this offset. Two springs of different stiffness
 * starting together still look like one scale; 50ms of lag is enough for the eye
 * to read a sequence — spill, then rise — without the panel feeling slow.
 */
export const MENU_RISE_DELAY = 0.05;

/** Arrow-key step for keyboard-driven dragging, in CSS pixels. */
export const KEYBOARD_STEP = 12;
/** Larger step when Shift is held. */
export const KEYBOARD_STEP_COARSE = 48;
