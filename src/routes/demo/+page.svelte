<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		LiquidButton,
		LiquidGlass,
		LiquidLens,
		LiquidMenu,
		LiquidNavBar,
		LiquidSlider,
		LiquidSwitch,
		LiquidTabs,
		glassSupport,
		reducedMotion,
		setGlassModeOverride,
		type GlassMode,
		type LiquidMenuItem,
		type LiquidTab
	} from '$lib/liquid-glass/index.js';
	import Backdrop, { BACKDROP_KINDS, type BackdropKind } from '../Backdrop.svelte';

	let scheme = $state<'light' | 'dark'>('dark');
	let backdrop = $state<BackdropKind>('grid');
	let tierOverride = $state<GlassMode>('auto');

	$effect(() => {
		setGlassModeOverride(tierOverride);
	});

	// Component state for the examples.
	let notifications = $state(true);
	let telemetry = $state(false);
	let volume = $state(64);
	let temperature = $state(21.5);
	let pressed = $state(0);

	const menuItems: LiquidMenuItem[] = [
		{ id: 'duplicate', label: 'Duplicate', hint: 'Copy with the same optics' },
		{ id: 'rename', label: 'Rename' },
		{ id: 'export', label: 'Export map…', hint: 'PNG, at map resolution' },
		{ id: 'locked', label: 'Regenerate', hint: 'Unavailable on this tier', disabled: true },
		{ id: 'delete', label: 'Delete', destructive: true, separated: true }
	];
	let lastMenuChoice = $state('—');

	const tabs: LiquidTab[] = [
		{ id: 'optics', label: 'Optics' },
		{ id: 'motion', label: 'Motion' },
		{ id: 'a11y', label: 'Access' },
		{ id: 'legacy', label: 'Legacy', disabled: true }
	];
	let activeTab = $state('optics');

	const tabCopy: Record<string, string> = {
		optics:
			'A displacement map encodes the refraction vector per pixel — X in red, Y in green, 128 neutral. The bezel carries almost all of it; the centre stays flat.',
		motion:
			'Every movement runs through Motion springs on a shared transform, so hover, press and drag compose instead of overwriting each other.',
		a11y: 'Native button, role="switch", a real range input and the ARIA tabs pattern — all operable from the keyboard alone.',
		legacy: ''
	};

	let lensStage = $state<HTMLElement | null>(null);

	let navScroller = $state<HTMLElement | null>(null);
	let navLargeTitle = $state<HTMLElement | null>(null);
	let navProgress = $state(0);

	/** Something with enough colour in it that the blur band is legible against it. */
	const shelf = [
		{ id: 'a', title: 'Late Reflections', meta: 'Ambient · 12 tracks', hue: 268 },
		{ id: 'b', title: 'Displacement', meta: 'Electronic · 9 tracks', hue: 196 },
		{ id: 'c', title: 'Snell', meta: 'Modern classical · 7 tracks', hue: 22 },
		{ id: 'd', title: 'Bezel', meta: 'Downtempo · 14 tracks', hue: 330 },
		{ id: 'e', title: 'Specular', meta: 'House · 11 tracks', hue: 148 },
		{ id: 'f', title: 'Backdrop Root', meta: 'Techno · 10 tracks', hue: 44 }
	];
</script>

<svelte:head>
	<title>liquid-svelte — component gallery</title>
</svelte:head>

<Backdrop kind={backdrop} {scheme} fixed />

