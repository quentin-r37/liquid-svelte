/**
 * Signed distance field for a superelliptical rounded rectangle, plus its
 * analytic gradient.
 *
 * The outline mirrors CSS exactly rather than approximating it: at `exponent = 2`
 * it is the quarter-ellipse of plain `border-radius`, and at `exponent = 4` it is
 * the squircle of `corner-shape: squircle`. That correspondence is the whole point
 * — the displacement map lines up with the element's own rounded clip to the pixel,
 * so there is never a seam between the refracted backdrop and the glass silhouette.
 * `cornerShape.ts` is what keeps the exponent and the CSS token in agreement.
 *
 * Note that the corner *outline* and the bezel *height profile* are two unrelated
 * axes, and both have a squircle in them. This file shapes the silhouette;
 * `surfaceProfiles.ts` shapes the surface inside the bezel, and the quartic
 * squircle there is the default regardless of what the corner does.
 */

export interface EdgeSample {
	/** Distance inwards from the outline. Negative outside the shape. */
	depth: number;
	/** Outward unit normal at the nearest point on the outline. */
	normalX: number;
	normalY: number;
}

/**
 * Sample the field at `(x, y)`, expressed relative to the shape's centre.
 *
 * `q` measures how far the point is past the inner rectangle whose corners are the
 * arc centres. Both components positive means we are in a corner quadrant;
 * otherwise the outline is straight there and the dominant component picks the
 * flat side.
 *
 * `exponent` is `n` in `|x|ⁿ + |y|ⁿ = rⁿ` — CSS's `2K`. It defaults to 2, which is
 * the circular corner and the only path that existed before `corner-shape` did.
 */
export function sampleRoundedBox(
	x: number,
	y: number,
	halfWidth: number,
	halfHeight: number,
	radius: number,
	exponent = 2
): EdgeSample {
	const r = Math.min(radius, halfWidth, halfHeight);
	const qx = Math.abs(x) - (halfWidth - r);
	const qy = Math.abs(y) - (halfHeight - r);

	// Sides and interior. The outline is straight along both whatever the corner
	// does, so this path is exponent-independent — and it is the overwhelming
	// majority of pixels on any surface that is not a circle, which is why the
	// `Math.pow` work below stays affordable. `max(qx, qy) - r` covers "outside one
	// edge" and "inside the box" in a single expression.
	if (qx <= 0 || qy <= 0) {
		const alongX = qx > qy;
		return {
			depth: r - Math.max(qx, qy),
			normalX: alongX ? Math.sign(x || 1) : 0,
			normalY: alongX ? 0 : Math.sign(y || 1)
		};
	}

	// Corner quadrant. Everything is expressed relative to the larger component, so
	// `Math.pow` operates on numbers around 1 instead of on a radius raised to the
	// sixth power.
	const major = Math.max(qx, qy);
	const t = Math.min(qx, qy) / major;

	// `shape` is the p-norm in units of `major`, so `major × shape` is the norm
	// itself and `major × shape = r` is exactly the outline. `slope` is the minor
	// component of the unnormalised gradient `(qxⁿ⁻¹, qyⁿ⁻¹)`, likewise relative.
	const isCircular = exponent === 2;
	const shape = isCircular ? Math.hypot(1, t) : (1 + t ** exponent) ** (1 / exponent);
	const slope = isCircular ? t : t ** (exponent - 1);
	const gradient = Math.hypot(1, slope);

	/*
	 * A p-norm is not a distance for n ≠ 2: it grows at `|∇f|` per unit of real
	 * length, and on a quartic corner's diagonal `|∇f|` is only 2^(-1/4) ≈ 0.84.
	 * Uncorrected, the bezel would measure ~19% deeper at the 45° point of every
	 * corner than along the flats, and the refracting band would visibly fatten
	 * into the corners — the giveaway that a squircle was faked by swapping an
	 * exponent.
	 *
	 * Dividing by `|∇f| = gradient / shapeⁿ⁻¹` is the standard first-order fix. It
	 * leaves the zero level set untouched (the outline is exact either way) and
	 * collapses to a no-op at n = 2, so `round` still rasterises byte for byte what
	 * it did before this parameter existed.
	 */
	const correction = isCircular ? 1 : shape ** (exponent - 1) / gradient;
	const signedDistance = (major * shape - r) * correction;

	// The normal is the unit gradient, mapped back out of the major/minor frame.
	const majorAxis = 1 / gradient;
	const minorAxis = slope / gradient;
	const alongX = qx >= qy;

	return {
		depth: -signedDistance,
		normalX: (alongX ? majorAxis : minorAxis) * Math.sign(x || 1),
		normalY: (alongX ? minorAxis : majorAxis) * Math.sign(y || 1)
	};
}
