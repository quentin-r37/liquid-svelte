import { animate, motionValue } from 'motion';
import { DROPLET_ACTIVE, DROPLET_REST, type DropletVisual } from './glassTokens.js';
import { springFor } from './motionTokens.js';

/**
 * The rest → droplet transition used by slider and switch thumbs, and by the menu
 * panel's puddle.
 *
 * This is how the effect actually behaves on iOS 26: a control's knob is an
 * essentially **opaque, tinted blob at rest** and only becomes glass when you grab
 * it — at which point it swells slightly, the refraction fades in, the backdrop
 * saturates and the rim lights up. Rendering the knob as glass all the time is
 * both wrong and worse-looking: a small permanently-refracting circle reads as a
 * smudge, whereas the transition is what sells it as a liquid droplet forming
 * under your finger.
 *
 * Everything interpolated here — displacement strength, tint, saturation, blur,
 * specular intensity — is a *live* filter attribute or CSS variable. None of it
 * touches the geometry, so no displacement map is regenerated during the morph,
 * however many frames it takes.
 *
 * The endpoints are injectable because the morph is the same idea at two very
 * different sizes: a 28px knob wants to go nearly transparent and heavily
 * saturated, while a menu panel carrying text wants a visible tint and a little
 * frost. See {@link DROPLET_REST} / {@link DROPLET_ACTIVE} and
 * {@link MENU_GLASS_REST} / {@link MENU_GLASS_OPEN}.
 */
export class DropletMorph {
	/** 0 = at rest, 1 = fully liquid. */
	#progress = $state(0);
	#value = motionValue(0);
	#unsubscribe: (() => void) | null = null;
	#reduced = false;
	#rest: DropletVisual;
	#active: DropletVisual;

	constructor(endpoints?: { rest: DropletVisual; active: DropletVisual }) {
		this.#rest = endpoints?.rest ?? DROPLET_REST;
		this.#active = endpoints?.active ?? DROPLET_ACTIVE;

		// A Motion value drives the spring; the `$state` mirror is what the template
		// reads. One state write per frame for the duration of the morph, which
		// updates a handful of filter attributes and nothing else.
		this.#unsubscribe = this.#value.on('change', (latest) => {
			this.#progress = latest;
		});
	}

	get progress(): number {
		return this.#progress;
	}

	/** Interpolated visual parameters to spread onto `LiquidGlass`. */
	get visual(): DropletVisual {
		const t = this.#progress;
		const rest = this.#rest;
		const active = this.#active;
		const mix = (from: number, to: number) => from + (to - from) * t;

		return {
			displacementRatio: mix(rest.displacementRatio, active.displacementRatio),
			opacity: mix(rest.opacity, active.opacity),
			saturation: mix(rest.saturation, active.saturation),
			blur: mix(rest.blur, active.blur),
			specularIntensity: mix(rest.specularIntensity, active.specularIntensity),
			scale: mix(rest.scale, active.scale)
		};
	}

	setReduced(reduced: boolean): void {
		this.#reduced = reduced;
	}

	/** Melt into a droplet. */
	engage(): void {
		animate(this.#value, 1, springFor('droplet', this.#reduced));
	}

	/** Freeze back into a solid knob. */
	release(): void {
		animate(this.#value, 0, springFor('settle', this.#reduced));
	}

	destroy(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = null;
		this.#value.stop();
		this.#value.destroy();
	}
}