<div class="page" data-scheme={scheme}>
	<header>
		<div class="titles">
			<h1>liquid-svelte</h1>
			<p>
				Liquid Glass components for Svelte 5. SVG displacement refraction, a generated specular rim,
				Motion springs. No canvas, no WebGL, no remote assets.
			</p>
		</div>

		<div class="controls">
			<label>
				<span>tier</span>
				<select bind:value={tierOverride}>
					<option value="auto">auto — {glassSupport.detected ?? 'detecting'}</option>
					<option value="full">full</option>
					<option value="degraded">degraded</option>
					<option value="flat">flat</option>
				</select>
			</label>
			<label>
				<span>backdrop</span>
				<select bind:value={backdrop}>
					{#each BACKDROP_KINDS as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>scheme</span>
				<select bind:value={scheme}>
					<option value="dark">dark</option>
					<option value="light">light</option>
				</select>
			</label>
			<p class="meta">
				reduced motion: <strong>{reducedMotion.current ? 'on' : 'off'}</strong> ·
				<a href={resolve('/probe')}>optics probe</a>
			</p>
		</div>
	</header>

	<main>
		<section>
			<h2>LiquidButton</h2>
			<p class="note">
				Native <code>&lt;button&gt;</code>. Motion's <code>press</code> covers keyboard activation, so
				Space and Enter compress it exactly like a click. Tab to it and try.
			</p>
			<div class="row">
				<LiquidButton size="sm" onclick={() => (pressed += 1)}>Small</LiquidButton>
				<LiquidButton onclick={() => (pressed += 1)}>Medium</LiquidButton>
				<LiquidButton size="lg" tone="prominent" onclick={() => (pressed += 1)}>
					Prominent
				</LiquidButton>
				<LiquidButton disabled>Disabled</LiquidButton>
			</div>
			<p class="note">
				<code>shape="circle"</code> is not a pill with equal padding: it is laid out at a literal
				diameter, so every circle of a size shares one rasterised map, and its rim is a fraction of
				that diameter rather than a per-size constant — a circle's radius <em>is</em> half its size, so
				a fixed bezel would turn the whole disc into rim and the glyph would sit in continuous distortion.
			</p>
			<div class="row">
				<LiquidButton shape="circle" size="sm" aria-label="Previous">‹</LiquidButton>
				<LiquidButton shape="circle" aria-label="Play">▶</LiquidButton>
				<LiquidButton shape="circle" size="lg" tone="prominent" aria-label="Next">›</LiquidButton>
				<LiquidButton shape="circle" disabled aria-label="Shuffle">⤫</LiquidButton>
			</div>
			<p class="readout">presses: <strong>{pressed}</strong></p>
		</section>

		<section>
			<h2>LiquidSwitch</h2>
			<p class="note">
				<strong>Drag the droplet</strong> — don't just tap it. At rest the thumb is an opaque knob;
				grabbing it melts it into refracting glass that swells and deforms as it crosses, then snaps
				to whichever end you threw it towards. A flick beats position. Tapping still toggles, Escape
				abandons a drag, and <code>role="switch"</code> means it announces as “switch, on”.
			</p>
			<div class="col">
				<LiquidSwitch bind:checked={notifications}>Notifications</LiquidSwitch>
				<LiquidSwitch bind:checked={telemetry} size="sm">Anonymous telemetry</LiquidSwitch>
				<LiquidSwitch checked disabled label="Locked setting">Locked</LiquidSwitch>
			</div>
		</section>

		<section>
			<h2>LiquidMenu</h2>
			<p class="note">
				The panel opens as a <strong>puddle</strong>: it spills sideways out of the trigger's corner
				first, then rises 50ms behind, and the refraction grows in with it — a shallow puddle has no
				thickness to bend light through. Two scale channels, no size animation, so the displacement
				map is rasterised once before the menu is ever opened. Arrows, Home/End, Escape, Tab and an
				outside press all behave; pointing at an item moves focus to it, as a native menu does.
			</p>
			<div class="row">
				<LiquidMenu items={menuItems} onselect={(id) => (lastMenuChoice = id)}>Actions</LiquidMenu>
				<LiquidMenu
					items={menuItems}
					placement="bottom-end"
					onselect={(id) => (lastMenuChoice = id)}
				>
					End-aligned
				</LiquidMenu>
				<LiquidMenu
					items={menuItems}
					placement="top-start"
					onselect={(id) => (lastMenuChoice = id)}
				>
					Upwards
				</LiquidMenu>
				<LiquidMenu items={menuItems} disabled>Disabled</LiquidMenu>
			</div>
			<p class="readout">selected: <strong>{lastMenuChoice}</strong></p>
		</section>

		<section>
			<h2>LiquidSlider</h2>
			<p class="note">
				Same droplet: an opaque knob until you grab it, then clear refracting glass that swells and
				squashes along its travel. A transparent <code>&lt;input type="range"&gt;</code> sits over the
				track, so arrows, PageUp/PageDown and Home/End all work — and melt the droplet too.
			</p>
			<div class="col wide">
				<LiquidSlider bind:value={volume} label="Volume" showValue />
				<LiquidSlider
					bind:value={temperature}
					min={16}
					max={28}
					step={0.5}
					label="Target temperature"
					format={(v) => `${v.toFixed(1)}°C`}
					showValue
				/>
				<LiquidSlider value={30} label="Disabled slider" disabled showValue />
			</div>
		</section>

		<section>
			<h2>LiquidTabs</h2>
			<p class="note">
				<code>tablist</code> / <code>tab</code> / <code>tabpanel</code> with roving focus and manual activation.
				Arrow keys move, Home and End jump, the disabled tab is skipped.
			</p>
			<LiquidTabs {tabs} bind:value={activeTab} label="Documentation sections">
				{#snippet panel(id)}
					<p class="panel">{tabCopy[id]}</p>
				{/snippet}
			</LiquidTabs>
		</section>

		<section class="span">
			<h2>LiquidNavBar <span class="sub">and LiquidScrollEdge</span></h2>
			<p class="note">
				<strong>Scroll inside the panel.</strong> The bar is not a glass surface and has no surface
				at all — no tint, no rim, no shadow, no boundary. What appears is a
				<em>progressive blur</em>: four stacked backdrop layers, each masked to a different depth,
				so the blur radius ramps from the pinned edge instead of stopping at a line. The content
				loses definition as it approaches the top; nothing is laid over it. That is what iOS
				actually does, and it is why the <em>controls</em> can be real glass — they sit beside the band,
				not inside it, so their refraction still reaches the page.
			</p>
			<p class="note">
				It takes its cue from the large title's bottom edge closing on the bar's, not from an
				absolute offset, so the inline title arrives exactly as the large one goes under. Nothing is
				sprung: the scroll position <em>is</em> the animation.
			</p>
			<div class="nav-stage" bind:this={navScroller}>
				<LiquidNavBar
					title="Listen Now"
					titleTarget={navLargeTitle}
					scroller={navScroller}
					{scheme}
					bind:progress={navProgress}
				>
					{#snippet leading()}
						<LiquidButton shape="circle" size="sm" aria-label="Back">‹</LiquidButton>
					{/snippet}
					{#snippet trailing()}
						<LiquidButton shape="circle" size="sm" aria-label="Search">⌕</LiquidButton>
						<LiquidMenu
							items={menuItems}
							placement="bottom-end"
							triggerShape="circle"
							triggerSize="sm"
							onselect={(id) => (lastMenuChoice = id)}
						>
							⋯
						</LiquidMenu>
					{/snippet}
				</LiquidNavBar>

				<div class="nav-content">
					<h3 class="nav-large-title" bind:this={navLargeTitle}>Listen Now</h3>
					<div class="nav-shelf">
						{#each shelf as album (album.id)}
							<article class="nav-card" style:--hue={album.hue}>
								<div class="nav-art"></div>
								<p class="nav-card-title">{album.title}</p>
								<p class="nav-card-meta">{album.meta}</p>
							</article>
						{/each}
					</div>
				</div>
			</div>
			<p class="readout">materialisation: <strong>{navProgress.toFixed(2)}</strong></p>
		</section>

		<section class="span">
			<h2>LiquidLens</h2>
			<p class="note">
				Drag it across the text. Arrow keys move it too (hold Shift for larger steps), and Escape
				abandons a pointer drag and restores the starting position. It stretches along the direction
				of travel, capped at 12%.
			</p>
			<div class="lens-stage" bind:this={lensStage}>
				<div class="lens-copy">
					<p>
						The refraction is a displacement map: for every pixel, the distance to the outline picks
						a magnitude off a 128-entry lookup table, and the outward edge normal turns it into a
						vector. X goes in the red channel, Y in the green, 128 meaning “no shift”.
					</p>
					<p>
						The lookup table comes from Snell's law applied to a quartic squircle profile. Convex
						surfaces have an infinite slope right at the rim, so the exact vector form matters: it
						saturates at a finite offset instead of collapsing the whole table into a one-pixel
						spike.
					</p>
					<p>
						Peak displacement is about four times the bezel width. That sounds enormous, and it is —
						but it only applies in a very thin band at the outer edge. A tenth of the way into the
						bezel the magnitude is already down to 0.47, and halfway in it is 0.05.
					</p>
				</div>

				<LiquidLens container={lensStage} label="Magnifier" style="left: 8%; top: 24%;" />
			</div>
		</section>

		<section class="span">
			<h2>LiquidGlass — the primitive</h2>
			<p class="note">
				Everything above composes this. It takes content through a snippet and exposes the geometry
				and optics as typed props.
			</p>
			<div class="row wrap">
				<LiquidGlass width={150} height={150} borderRadius={75} bezel={40} interactive>
					<span class="tile-label">squircle</span>
				</LiquidGlass>
				<LiquidGlass
					width={150}
					height={150}
					borderRadius={28}
					bezel={30}
					profile="concave"
					interactive
				>
					<span class="tile-label">concave</span>
				</LiquidGlass>
				<LiquidGlass
					width={150}
					height={150}
					borderRadius={40}
					bezel={34}
					profile="lip"
					interactive
				>
					<span class="tile-label">lip</span>
				</LiquidGlass>
				<LiquidGlass
					width={150}
					height={150}
					borderRadius={20}
					bezel={26}
					chromaticAberration={0.16}
					interactive
				>
					<span class="tile-label">aberration</span>
				</LiquidGlass>
			</div>
		</section>
	</main>

	<footer>
		<p>
			Refraction through <code>backdrop-filter: url(#…)</code> is Chromium-only. Firefox and Safari
			fall back to the <strong>degraded</strong> tier — blur, tint, rim and shadows, no distortion. Switch
			tiers above to compare.
		</p>
	</footer>
</div>

<style>
	.page {
		min-height: 100vh;
		padding: clamp(1.25rem, 4vw, 3rem);
		color: #f4f6fa;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		line-height: 1.6;
	}

	.page[data-scheme='light'] {
		color: #0c0e16;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: clamp(2rem, 5vw, 3.5rem);
	}

	.titles {
		max-width: 34rem;
	}

	h1 {
		margin: 0 0 0.4rem;
		font-size: clamp(1.75rem, 5vw, 2.75rem);
		font-weight: 800;
		letter-spacing: -0.03em;
	}

	.titles p {
		margin: 0;
		font-size: 0.95rem;
		opacity: 0.8;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
	}

	.page[data-scheme='light'] .titles p,
	.page[data-scheme='light'] .note,
	.page[data-scheme='light'] footer p {
		text-shadow: none;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: flex-end;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.7rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	select {
		padding: 0.35rem 0.5rem;
		border: 1px solid rgb(128 128 128 / 0.35);
		border-radius: 8px;
		background: rgb(0 0 0 / 0.35);
		color: inherit;
		font: inherit;
		font-size: 0.8rem;
		text-transform: none;
		letter-spacing: 0;
	}

	.page[data-scheme='light'] select {
		background: rgb(255 255 255 / 0.6);
	}

	.meta {
		margin: 0;
		font-size: 0.75rem;
		opacity: 0.7;
	}

	main {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
		gap: clamp(1.5rem, 3vw, 2.5rem);
		align-items: start;
	}

	.span {
		grid-column: 1 / -1;
	}

	h2 {
		margin: 0 0 0.35rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.65;
	}

	.note {
		margin: 0 0 1.1rem;
		max-width: 46rem;
		font-size: 0.85rem;
		opacity: 0.78;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
	}

	code {
		padding: 0.05em 0.3em;
		border-radius: 4px;
		background: rgb(128 128 128 / 0.22);
		font-size: 0.9em;
	}

	.row,
	.col {
		display: flex;
		gap: 1rem;
	}

	.row {
		flex-wrap: wrap;
		align-items: center;
	}

	.row.wrap {
		gap: 1.5rem;
	}

	.col {
		flex-direction: column;
		align-items: flex-start;
	}

	.col.wide {
		align-items: stretch;
		max-width: 30rem;
		gap: 1.4rem;
	}

	.readout {
		margin: 1rem 0 0;
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
	}

	.panel {
		margin: 0;
		max-width: 40rem;
		font-size: 0.875rem;
		opacity: 0.85;
	}

	/*
	 * `position: relative` makes the stage the lens's offsetParent, which is what
	 * `LiquidLens`'s bounds calculation expects.
	 */
	/*
	 * The scroll container the bar sticks inside. Note what is *not* here: no
	 * `mask`, no `filter`, no `opacity` below 1 and no transform. Any one of them
	 * would make this box a backdrop root — or, in Chromium, a transformed ancestor —
	 * and the bar would have nothing left to refract.
	 */
	.nav-stage {
		position: relative;
		height: 24rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		border-radius: 20px;
		background: rgb(10 12 20 / 0.5);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1);
	}

	.page[data-scheme='light'] .nav-stage {
		background: rgb(255 255 255 / 0.45);
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.1);
	}

	.sub {
		font-weight: 400;
		opacity: 0.55;
	}

	.nav-content {
		padding: 0 1.1rem 2rem;
	}

	.nav-large-title {
		margin: 0.75rem 0 1rem;
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.nav-shelf {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 1rem;
	}

	.nav-card {
		min-width: 0;
	}

	.nav-art {
		aspect-ratio: 1;
		border-radius: 12px;
		background: linear-gradient(
			145deg,
			hsl(var(--hue) 82% 62%),
			hsl(calc(var(--hue) + 42) 74% 38%)
		);
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
	}

	.nav-card-title {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.nav-card-meta {
		margin: 0.1rem 0 0;
		font-size: 0.75rem;
		opacity: 0.6;
	}

	.lens-stage {
		position: relative;
		overflow: hidden;
		border-radius: 20px;
		min-height: 26rem;
		padding: clamp(1rem, 3vw, 2rem);
		background: rgb(10 12 20 / 0.5);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1);
	}

	.page[data-scheme='light'] .lens-stage {
		background: rgb(255 255 255 / 0.45);
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.1);
	}

	.lens-copy {
		max-width: 44rem;
		font-size: 0.95rem;
	}

	.lens-copy p {
		margin: 0 0 1rem;
	}

	.tile-label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
	}

	footer {
		margin-top: clamp(2.5rem, 6vw, 4rem);
		max-width: 46rem;
	}

	footer p {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.7;
	}

	a {
		color: inherit;
		text-underline-offset: 3px;
	}
</style>
