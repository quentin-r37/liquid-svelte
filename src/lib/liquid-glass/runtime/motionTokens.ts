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
	/**
	 * A detented surface travelling between two stops: the switch thumb, and the
	 * segmented control's selection bubble. Deliberately under-damped (ζ ≈ 0.51) so
	 * the travel reads as elastic.
	 *
	 * Shared by the two on purpose rather than by coincidence. They are the same
	 * mechanism — a tile that is dragged, flicked or tapped between fixed positions
	 * and has to arrive with some give — and the tabs had their own near-critically
	 * damped spring, which is what made the bubble read as a rectangle being
	 * repositioned rather than as something with mass being thrown across a groove.
	 * One spring is also the only way the two controls stay in agreement as it is
	 * tuned.
	 */
	elastic: { type: 'spring', stiffness: 420, damping: 21, mass: 1 },
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
	 * A puddle spilling sideways — the first half of a menu opening, and the travel
	 * that carries a morphing panel to the middle of its own box.
	 *
	 * Damped at ζ ≈ 0.79, which overshoots its target by under 2%. That is the whole
	 * budget on this axis: liquid spreading into a shape settles *into* its edges, and
	 * a panel that balloons past its final width and springs back reads as rubber. The
	 * looser ζ ≈ 0.58 this started at overshot by 6% — 12px on a default panel, plainly
	 * visible, and visible underneath text that is fading in at the same moment.
	 *
	 * The stiffness is where the speed lives, and it is deliberately high: ζω₀ ≈ 20
	 * puts the width within a percent of final in about 230ms, against the ~310ms of
	 * the 360 this was. The reference opens a menu in roughly a third of a second
	 * *including* its sequencing, which leaves each individual axis less than that.
	 * Raising stiffness while holding ζ buys that without touching the shape of the
	 * motion — same overshoot, same settle, less of everyone's time.
	 */
	spread: { type: 'spring', stiffness: 640, damping: 40, mass: 1 },
	/**
	 * The same puddle filling out on its other axis. Heavier than
	 * {@link SPRINGS.spread}, and reaching its target later, on purpose: the two axes
	 * must not arrive together, or the whole thing collapses back into a uniform
	 * scale-up.
	 *
	 * Looser than `spread` — ζ ≈ 0.70 against 0.79, so ~4.5% overshoot against under 2%
	 * — because this is the axis that arrives last, and the give at the end of the
	 * sequence is the entire difference between liquid coming to rest and a box
	 * stopping. On a default panel it is a ten-pixel swell shared between the top and
	 * bottom edges (the morph scales about its centre), which is a cushion rather than
	 * a bounce: enough to feel soft, not enough to be seen as a rebound. Deliberately
	 * spent *here* rather than on the width, where the same 4.5% would push the panel's
	 * side out past the text settling onto it.
	 *
	 * Faster in absolute terms than the 240/24 it replaces (ζω₀ ≈ 14 against 11, so
	 * ~330ms to settle rather than ~420ms) while staying the slower of the two, which
	 * is what keeps the sequence legible at the new speed.
	 */
	rise: { type: 'spring', stiffness: 440, damping: 31, mass: 1.1 }
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
 * How far a stretch channel may sit from 1 and still count as undeformed.
 *
 * Only used to decide whether a drag that has stopped moving still has springs worth
 * running. Small enough to be sub-pixel on any surface this library is used at, and a
 * spring that has actually finished lands on 1 exactly, so it is never a floor the
 * deformation can get stuck above.
 */
export const STRETCH_REST_EPSILON = 0.001;

/**
 * Time constant, in milliseconds, of the exponential the deformation follows while a
 * drag is in flight. ~63% of the way to the target in this long.
 *
 * Deliberately not a spring. A spring restarted every frame re-seeds itself from its
 * own discrete velocity and diverges rather than settles — see the frame tick in
 * `applyDrag`. An exponential has no stored velocity to compound and cannot overshoot,
 * which is what is wanted of something re-aimed 120 times a second.
 *
 * Short, because the target it follows is already a velocity averaged over
 * {@link VELOCITY_WINDOW}: this is only there to take the corners off, and every
 * millisecond added here lands on top of that window's own lag. Release inertia reads
 * the raw velocity, so a flick still throws the surface exactly as far as before.
 */
