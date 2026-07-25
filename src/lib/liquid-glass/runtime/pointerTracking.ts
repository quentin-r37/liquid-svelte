import type { Attachment } from 'svelte/attachments';
import { cancelFrame, frame } from 'motion';
import { HIGHLIGHT_TRAVEL, VELOCITY_REFERENCE } from './glassTokens.js';

/**
 * Publishes pointer position and velocity as CSS custom properties on a glass
 * surface, so the specular highlight can react without any Svelte re-render.
 *
 * Written properties:
 *
 * - `--pointer-x` / `--pointer-y` — pointer position within the element, `0`–`1`.
 * - `--velocity-x` / `--velocity-y` — normalised pointer velocity, `-1`–`1`.
 * - `--highlight-x` / `--highlight-y` — specular centre as a percentage. It
 *   leads the pointer *against* the direction of travel, the way a real
 *   highlight lags behind a moving surface.
 * - `--pointer-inside` — `1` while the pointer is over the element, else `0`.
 *
 * All writes are deferred to Motion's `frame.render` batch. Several surfaces
 * moving at once therefore produce one style-write pass per frame, and never
 * interleave a write with a layout read.
 */

interface PointerState {
	x: number;
	y: number;
	velocityX: number;
	velocityY: number;
	inside: number;
}

/** Rest state: highlight centred, no velocity. */
const REST: PointerState = { x: 0.5, y: 0.5, velocityX: 0, velocityY: 0, inside: 0 };

function clampUnit(value: number): number {
	return Math.min(1, Math.max(-1, value));
}

function write(element: HTMLElement, state: PointerState): void {
	const style = element.style;
	style.setProperty('--pointer-x', state.x.toFixed(4));
	style.setProperty('--pointer-y', state.y.toFixed(4));
	style.setProperty('--velocity-x', state.velocityX.toFixed(4));
	style.setProperty('--velocity-y', state.velocityY.toFixed(4));
	style.setProperty('--pointer-inside', String(state.inside));

	// The highlight trails the motion, so subtract velocity from position.
	const highlightX = state.x * 100 - state.velocityX * HIGHLIGHT_TRAVEL;
	const highlightY = state.y * 100 - state.velocityY * HIGHLIGHT_TRAVEL;
	style.setProperty('--highlight-x', `${highlightX.toFixed(2)}%`);
	style.setProperty('--highlight-y', `${highlightY.toFixed(2)}%`);
}

export interface PointerTrackingOptions {
	/** When false the attachment only writes the rest state and adds no listeners. */
	enabled: boolean;
	/** Suppress velocity so nothing overshoots or lags under reduced motion. */
	suppressVelocity: boolean;
}

export function trackPointer(options: PointerTrackingOptions): Attachment<HTMLElement> {
	return (element) => {
		write(element, REST);
		if (!options.enabled) return;

		const state: PointerState = { ...REST };
		let lastX = 0;
		let lastY = 0;
		let lastTime = 0;
		let scheduled = false;

		const flush = () => {
			scheduled = false;
			write(element, state);
		};

		const schedule = () => {
			if (scheduled) return;
			scheduled = true;
			frame.render(flush);
		};

		const onPointerMove = (event: PointerEvent) => {
			// `offsetX/Y` avoids a `getBoundingClientRect()` read, so this handler
			// never forces a layout — the whole point of batching the writes.
			const width = element.offsetWidth || 1;
			const height = element.offsetHeight || 1;
			const x = event.offsetX / width;
			const y = event.offsetY / height;

			if (options.suppressVelocity) {
				state.velocityX = 0;
				state.velocityY = 0;
			} else {
				const elapsed = event.timeStamp - lastTime;
				if (lastTime > 0 && elapsed > 0) {
					state.velocityX = clampUnit(
						((event.offsetX - lastX) / elapsed) * (1000 / VELOCITY_REFERENCE)
					);
					state.velocityY = clampUnit(
						((event.offsetY - lastY) / elapsed) * (1000 / VELOCITY_REFERENCE)
					);
				}
				lastX = event.offsetX;
				lastY = event.offsetY;
				lastTime = event.timeStamp;
			}

			state.x = Math.min(1, Math.max(0, x));
			state.y = Math.min(1, Math.max(0, y));
			state.inside = 1;
			schedule();
		};

		const onPointerLeave = () => {
			// The highlight keeps its last position and simply fades out via CSS;
			// snapping it back to the centre would read as a glitch.
			state.velocityX = 0;
			state.velocityY = 0;
			state.inside = 0;
			lastTime = 0;
			schedule();
		};

		element.addEventListener('pointermove', onPointerMove, { passive: true });
		element.addEventListener('pointerleave', onPointerLeave);
		element.addEventListener('pointercancel', onPointerLeave);

		return () => {
			element.removeEventListener('pointermove', onPointerMove);
			element.removeEventListener('pointerleave', onPointerLeave);
			element.removeEventListener('pointercancel', onPointerLeave);
			cancelFrame(flush);
			write(element, REST);
		};
	};
}
