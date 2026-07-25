/**
 * Writes inline style declarations with `setProperty`, touching only the keys it
 * is given.
 *
 * Why not just bind the `style` attribute? Because Svelte rewrites the whole
 * attribute — `element.style.cssText` — whenever its value changes, which would
 * silently wipe the `--pointer-*` / `--highlight-*` properties written by
 * `trackPointer` and the `transform` written by Motion. Every inline property this
 * library owns therefore goes through `setProperty`. The `style` prop a consumer
 * passes in is the single exception, and it is documented as such.
 *
 * This is a plain function rather than an attachment on purpose. An attachment
 * re-runs by tearing down and setting up again, so animating any of these values
 * would remove and re-add every property once per frame — including `width` and
 * `height`, which flickers. Called from an `$effect`, it simply overwrites.
 */
export function setGlassProperties(
	element: HTMLElement,
	declarations: Record<string, string | undefined>
): void {
	for (const [property, value] of Object.entries(declarations)) {
		if (value === undefined) {
			element.style.removeProperty(property);
		} else {
			element.style.setProperty(property, value);
		}
	}
}