export const STRETCH_SMOOTHING = 30;

/**
 * Trailing window, in milliseconds, over which drag velocity is measured.
 *
 * Not the gap between two consecutive readings, which is meaningless at low speed:
 * pointers report whole CSS pixels and a high-polling mouse fires every 1–2ms, so
 * a slow drag arrives as a burst of zero-delta events punctuated by a single 1px
 * one. Divided by that 1ms it reads as 1000px/s — enough to saturate
 * {@link MAX_STRETCH} — and the surface snaps 12% wider or taller for one frame
 * while the finger is barely moving, on whichever axis happened to tick.
 *
 * 50ms is roughly three frames: long enough that pixel quantisation averages out,
 * short enough that a flick still registers as one. The deformation it feeds is
 * spring-damped anyway, so the small lag it adds is not perceptible.
 *
 * It is also the time a stationary pointer takes to decay the reading to zero, since
 * the window is filled per frame regardless of movement — see `sampleFrame`.
 */
export const VELOCITY_WINDOW = 50;

/**
 * Shortest span, in milliseconds, that counts as a velocity reading.
 *
 * At the very start of a gesture the window has not filled yet, and the first two
 * samples are as untrustworthy as any other pair; below this the previous reading
 * is kept rather than a spike invented. One frame at 60Hz.
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
 * How long the morphing panel's *travel* has to itself before it starts expanding,
 * in seconds. Both scale channels wait this out; the rise then waits
 * {@link MENU_RISE_DELAY} again behind the spread.
 *
 * A morph opens from the middle of the box the menu is about to fill, and the surface
 * has to be seen going there. Started together, the translation is swallowed whole by
 * the scale — the box grows past its own travel within a frame or two and what is left
 * reads as a panel that simply appeared slightly off-centre.
 *
 * Three frames, which is the least that reads as a departure and the most that can be
 * spent on one: it is pure latency between the press and anything opening, and it lands
 * on top of {@link MENU_RISE_DELAY} for the axis that already waits. Held at 70ms
 * against the springs above it was a menu that acknowledged the press and *then*
 * opened; the two must overlap, which is the difference between one object moving and
 * two animations played in order.
 *
 * It is a *lead*, not a pause. The travel spring is running throughout; this only
 * says how much of it happens alone.
 */
export const MENU_MORPH_LEAD = 0.045;

/**
 * The pinch a morphing panel makes on its way out of the trigger, and how long it
 * takes to come back out of it.
 *
 * A menu is wider than the button that opened it, but rarely by much: a pill with a
 * word in it starts two thirds of the way to the panel's width, so the sideways spill
 * has almost no distance left to cover and the whole opening reads as purely vertical.
 * The height grows sixfold and the width by half, and the eye sees only the height.
 *
 * The gather is what gives the width something to do. The patch draws in on itself as
 * it leaves the trigger and then spills out of a shape narrow enough for the spill to
 * be seen — on a default panel, from a third of the final width rather than two thirds,
 * which is the difference between an expansion and a nudge. It is also the more liquid
 * of the two readings, since liquid gathers before it spreads, and it is textbook
 * anticipation: a movement backwards is what makes the movement forwards look intended.
 *
 * `scale` is a fraction of the *trigger's* width, not the panel's, so a wide trigger
 * and a narrow one pinch by the same proportion of themselves rather than one of them
 * being squeezed to a sliver.
 *
 * The pinch is not timed here — it takes exactly {@link MENU_MORPH_LEAD}, the window
 * the travel already has to itself, so the surface is at its narrowest at the precise
 * moment the spread begins. `release` is the other side of it, and it deliberately
 * outlasts the spread spring it composes with: the width is still coming out of the
 * pinch while the height is rising, which is what makes both axes look like they are
 * opening rather than one following the other.
 */
export const MENU_MORPH_GATHER = { scale: 0.45, release: 0.26 } as const;

