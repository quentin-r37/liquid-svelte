/**
 * Reactive `window.devicePixelRatio`.
 *
 * The generated textures are rasterised in CSS pixels and then stretched into
 * place by `<feImage>`, so on a HiDPI panel — and far more visibly under browser
 * zoom — every texel ends up covering several device pixels. A smooth field
 * survives that upscale; the specular hairline does not, because it is only a
 * pixel or two thick and follows a curve, so the upscale turns the curve into a
 * staircase. Knowing the ratio is what lets `createSpecularMap` supersample and
 * hand `feImage` a texture it does not have to invent detail for.
 *
 * ## Why a media query and not an event
 *
 * There is no event for this. `resize` happens to fire on zoom in current
 * Chromium, but not when the window moves to a monitor with a different scale
 * factor, and relying on a side effect of an unrelated event is how this breaks
 * silently later. The portable signal is a media query pinned to the *current*
 * ratio: `(resolution: 2dppx)` matches exactly while the ratio is 2 and stops
 * matching the instant it moves, so it can only ever fire once — hence the
 * re-arm against the new value inside the handler.
 *
 * Reading is split from arming, mirroring {@link resolveGlassSupport}: the ratio
 * is `1` until an `$effect` starts it, so the first client render agrees with the
 * server. That costs nothing here, because the `full` tier — the only consumer —
 * is itself gated behind detection running in the same flush.
 */

let current = $state(1);
let armed = false;

function read(): number {
	if (typeof window === 'undefined') return 1;
	// `0` is not a legal ratio but has been observed in headless environments.
	return window.devicePixelRatio || 1;
}

function arm(): void {
	const ratio = read();
	current = ratio;
	window.matchMedia(`(resolution: ${ratio}dppx)`).addEventListener('change', arm, { once: true });
}

export const devicePixelRatio = {
	/** The current ratio. `1` on the server, and until {@link resolveDevicePixelRatio} runs. */
	get current(): number {
		return current;
	}
};

/**
 * Start tracking the ratio. Idempotent and client-only; call it from an `$effect`
 * so the initial render still matches the server output.
 */
export function resolveDevicePixelRatio(): void {
	if (armed || typeof window === 'undefined') return;
	armed = true;
	arm();
}
