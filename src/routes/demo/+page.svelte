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
		LiquidToolbar,
		glassSupport,
		reducedMotion,
		setGlassModeOverride,
		type CornerShape,
		type GlassMode,
		type GlassQuality,
		type LiquidMenuItem,
		type LiquidTab,
		type LiquidToolbarItem
	} from '$lib/liquid-glass/index.js';
	import {
		ChevronLeft,
		Copy,
		Ellipsis,
		Play,
		RefreshCw,
		Search,
		Share2,
		Shuffle,
		SkipBack,
		SkipForward,
		Star,
		Trash2
	} from '@lucide/svelte';
	import Backdrop, { BACKDROP_KINDS, type BackdropKind } from '../Backdrop.svelte';
	import FpsMeter from '../FpsMeter.svelte';

	let scheme = $state<'light' | 'dark'>('dark');
	let backdrop = $state<BackdropKind>('grid');
	let tierOverride = $state<GlassMode>('auto');
	/**
	 * Applied to every component that accepts it, so the convention can be compared
	 * against a uniformly round gallery on the same page rather than across a reload.
	 *
	 * `squircle` is the library default, and it does not mean everything becomes a
	 * squircle: any surface whose radius saturates at half its box is a capsule and
	 * gets demoted to `round` by the primitive. Flipping this to `round` therefore only
	 * changes the surfaces that had a straight edge to spare — the cards, the menu
	 * panels — which is exactly the set iOS treats differently.
	 */
	let cornerShape = $state<CornerShape>('squircle');
	/**
	 * Same control as the probe's: one quality preset applied to every component on the
	 * page, so the three tiers can be compared across the whole gallery at once.
	 * `medium` to match the library's defaults — no component ships `high` (see
	 * QUALITY_PRESETS), so that is the gallery a consumer actually gets. Flip the
	 * select to `high` to see the aberration tile aberrate, since the 3-pass
	 * chromatic chain is gated behind this preset.
	 */
	let quality = $state<GlassQuality>('medium');

	$effect(() => {
		setGlassModeOverride(tierOverride);
	});

	/**
	 * The header controls survive a reload. Restoration happens in an `$effect` rather
	 * than at `$state` init so the first client render matches SSR — the same reason
	 * capability detection runs in one (`capabilities.svelte.ts`). Each value is
	 * validated against its option list, so a stale or hand-edited entry falls back to
	 * the default instead of feeding the components an impossible variant.
	 */
	const OPTIONS_KEY = 'liquid-svelte:demo-options';
	let optionsRestored = false;

	$effect(() => {
		let stored: Record<string, unknown> = {};
		try {
			stored = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}');
		} catch {
			/* corrupt entry — keep the defaults, the persist effect below rewrites it */
		}
		if (stored.scheme === 'light' || stored.scheme === 'dark') scheme = stored.scheme;
		if (BACKDROP_KINDS.some((k) => k.value === stored.backdrop))
			backdrop = stored.backdrop as BackdropKind;
		if (['auto', 'full', 'degraded', 'flat'].includes(stored.tierOverride as string))
			tierOverride = stored.tierOverride as GlassMode;
		if (stored.cornerShape === 'squircle' || stored.cornerShape === 'round')
			cornerShape = stored.cornerShape;
		if (['low', 'medium', 'high'].includes(stored.quality as string))
			quality = stored.quality as GlassQuality;
		optionsRestored = true;
	});

	$effect(() => {
		// Read unconditionally so every option is a dependency; the flag only gates the
		// write, keeping the pre-restore run from clobbering the stored values.
		const snapshot = JSON.stringify({ scheme, backdrop, tierOverride, cornerShape, quality });
		if (optionsRestored) localStorage.setItem(OPTIONS_KEY, snapshot);
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

	/**
	 * Icon-bearing tabs, snippet-borne like `toolbarItems` below and `$derived` for
	 * the same reason — the snippets they reference are declared in the template.
	 * The icon-only row is the same array with the labels folded into `aria-label`,
	 * which is exactly the relationship the two modes are meant to have.
	 */
	const iconTabs: LiquidTab[] = $derived([
		{ id: 'play', label: 'Play', icon: playIcon },
		{ id: 'shuffle', label: 'Shuffle', icon: shuffleIcon },
		{ id: 'search', label: 'Search', icon: searchIcon }
	]);
	const glyphTabs: LiquidTab[] = $derived(iconTabs.map((tab) => ({ ...tab, iconOnly: true })));
	let activeIconTab = $state('play');
	let activeGlyphTab = $state('shuffle');
	let activeStackedTab = $state('search');

	let starred = $state(false);
	let lastToolbarAction = $state('—');

	/**
	 * Icons ride the items as snippets rather than being switched on the id inside a body
	 * snippet, which is what keeps a five-item bar a five-line array.
	 *
	 * `$derived` rather than a plain `const` for two reasons: `starred` has to reach the
	 * `selected` flag, and a derived is evaluated lazily — at render time, by which point
	 * the snippets declared in the template below exist.
	 */
	const toolbarItems: LiquidToolbarItem[] = $derived([
		{ id: 'copy', label: 'Duplicate', icon: copyIcon },
		{ id: 'share', label: 'Share', icon: shareIcon },
		{ id: 'star', label: 'Add to favourites', icon: starIcon, selected: starred },
		{ id: 'locked', label: 'Regenerate', icon: refreshIcon, disabled: true },
		{ id: 'delete', label: 'Delete', icon: trashIcon, destructive: true, separated: true }
	]);

	function onToolbarAction(id: string) {
		lastToolbarAction = id;
		if (id === 'star') starred = !starred;
	}

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
<FpsMeter />

<!--
	Declared at the top level of the template, not inside `.page`: a snippet is scoped to
	the block it is written in, and these have to be reachable from the `toolbarItems`
	derived in the script.
-->
{#snippet playIcon()}<Play />{/snippet}
{#snippet shuffleIcon()}<Shuffle />{/snippet}
{#snippet searchIcon()}<Search />{/snippet}
{#snippet copyIcon()}<Copy />{/snippet}
{#snippet shareIcon()}<Share2 />{/snippet}
{#snippet starIcon()}<Star />{/snippet}
{#snippet refreshIcon()}<RefreshCw />{/snippet}
{#snippet trashIcon()}<Trash2 />{/snippet}

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
				<span>quality</span>
				<select bind:value={quality}>
					<option value="low">low — 0.5× map, 1 pass</option>
					<option value="medium">medium — 0.75× map, 1 pass</option>
					<option value="high">high — 1× map, 3 passes</option>
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
			<label>
				<span>corner</span>
				<select bind:value={cornerShape} disabled={!glassSupport.cornerShape}>
					<option value="squircle">squircle — iOS default</option>
					<option value="round">round everywhere</option>
				</select>
			</label>
			<p class="meta">
				reduced motion: <strong>{reducedMotion.current ? 'on' : 'off'}</strong> · corner-shape:
				<strong>{glassSupport.cornerShape ? 'supported' : 'unsupported'}</strong> ·
				<a href={resolve('/probe')}>optics probe</a> ·
				<a href={resolve('/borders')}>borders lab</a>
			</p>
			<p class="meta">
				The corner follows iOS: <strong
					>buttons, switches, sliders and tabs stay fully rounded</strong
				>,
				<strong>cards, panels and context menus get the continuous curve</strong>. Nothing here opts
				in per component — a capsule has no straight edge for a superellipse to meet, so the
				primitive demotes those to <code>round</code> on its own. Flipping this control to
				<em>round everywhere</em> therefore only changes the menu panels and the primitive tiles below;
				every pill and circle on the page is identical either way, which is the convention working rather
				than the control failing.
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
			<!--
				No `cornerShape` on any button here, deliberately: every one of them is a pill
				or a circle, so all of them resolve to `round` whatever the header control says
				— the pills because a capsule cannot be a superellipse, the circles because
				`LiquidButton` pins them. Threading the control through would have suggested it
				does something, and passing it to a circle would in fact *defeat* that pin and
				turn it into a small app icon.
			-->
			<div class="row">
				<LiquidButton size="sm" {quality} onclick={() => (pressed += 1)}>Small</LiquidButton>
				<LiquidButton {quality} onclick={() => (pressed += 1)}>Medium</LiquidButton>
				<LiquidButton size="lg" tone="prominent" {quality} onclick={() => (pressed += 1)}>
					Prominent
				</LiquidButton>
				<LiquidButton {quality} disabled>Disabled</LiquidButton>
			</div>
			<p class="note">
				<code>shape="circle"</code> is not a pill with equal padding: it is laid out at a literal
				diameter, so every circle of a size shares one rasterised map, and its rim is a fraction of
				that diameter rather than a per-size constant — a circle's radius <em>is</em> half its size, so
				a fixed bezel would turn the whole disc into rim and the glyph would sit in continuous distortion.
			</p>
			<div class="row">
				<LiquidButton shape="circle" size="sm" {quality} aria-label="Previous">
					<SkipBack />
				</LiquidButton>
				<LiquidButton shape="circle" {quality} aria-label="Play"><Play /></LiquidButton>
				<LiquidButton shape="circle" size="lg" tone="prominent" {quality} aria-label="Next">
					<SkipForward />
				</LiquidButton>
				<LiquidButton shape="circle" {quality} disabled aria-label="Shuffle">
					<Shuffle />
				</LiquidButton>
				<LiquidButton {quality}><Play />Play all</LiquidButton>
			</div>
			<p class="note">
				A circle is the one shape in the library where geometry cannot pick the corner: its box is
				square <em>and</em> its radius saturates, so <code>round</code> gives a circle and
				<code>squircle</code> gives the app-icon superellipse — both real, and iOS uses both for
				different things. <code>LiquidButton</code> pins its circles to <code>round</code>, because
				an iOS circular button is a circle; <code>cornerShape="squircle"</code> opts into the icon shape.
				The 150×150 tile at the bottom of the page is that shape.
			</p>
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
				<LiquidSwitch bind:checked={notifications} {quality}>Notifications</LiquidSwitch>
				<LiquidSwitch bind:checked={telemetry} size="sm" {quality}>Anonymous telemetry</LiquidSwitch
				>
				<LiquidSwitch checked disabled {quality} label="Locked setting">Locked</LiquidSwitch>
			</div>
		</section>

		<section>
			<h2>LiquidMenu</h2>
			<p class="note">
				The trigger <strong>becomes</strong> the panel, and the button is not drawn for as long as
				the panel is out — so what moves is one object changing shape, not a menu appearing beside a
				button that is plainly still there. It leaves its place as a patch of glass the button's
				exact size, travels to the centre of the box the menu will fill, and on the way
				<strong>gathers</strong>: narrower, and taller for it, the way liquid draws in before it
				spreads. Three frames later it spills sideways — flattening as it goes, because the volume
				has to be somewhere — and then rises into its own shape, the refraction growing in as it
				deepens, since a shallow puddle has no thickness to bend light through. Its corner is driven
				<em>against</em> the scale throughout: as round as the box allows while it is small, easing
				to the panel's own radius only as it settles, which is the difference between liquid finding
				its edges and a rectangle being enlarged. The corner <em>shape</em> eases on that same
				schedule and for the same reason: while the patch is a lozenge its radius is saturated, and
				a saturated corner has to be round, so the panel spills round and only becomes the
				superellipse once it has somewhere to put one. The radius is compensated for that shape as
				well — 22 is the
				<em>round</em> panel's radius, and the squircle gets the ~40 that reads as equally curved, since
				a superellipse at equal radius looks tighter rather than rounder. Two scale channels, two deformation
				channels and a translation — no size animation, so the displacement map is rasterised once before
				the menu is ever opened. Arrows, Home/End, Escape, Tab and an outside press all behave; pointing
				at an item moves focus to it, as a native menu does.
			</p>
			<div class="row">
				<LiquidMenu
					items={menuItems}
					{cornerShape}
					{quality}
					onselect={(id) => (lastMenuChoice = id)}
				>
					Actions
				</LiquidMenu>
				<LiquidMenu
					items={menuItems}
					placement="bottom-end"
					{cornerShape}
					{quality}
					onselect={(id) => (lastMenuChoice = id)}
				>
					End-aligned
				</LiquidMenu>
				<LiquidMenu
					items={menuItems}
					placement="top-start"
					{cornerShape}
					{quality}
					onselect={(id) => (lastMenuChoice = id)}
				>
					Upwards
				</LiquidMenu>
				<LiquidMenu
					items={menuItems}
					morph={false}
					{cornerShape}
					{quality}
					onselect={(id) => (lastMenuChoice = id)}
				>
					No morph
				</LiquidMenu>
				<LiquidMenu items={menuItems} {cornerShape} {quality} disabled>Disabled</LiquidMenu>
			</div>
			<p class="readout">selected: <strong>{lastMenuChoice}</strong></p>
		</section>

		<section class="span">
			<h2>LiquidToolbar</h2>
			<p class="note">
				A circular button that <strong>stretches into a bar</strong> and back. The same swap as
				<code>LiquidMenu</code> — the trigger is not drawn for as long as the bar is out, so what
				moves is one object changing shape — but on one axis, and with the collapsed state as a
				place the control genuinely <em>rests</em> rather than a puddle nobody sees. That difference
				sets most of the design. The bar is laid out at its full width and drawn at a fraction of
				it, since width is the displacement map's cache key and animating it would rasterise a PNG
				per frame; so the shell and the trigger are locked to the same height by
				<code>TOOLBAR_SIZES</code>, which is what leaves exactly one axis to scale and makes the
				collapsed patch the button's box <em>exactly</em>. Its corner is asked for pre-divided by
				that scale, from half the shorter <em>drawn</em> side — one <code>min</code>, so the capsule
				survives turning through ninety degrees during the gather instead of having its ends
				flattened by CSS's radius clamp. The refraction is absent while the shell is squeezed and
				grows in with the unroll, because the map is baked for the settled bar and its end caps
				cannot survive being compressed sevenfold. The items neither fade on a timer nor ride the
				scale: the row
				<strong>cancels</strong> it, holding every well at its settled size and position from the first
				frame, and each one is lit when the unrolling edge reaches the width that has room for it. That
				threshold is geometry, so the stagger cannot drift from the spring — and the retraction plays
				it backwards for free. One style write per frame drives all of it.
			</p>
			<div class="row">
				<LiquidToolbar
					items={toolbarItems}
					{quality}
					label="Document actions"
					triggerLabel="More actions"
					onaction={onToolbarAction}
				>
					<Ellipsis />
				</LiquidToolbar>
				<LiquidToolbar
					items={toolbarItems}
					anchor="center"
					size="lg"
					{quality}
					label="Document actions, centred"
					triggerLabel="More actions"
					onaction={onToolbarAction}
				>
					<Ellipsis />
				</LiquidToolbar>
				<LiquidToolbar
					items={toolbarItems}
					anchor="end"
					size="sm"
					{quality}
					label="Document actions, end-anchored"
					triggerLabel="More actions"
					onaction={onToolbarAction}
				>
					<Ellipsis />
				</LiquidToolbar>
				<LiquidToolbar
					items={[
						{ id: 'cancel', label: 'Cancel' },
						{ id: 'save', label: 'Save', separated: true }
					]}
					{quality}
					label="Editing actions"
					triggerLabel="Edit"
					onaction={onToolbarAction}
				>
					<Ellipsis />
				</LiquidToolbar>
				<LiquidToolbar items={toolbarItems} {quality} disabled triggerLabel="More actions">
					<Ellipsis />
				</LiquidToolbar>
			</div>
			<p class="note">
				Acting on an item leaves the bar open, which is the whole difference from a menu: these are
				repeatable actions against something still on screen, not one choice that dismisses what
				asked for it. Favourites toggles in place. Arrows move between wells, Home/End jump, Escape
				and an outside press retract — and Tab falls through and takes focus out, as the ARIA
				toolbar pattern requires, which collapses the bar behind it.
			</p>
			<p class="readout">
				last action: <strong>{lastToolbarAction}</strong> · favourite:
				<strong>{starred ? 'on' : 'off'}</strong>
			</p>
		</section>

		<section>
			<h2>LiquidSlider</h2>
			<p class="note">
				Same droplet: an opaque knob until you grab it, then clear refracting glass that swells and
				squashes along its travel. A transparent <code>&lt;input type="range"&gt;</code> sits over the
				track, so arrows, PageUp/PageDown and Home/End all work — and melt the droplet too.
			</p>
			<div class="col wide">
				<LiquidSlider bind:value={volume} {quality} label="Volume" showValue />
				<LiquidSlider
					bind:value={temperature}
					min={16}
					max={28}
					step={0.5}
					{quality}
					label="Target temperature"
					format={(v) => `${v.toFixed(1)}°C`}
					showValue
				/>
				<LiquidSlider value={30} {quality} label="Disabled slider" disabled showValue />
			</div>
		</section>

		<section>
			<h2>LiquidTabs</h2>
			<p class="note">
				<code>tablist</code> / <code>tab</code> / <code>tabpanel</code> with roving focus and manual activation.
				Arrow keys move, Home and End jump, the disabled tab is skipped.
			</p>
			<LiquidTabs {tabs} bind:value={activeTab} {quality} label="Documentation sections">
				{#snippet panel(id)}
					<p class="panel">{tabCopy[id]}</p>
				{/snippet}
			</LiquidTabs>
			<p class="note">
				Segments take an optional <code>icon</code> snippet — beside the label, above it with
				<code>iconPlacement="top"</code>, or alone with <code>iconOnly</code>, where the label moves
				onto the button's <code>aria-label</code>. The bubble paints over the labels, so the lens
				refracts the glyphs it crosses — grab one and watch the fringing.
			</p>
			<div class="col">
				<LiquidTabs tabs={iconTabs} bind:value={activeIconTab} {quality} label="Playback source" />
				<LiquidTabs
					tabs={glyphTabs}
					bind:value={activeGlyphTab}
					{quality}
					label="Playback source, icons only"
				/>
				<LiquidTabs
					tabs={iconTabs}
					bind:value={activeStackedTab}
					iconPlacement="top"
					{quality}
					label="Playback source, stacked"
				/>
			</div>
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
						<LiquidButton shape="circle" {quality} aria-label="Back"><ChevronLeft /></LiquidButton>
					{/snippet}
					{#snippet trailing()}
						<LiquidButton shape="circle" {quality} aria-label="Search"><Search /></LiquidButton>
						<LiquidMenu
							items={menuItems}
							placement="bottom-end"
							triggerShape="circle"
							{cornerShape}
							{quality}
							onselect={(id) => (lastMenuChoice = id)}
						>
							<Ellipsis />
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

				<LiquidLens
					container={lensStage}
					{cornerShape}
					{quality}
					label="Magnifier"
					style="left: 8%; top: 24%;"
				/>
			</div>
		</section>

		<section class="span">
			<h2>LiquidGlass — the primitive</h2>
			<p class="note">
				Everything above composes this. It takes content through a snippet and exposes the geometry
				and optics as typed props.
			</p>
			<p class="note">
				These four vary <code>profile</code> — the height of the glass <em>surface</em> across the
				bezel, which is what bends the light. The <strong>corner</strong> control in the header
				varies
				<code>cornerShape</code>, the <em>outline</em>. Two unrelated axes that both have a squircle
				in them, hence the labels: the first tile is the default quartic <em>surface</em>, and it
				keeps that surface whatever the outline is set to.
			</p>
			<div class="row wrap">
				<LiquidGlass
					width={150}
					height={150}
					borderRadius={75}
					{cornerShape}
					bezel={40}
					{quality}
					interactive
				>
					<span class="tile-label">squircle profile</span>
				</LiquidGlass>
				<LiquidGlass
					width={150}
					height={150}
					borderRadius={28}
					{cornerShape}
					bezel={30}
					profile="concave"
					{quality}
					interactive
				>
					<span class="tile-label">concave profile</span>
				</LiquidGlass>
				<LiquidGlass
					width={150}
					height={150}
					borderRadius={40}
					{cornerShape}
					bezel={34}
					profile="lip"
					{quality}
					interactive
				>
					<span class="tile-label">lip profile</span>
				</LiquidGlass>
				<LiquidGlass
					width={150}
					height={150}
					borderRadius={20}
					{cornerShape}
					bezel={26}
					chromaticAberration={0.16}
					{quality}
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
			'Inter Variable',
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
