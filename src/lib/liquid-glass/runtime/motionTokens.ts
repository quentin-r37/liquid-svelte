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
	 * A puddle spilling sideways — the first half of a menu opening.
	 *
	 * Damped at ζ ≈ 0.79, which overshoots its target by under 2%. That is the whole
	 * budget: liquid spreading into a shape settles *into* its edges, and a panel that
	 * balloons past its final width and springs back reads as rubber. The looser
	 * ζ ≈ 0.58 this started at overshot by 6% — 12px on a default panel, plainly
	 * visible, and visible underneath text that is fading in at the same moment.
	 */
	spread: { type: 'spring', stiffness: 360, damping: 30, mass: 1 },
	/**
	 * The same puddle filling out on its other axis. Softer and heavier than
	 * {@link SPRINGS.spread} on purpose: the two axes must not arrive together, or the
	 * whole thing collapses back into a uniform scale-up.
	 *
	 * Left slightly looser than `spread` (ζ ≈ 0.74, ~3% overshoot) because this is the
	 * axis that arrives last, and a single small settle at the end of the sequence is
	 * what reads as liquid coming to rest rather than a box stopping.
	 */
	rise: { type: 'spring', stiffness: 240, damping: 24, mass: 1.1 }
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

/**
 * Pointer speed in px/s that saturates the stretch at {@link MAX_STRETCH}.
 *
 * A flick, not a drag. Speed maps onto the deformation linearly between the floor
 * and this, so a deliberate 500px/s reposition deforms by a sixth of the cap and a
 * thrown surface gets all of it. That gap is the point: the deformation has to be
 * something the surface does when *moved fast*, not the shape it holds while being
 * placed — a surface that stays stretched the whole time it is being dragged just
 * reads as the wrong size.
 */
export const STRETCH_VELOCITY_REFERENCE = 3000;

/** Perpendicular compression, as a fraction of the along-axis stretch. */
export const STRETCH_CROSS_RATIO = 0.5;

/** Below this speed (px/s) no deformation is applied at all, to avoid jitter. */
export const STRETCH_VELOCITY_FLOOR = 50;

/**
 * Trailing window, in milliseconds, over which pointer velocity is measured.
 *
 * Not the gap between two consecutive events, which is meaningless at low speed:
 * pointers report whole CSS pixels and a high-polling mouse fires every 1–2ms, so
 * a slow drag arrives as a burst of zero-delta events punctuated by a single 1px
 * one. Divided by that 1ms it reads as 1000px/s — enough to saturate
 * {@link MAX_STRETCH} — and the surface snaps 12% wider or taller for one frame
 * while the finger is barely moving, on whichever axis happened to tick.
 *
 * 50ms is roughly three frames: long enough that pixel quantisation averages out,
 * short enough that a flick still registers as one. The deformation it feeds is
 * spring-damped anyway, so the small lag it adds is not perceptible.
 */
export const VELOCITY_WINDOW = 50;

/**
 * Shortest span, in milliseconds, that counts as a velocity reading — and the
 * minimum interval between deformation updates.
 *
 * At the very start of a gesture the window has not filled yet, and the first two
 * samples are as untrustworthy as any other pair; below this the previous reading
 * is kept rather than a spike invented. One frame at 60Hz, which doubles as the
 * throttle: pointers fire several times faster than the display refreshes, and
 * every update restarts two springs.
 */
export const VELOCITY_MIN_SPAN = 16;

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

/**
 * The collapse, on both axes at once. The one animation in this library that is not
 * a spring, deliberately.
 *
 * A spring approaches a *resting state* with momentum, and every spring here is
 * under-damped enough to overshoot a little. That is right for anything that stays
 * on screen and wrong for a dismissal: the collapsed puddle is not a state anything
 * rests in, it is hidden the instant it is reached, so an overshoot has nothing to
 * justify it. Left as `snap` it undershot the target by 5% of the travel — the panel
 * shrank to a sliver, visibly bounced *on* that sliver, and only then disappeared,
 * because the panel cannot be hidden until the spring finishes settling and a spring's
 * tail is long.
 *
 * A duration is provably monotone and provably over, which is exactly what is wanted
 * of an exit. `easeIn` puts the fastest part at the end, so the last few frames — the
 * smallest, least explicable ones — are the ones the eye has least time to catch.
 */
export const MENU_COLLAPSE = { duration: 0.17, ease: 'easeIn' } as const;

/** Arrow-key step for keyboard-driven dragging, in CSS pixels. */
export const KEYBOARD_STEP = 12;
/** Larger step when Shift is held. */
export const KEYBOARD_STEP_COARSE = 48;
