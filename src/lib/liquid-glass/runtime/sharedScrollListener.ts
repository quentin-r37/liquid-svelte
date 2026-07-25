/**
 * One `scroll` listener per scroll container, shared by everything on the page
 * that reacts to it.
 *
 * The same argument as `sharedResizeObserver.ts`: N listeners on one scroller
 * each read the same `scrollTop` in the same frame, so the read is done once and
 * fanned out. It also guarantees every subscriber for a given scroll sees the
 * same value, which matters as soon as two pieces of chrome — a nav bar and a
 * tab bar, say — are meant to materialise together.
 *
 * Listening is `passive`, so scrolling is never blocked waiting on a subscriber.
 * Subscribers are primed synchronously on registration, because a page restored
 * mid-scroll must not spend its first frames pretending to be at the top.
 */

type ScrollCallback = (top: number) => void;

interface Registration {
	callbacks: Set<ScrollCallback>;
	handler: () => void;
}

/** Keyed by the actual event target — the element, or `window` for the document. */
const registrations = new Map<EventTarget, Registration>();

function scrollTopOf(scroller: HTMLElement | null): number {
	return scroller ? scroller.scrollTop : window.scrollY;
}

/**
 * Subscribe to `scroller`'s scroll offset; pass `null` for the document
 * scroller. Returns the teardown. No-op outside the browser.
 *
 * The callback also fires on window resize: a subscriber that measures element
 * rects — which is how a scroll-edge threshold is expressed — needs to re-read
 * them when the layout moves under it, not only when the offset changes.
 */
export function observeScroll(scroller: HTMLElement | null, callback: ScrollCallback): () => void {
	if (typeof window === 'undefined') return () => {};

	const target: EventTarget = scroller ?? window;
	let registration = registrations.get(target);

	if (!registration) {
		const callbacks = new Set<ScrollCallback>();
		const handler = () => {
			const top = scrollTopOf(scroller);
			for (const subscriber of callbacks) subscriber(top);
		};

		registration = { callbacks, handler };
		registrations.set(target, registration);

		target.addEventListener('scroll', handler, { passive: true });
		window.addEventListener('resize', handler, { passive: true });
	}

	registration.callbacks.add(callback);
	callback(scrollTopOf(scroller));

	return () => {
		const entry = registrations.get(target);
		if (!entry) return;

		entry.callbacks.delete(callback);
		if (entry.callbacks.size > 0) return;

		target.removeEventListener('scroll', entry.handler);
		window.removeEventListener('resize', entry.handler);
		registrations.delete(target);
	};
}
