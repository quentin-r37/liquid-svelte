/**
 * Signed distance field for a rounded rectangle, plus its analytic gradient.
 *
 * The shape deliberately mirrors CSS `border-radius` exactly rather than
 * approximating a true superellipse: the displacement map then lines up with
 * the element's own rounded clip to the pixel, so there is never a seam between
 * the refracted backdrop and the glass silhouette. The *squircle* character of
 * the effect comes from the height profile applied inside the bezel
 * (see `surfaceProfiles.ts`), not from the outline.
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
 * Sides, corners and any width/height/radius combination are handled by the
 * same expression: `q` measures how far the point is past the inner rectangle
 * whose corners are the arc centres. Both components positive means we are in a
 * corner quadrant (radial normal); otherwise the dominant component picks the
 * flat side (axis-aligned normal).
 */
export function sampleRoundedBox(
	x: number,
	y: number,
	halfWidth: number,
	halfHeight: number,
	radius: number
): EdgeSample {
	const r = Math.min(radius, halfWidth, halfHeight);
	const qx = Math.abs(x) - (halfWidth - r);
	const qy = Math.abs(y) - (halfHeight - r);

	const outsideX = Math.max(qx, 0);
	const outsideY = Math.max(qy, 0);
	const outsideLength = Math.hypot(outsideX, outsideY);
	const signedDistance = Math.min(Math.max(qx, qy), 0) + outsideLength - r;

	let normalX: number;
	let normalY: number;

	if (qx > 0 && qy > 0) {
		// Corner quadrant: the normal is radial from the arc centre.
		if (outsideLength > 0) {
			normalX = (outsideX / outsideLength) * Math.sign(x || 1);
			normalY = (outsideY / outsideLength) * Math.sign(y || 1);
		} else {
			normalX = 0;
			normalY = 0;
		}
	} else if (qx > qy) {
		normalX = Math.sign(x || 1);
		normalY = 0;
	} else {
		normalX = 0;
		normalY = Math.sign(y || 1);
	}

	return { depth: -signedDistance, normalX, normalY };
}