/**
 * How much rounder than its settled corner an opening panel is allowed to be, as a
 * multiplier on the panel's own radius.
 *
 * This is the single thing that decides whether the reveal reads as liquid. A shape
 * scaled between two sizes keeps its corner in proportion, so a panel at half size is a
 * rectangle with a 22px corner — and a rectangle with a 22px corner is a *rectangle*.
 * It can grow; it cannot spread. Liquid has no such corner: its edge curvature is set
 * by how much of it there is, so a small volume is a lozenge, a larger one a blob, and
 * only a volume that has found its container takes the container's shape.
 *
 * So the corner is driven the other way round — as round as the current box allows
 * while the panel is small, easing to exactly the panel's radius as the reveal
 * completes. CSS's own clamp does the "as round as allows" half for free (a radius past
 * half the box is reduced to half the box, which is a pill), so this only says how long
 * to keep *asking* for more roundness than the panel has. At 3.2 the shape is a full
 * lozenge through the first half of the opening, a blob through the third quarter, and
 * square-shouldered only as it settles.
 *
 * Higher reads wetter and holds the blob longer, at the cost of the panel's own
 * silhouette arriving late — which matters, because the items are fading in over it.
 */
export const MENU_PUDDLE_ROUNDNESS = 3.2;

/**
 * The volume a spreading puddle has to put somewhere, as multipliers on the panel's
 * height, and when it does so, in seconds measured from the end of the lead.
 *
 * Liquid does not change how much of itself there is. It is the cue that separates
 * spreading from scaling, and it is entirely absent from a pair of independent springs:
 * ours widened and heightened as though the two had nothing to do with each other. So
 * the height answers what the width is doing. It `swell`s while the gather draws the
 * patch narrow — the same liquid in a thinner column has to go somewhere — and
 * `flatten`s as that column spills sideways, before coming back to square as the panel
 * rises into its own shape.
 *
 * `dip` is when the flattening bottoms out: after the spill starts and before the rise
 * does, so the sequence the eye is given is gather → spill flat → fill. `release` is how
 * long from the end of the lead back to square, and it outlives the spread deliberately,
 * so the recovery is the thing the rise is climbing out of rather than something that
 * finished before it began.
 *
 * Both figures are large for a deformation — velocity stretch is capped at 12% — because
 * this is not a surface reacting to being moved, it is the surface changing shape, and
 * where it bites the panel is a 38px-tall patch on which 16% is six pixels.
 */
export const MENU_MORPH_VOLUME = { swell: 1.1, flatten: 0.84, dip: 0.06, release: 0.3 } as const;

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

/**
 * The popover's opening and closing: the menu's puddle figures restated, per the
 * rule on {@link TOOLBAR_MORPH_LEAD} — same figures, not the same quantity. The
 * popover plays only the puddle-beside-the-trigger opening (no trigger morph:
 * a popover's trigger stays on screen, pointing at the panel it opened), so of
 * the menu's choreography it takes the spill, the rise, the roundness and the
 * monotone collapse, and nothing else.
 */
export const POPOVER_PUDDLE = { scaleX: 0.44, scaleY: 0.06 } as const;
export const POPOVER_RISE_DELAY = 0.05;
export const POPOVER_PUDDLE_ROUNDNESS = 3.2;
export const POPOVER_COLLAPSE = { duration: 0.17, ease: 'easeIn' } as const;

/**
 * The dialog's entrance: where the centered panel starts, as a scale and a
 * downward offset in CSS pixels.
 *
 * Deliberately *not* a puddle. A popover grows out of a trigger, so liquid
 * spilling from that point is the honest reading; a modal has no on-screen
 * origin — it is summoned, not poured — and iOS presents its alerts exactly
 * this way: nearly at size, arriving from slightly below, settled within a
 * quarter second. The scale is close enough to 1 that the corner-radius
 * distortion a transform inflicts (see LiquidMenu's radius compensation) stays
 * under a pixel, which is what lets the dialog skip that whole mechanism.
 */
export const DIALOG_ENTER = { scale: 0.94, y: 12 } as const;

