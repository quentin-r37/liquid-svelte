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
const callbacks = new WeakMap<Element, SizeCallback>();

function handle(entries: ResizeObserverEntry[]): void {
	for (const entry of entries) {
		const callback = callbacks.get(entry.target);
		if (!callback) continue;

		// `borderBoxSize` is the box the displacement map has to cover, since the
		// glass layers are positioned against the element's padding/border edge.
		const box = entry.borderBoxSize?.[0];
		if (box) {
			callback(box.inlineSize, box.blockSize);
		} else {
			const rect = entry.contentRect;
			callback(rect.width, rect.height);
		}
	}
}

/** Observe `element`; returns the teardown. No-op outside the browser. */
export function observeSize(element: Element, callback: SizeCallback): () => void {
	if (typeof ResizeObserver === 'undefined') return () => {};

	observer ??= new ResizeObserver(handle);
	callbacks.set(element, callback);
	observer.observe(element, { box: 'border-box' });

	return () => {
		callbacks.delete(element);
		observer?.unobserve(element);
	};
}
