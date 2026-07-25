import type { Attachment } from 'svelte/attachments';

/**
 * Applies a set of inline style declarations with `setProperty`, and removes
 * them again on teardown.
 *
 * Why not just bind the `style` attribute? Because Svelte rewrites the whole
 * attribute — `element.style.cssText` — whenever its value changes, which would
 * silently wipe the `--pointer-*` / `--highlight-*` properties written by
 * `trackPointer`. Every inline property this library owns therefore goes through
 * `setProperty`, which only ever touches the keys it names. The `style` prop a
 * consumer passes in is the single exception, and it is documented as such.
 */
export function applyGlassStyle(
	declarations: Record<string, string | undefined>
): Attachment<HTMLElement> {
	return (element) => {
		const applied: string[] = [];

		for (const [property, value] of Object.entries(declarations)) {
			if (value === undefined) continue;
			element.style.setProperty(property, value);
			applied.push(property);
		}

		return () => {
			for (const property of applied) element.style.removeProperty(property);
		};
	};
}