/**
 * The dialog's exit — a duration, not a spring, for {@link MENU_COLLAPSE}'s
 * reason: the retreated state is hidden the instant it is reached, so an
 * overshoot has nothing to justify it and a spring's tail delays the hiding.
 */
export const DIALOG_COLLAPSE = { duration: 0.15, ease: 'easeIn' } as const;

/**
 * The sheet's exit, same argument. Longer than the dialog's because the travel
 * is the panel's whole height rather than a 6% scale step — the same 150ms over
 * several hundred pixels reads as the sheet being snatched off screen.
 */
export const SHEET_COLLAPSE = { duration: 0.24, ease: 'easeIn' } as const;

/**
 * How long a toolbar's *travel* has to itself before the bar starts unrolling, in
 * seconds.
 *
 * The same argument as {@link MENU_MORPH_LEAD} and the same three frames: the patch
 * that replaces the trigger has to be seen leaving the button's place for the centre
 * of the bar's box, and started together the scale swallows the translation whole.
 *
 * Kept identical rather than shared, because the two are not the same quantity — the
 * menu's lead is followed by {@link MENU_RISE_DELAY} on a second axis and this one is
 * not, so the menu could want a shorter lead than the toolbar the moment either is
 * retuned. That they agree today is a coincidence of both being "the least that reads
 * as a departure".
 */
export const TOOLBAR_MORPH_LEAD = 0.045;

/**
 * The pinch a toolbar makes on its way out of the trigger, as a fraction of the
 * collapsed patch's width, and how long it takes to come back out of it.
 *
 * Far shallower than {@link MENU_MORPH_GATHER}, and the reason is instructive: that
 * gather exists because a menu panel is barely wider than the button that opened it,
 * so the sideways spill had nothing to do and had to be *given* some distance. A
 * toolbar has the opposite problem. It grows from 38px to two or three hundred, so the
 * width already has more to cover than the eye can follow, and pinching to 0.45 of a
 * 38px patch would draw it down to a 17px slit — an object disappearing, not an object
 * gathering.
 *
 * So this is anticipation and nothing else: 5px of draw-in on a `md` trigger, which is
 * the smallest movement backwards that still makes the movement forwards look
 * intended. `release` outlasts the pinch itself for the same reason the menu's does —
 * the width is still coming out of it while the bar is extending, so the two read as
 * one continuous release rather than as a squash followed by a stretch.
 */
export const TOOLBAR_MORPH_GATHER = { scale: 0.86, release: 0.24 } as const;

/**
 * The volume a toolbar displaces as it extends, as multipliers on the shell's height,
 * timed in seconds from the end of the lead.
 *
 * Structurally identical to {@link MENU_MORPH_VOLUME} and driven by the same physical
 * claim — liquid does not change how much of itself there is, so the axis that is not
 * spreading has to answer for the axis that is. It `swell`s while the gather draws the
 * patch narrow, `flatten`s as that column shoots sideways, and comes back to square as
 * the bar settles.
 *
 * The magnitudes are half the menu's because the geometry gives them ten times the
 * leverage. A menu grows sixfold on the axis that carries its volume cue; a toolbar
 * does not grow on that axis *at all* — the height is constant by construction, so
 * every percent here is a percent of the final bar rather than a percent of a 38px
 * patch on its way to 230. At 1.12/0.90 that is a 4px swell and a 4px flatten on a
 * `md` bar: a surface that visibly breathes as it extends, where the menu's 1.1/0.84
 * would be a bar that wobbles.
 */
export const TOOLBAR_MORPH_VOLUME = {
	swell: 1.12,
	flatten: 0.9,
	dip: 0.06,
	release: 0.28
} as const;

