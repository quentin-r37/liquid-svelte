/**
 * A single `ResizeObserver` shared by every glass surface on the page.
 *
 * One observer with N targets is measurably cheaper than N observers with one
 * target each, and it guarantees all callbacks for a given layout pass fire in
 * the same batch — so no glass surface ever measures a size that another has
 * already invalidated.
 */

type SizeCallback = (width: number, height: number) => void;

let observer: ResizeObserver | null = null;

/**
 * A *set* of callbacks per element, not one.
 *
 * The single-callback version this replaces looked adequate for as long as one
 * element meant one interested party, and it silently stopped being true the
 * moment a component both rendered a `LiquidGlass` and measured that same host
 * itself — which is exactly what a segmented control does: the primitive observes
 * the rail to size its displacement map, and the component observes it to remeasure
 * the segments the selection bubble travels between. Registering the second
 * overwrote the first, so the primitive never received a size, never rasterised a
 * map, and stayed pinned on the `degraded` tier. Nothing errored; the surface was
 * simply not glass.
 *
 * The teardown had the matching half of the bug: `unobserve` is per *element*, so
 * whichever holder released first stopped delivery for everyone. Hence the count
 * below — the element is only unobserved once the last callback is gone.
 */
const callbacks = new WeakMap<Element, Set<SizeCallback>>();

function handle(entries: ResizeObserverEntry[]): void {
	for (const entry of entries) {
		const listeners = callbacks.get(entry.target);
		if (!listeners || listeners.size === 0) continue;

		// `borderBoxSize` is the box the displacement map has to cover, since the
		// glass layers are positioned against the element's padding/border edge.
		const box = entry.borderBoxSize?.[0];
		const width = box ? box.inlineSize : entry.contentRect.width;
		const height = box ? box.blockSize : entry.contentRect.height;

		// Copied before iterating: a callback is entitled to tear its own
		// registration down — or another's — from inside the notification.
		for (const callback of [...listeners]) callback(width, height);
	}
}

/** Observe `element`; returns the teardown. No-op outside the browser. */
export function observeSize(element: Element, callback: SizeCallback): () => void {
	if (typeof ResizeObserver === 'undefined') return () => {};

	observer ??= new ResizeObserver(handle);

	let listeners = callbacks.get(element);
	if (!listeners) {
		listeners = new Set();
		callbacks.set(element, listeners);
		observer.observe(element, { box: 'border-box' });
	}
	listeners.add(callback);

	let released = false;
	return () => {
		// Guarded because a teardown can legitimately be run twice — an effect that
		// re-runs and is then destroyed — and a second call would otherwise delete a
		// re-registered listener, or unobserve an element still being watched.
		if (released) return;
		released = true;

		listeners.delete(callback);
		if (listeners.size > 0) return;
		callbacks.delete(element);
		observer?.unobserve(element);
	};
}