/**
 * Fraction of the unroll each item spends fading in.
 *
 * The stagger itself is not timed — it is *geometric*. Every item knows the width the
 * bar has to reach before there is room for it (see the component's `measureItems`),
 * expressed as a fraction of the total extension, and its reveal ramps over this much
 * of the unroll starting from there. So the items are lit by the leading edge passing
 * over them at whatever speed the spring actually runs, and there is no per-item delay
 * constant to fall out of step with the spread when either is retuned.
 *
 * It also means the collapse gets its reverse stagger for free: the unroll runs
 * backwards, so the last item in is the first out, which is what a bar retracting into
 * a button has to look like.
 *
 * The ramp *starts* at the threshold rather than ending there, and that is what keeps
 * the first item from being visible on the frame the trigger is swapped away. On a
 * `md` bar the collapsed patch is 38px wide and the first well needs 34 — it genuinely
 * fits, so a ramp that ended at the threshold would have it already lit at rest, and
 * the swap would read as one glyph replacing another rather than as a bar starting to
 * unroll. Each threshold is scaled by `1 − fade` so the last item still finishes
 * exactly as the bar settles.
 */
export const TOOLBAR_ITEM_FADE = 0.22;

/**
 * How small an item is drawn before its reveal starts, as a scale.
 *
 * The wells ride a counter-scale that holds them at their settled size and position
 * throughout the unroll (see the component), so without this they would simply
 * cross-fade in place — correct, and inert. Scaling them up as they light is the
 * whole difference between a bar that unrolls and a bar that appears with its
 * contents already in it.
 *
 * Not zero: an icon that grows from nothing draws attention to its own arrival, and
 * there are up to six of them arriving in a fifth of a second.
 */
export const TOOLBAR_ITEM_RISE = 0.55;

/**
 * The retraction, on both axes at once.
 *
 * A duration rather than a spring, for exactly the reasons set out on
 * {@link MENU_COLLAPSE} — the collapsed patch is not a state anything rests in, it is
 * hidden the instant it is reached, so an overshoot has nothing to justify it and a
 * spring's tail delays the hiding.
 *
 * Shorter than the menu's 170ms because there is less to undo: one axis, no rise, no
 * sequencing. The whole opening is a lead plus a spread, and an exit should not take
 * longer than the entrance it is reversing.
 */
export const TOOLBAR_COLLAPSE = { duration: 0.15, ease: 'easeIn' } as const;

/**
 * The search field's morph — a circular trigger unrolling into the capsule field —
 * is the toolbar's class of movement exactly: constant height by the same
 * `BUTTON_CIRCLE_SIZES` law, one axis of scale, a circular `LiquidButton` standing
 * where the collapsed patch will be.
 *
 * The constants are nonetheless restated rather than imported, per the rule stated
 * on {@link TOOLBAR_MORPH_LEAD}: they are the same *figures*, not the same
 * *quantity*. A field could plausibly want a softer landing than an action bar —
 * its settling is what the placeholder fades in over — and the moment either is
 * retuned the sharing would have been a bug. That they agree today is both of them
 * being the toolbar's answer to the same geometry.
 *
 * The gather is the shallow one, for the toolbar's reason restated: the field
 * grows from ~38px to a few hundred, so the width has more travel than the eye can
 * follow and the pinch is pure anticipation — a deep menu-style gather would draw
 * the patch down to a slit. The volume figures are the toolbar's for the same
 * leverage argument: the height never grows, so every percent is a percent of the
 * final bar.
 */
export const SEARCH_MORPH_LEAD = 0.045;
export const SEARCH_MORPH_GATHER = { scale: 0.86, release: 0.24 } as const;
export const SEARCH_MORPH_VOLUME = {
	swell: 1.12,
	flatten: 0.9,
	dip: 0.06,
	release: 0.28
} as const;

/**
 * The field's retraction: a duration, not a spring, for {@link MENU_COLLAPSE}'s
 * reason — the collapsed patch is hidden the instant it is reached, so an
 * overshoot has nothing to justify it and a spring's tail delays the hiding.
 * The toolbar's figure, because it is the same one-axis exit.
 */
export const SEARCH_COLLAPSE = { duration: 0.15, ease: 'easeIn' } as const;

/** Arrow-key step for keyboard-driven dragging, in CSS pixels. */
export const KEYBOARD_STEP = 12;
/** Larger step when Shift is held. */
export const KEYBOARD_STEP_COARSE = 48;
