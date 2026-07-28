<script lang="ts">
	/**
	 * The product test: one plausible application screen, end to end.
	 *
	 * Every other harness in this tree isolates something. `/probe` puts one surface
	 * under a microscope, `/bench` puts a hundred identical ones on a ladder, `/demo`
	 * lines the components up side by side. All three are arranged so a single
	 * variable moves, which is what makes them measurable — and is also why none of
	 * them can answer the only question that decides whether the library is usable:
	 * what happens when the surfaces are *different sizes*, sitting on *real*
	 * content, with text under them, while somebody scrolls.
	 *
	 * The layout is Apple Music's Listen Now because it is the honest hard case and
	 * not because it is pretty. It stacks the three things the architecture is most
	 * exposed to, all at once:
	 *
	 * • **One large surface over small text.** The mini player is a ~1100×72 slab
	 *   with a track list scrolling under it. `feDisplacementMap` point-samples, so
	 *   thin glyph strokes behind the outer bezel are exactly where the rim crawls —
	 *   the artefact the rim antialias exists for, in the one place a user actually
	 *   looks at for minutes at a time.
	 *
	 * • **Small surfaces over saturated artwork.** The hero buttons sit on a cover,
	 *   which is where a specular rim tuned against a calm gradient stops reading and
	 *   where chromatic fringing turns from a material into a bug.
	 *
	 * • **A moving backdrop that is not a stress test.** Scrolling refilters every
	 *   surface on every frame, the same as the `/bench` grid does, except the
	 *   content underneath is content rather than a pathological pattern.
	 *
	 * The screen therefore has ~8 glass surfaces, which is the regime `/bench` says
	 * costs nothing at all. If it does cost something here, the difference is the
	 * mix — and that is worth knowing precisely because the ladder cannot see it.
	 */
	import { resolve } from '$app/paths';
	import {
		LiquidButton,
		LiquidGlass,
		LiquidMenu,
		LiquidNavBar,
		LiquidTabs,
		glassSupport,
		setGlassModeOverride,
		type GlassMode,
		type GlassQuality,
		type GlassVariant,
		type LiquidMenuItem,
		type LiquidTab
	} from '$lib/liquid-glass/index.js';
	import {
		Ellipsis,
		Heart,
		Library,
		Pause,
		Play,
		Radio,
		Search,
		Shuffle,
		SkipBack,
		SkipForward,
		Sparkles
	} from '@lucide/svelte';
	import FpsMeter from '../FpsMeter.svelte';

	// ------------------------------------------------------------- the catalogue ---

	interface Album {
		id: string;
		title: string;
		artist: string;
		/** Base hue of the generated cover. */
		hue: number;
		/** Hue offset of the second pool, and the angle of the fine stripe layer. */
		spin: number;
	}

	const ALBUMS: Album[] = [
		{ id: 'a1', title: 'Nocturne Bleu', artist: 'Camille Ardent', hue: 220, spin: 42 },
		{ id: 'a2', title: 'Terracotta', artist: 'Solène Vidal', hue: 18, spin: 65 },
		{ id: 'a3', title: 'Silver Hours', artist: 'The Long Field', hue: 178, spin: 24 },
		{ id: 'a4', title: 'Basalte', artist: 'Ivo Marchand', hue: 268, spin: 78 },
		{ id: 'a5', title: 'Sunroom', artist: 'Marta Peña', hue: 42, spin: 15 },
		{ id: 'a6', title: 'Undertow', artist: 'Kell & Sona', hue: 200, spin: 55 },
		{ id: 'a7', title: 'Paper Lanterns', artist: 'Yuki Ono', hue: 340, spin: 33 },
		{ id: 'a8', title: 'Cold Signal', artist: 'Renard', hue: 155, spin: 70 },
		{ id: 'a9', title: 'Vermillion', artist: 'Ada Poole', hue: 8, spin: 48 },
		{ id: 'a10', title: 'Glasshouse', artist: 'Nour Bekkali', hue: 96, spin: 27 },
		{ id: 'a11', title: 'Late Transit', artist: 'Somme', hue: 248, spin: 61 },
		{ id: 'a12', title: 'Ember Line', artist: 'Halvard', hue: 28, spin: 39 }
	];

	/**
	 * Covers are generated rather than fetched — no network, no bundled binaries, and
	 * the harness stays a single file.
	 *
	 * The stripe layer on top is not decoration. Two soft pools give the bezel a
	 * different neighbourhood on every side, which is what makes the refraction read,
	 * but they are smooth: a displacement field can point-sample a gradient all day
	 * without aliasing. Real artwork has detail at the pixel, so the covers carry a
	 * 4px repeating stripe — that is the frequency the rim undersamples, and without
	 * it this screen would flatter the filter instead of testing it.
	 */
	function coverStyle(album: Album): string {
		const warm = (album.hue + album.spin) % 360;
		const deep = (album.hue + 180) % 360;

		return [
			'background:',
			`repeating-linear-gradient(${album.spin}deg, rgb(255 255 255 / 0.09) 0 1px, transparent 1px 4px),`,
			`radial-gradient(circle at 28% 24%, hsl(${album.hue} 92% 62%), transparent 58%),`,
			`radial-gradient(circle at 74% 72%, hsl(${warm} 88% 54%), transparent 52%),`,
			`linear-gradient(148deg, hsl(${deep} 62% 26%), hsl(${album.hue} 70% 10%))`
		].join(' ');
	}

	interface Track {
		id: number;
		title: string;
		artist: string;
		duration: string;
	}

	const TRACKS: Track[] = [
		{ id: 1, title: 'First Light', artist: 'Camille Ardent', duration: '3:42' },
		{ id: 2, title: 'Marceau', artist: 'Camille Ardent', duration: '4:18' },
		{ id: 3, title: 'Nocturne Bleu', artist: 'Camille Ardent', duration: '5:03' },
		{ id: 4, title: 'Quai de Seine', artist: 'Camille Ardent', duration: '2:57' },
		{ id: 5, title: 'Sous les toits', artist: 'Camille Ardent', duration: '3:29' },
		{ id: 6, title: 'Hiver 94', artist: 'Camille Ardent', duration: '4:41' },
		{ id: 7, title: 'La Dernière Heure', artist: 'Camille Ardent', duration: '6:12' },
		{ id: 8, title: 'Rue Oberkampf', artist: 'Camille Ardent', duration: '3:08' },
		{ id: 9, title: 'Envoi', artist: 'Camille Ardent', duration: '2:24' }
	];

	// ------------------------------------------------------------ playback state ---

	/**
	 * The real track, kept out of the fictional catalogue: clicking a card changes
	 * what the player is *labelled* with, and there is only ever one audio file, so
	 * conflating the two would put a stock title on every shelf.
	 */
	const NOW_PLAYING: Album = {
		id: 'now',
		title: 'In That Future Bass',
		artist: 'AudioJungle',
		hue: 288,
		spin: 52
	};

	let playing = $state(false);
	let nowPlaying = $state(NOW_PLAYING);
	let liked = $state(false);

	let audio = $state<HTMLAudioElement | null>(null);
	let elapsed = $state(0);
	let duration = $state(0);
	/**
	 * The audio lives in `static/audio`, which is gitignored — it is licensed stock,
	 * dev-only, and no part of the package. A fresh clone therefore has no file, and
	 * the screen has to keep working: everything it exists to test is about glass over
	 * scrolling content, none of which needs sound. So a failed load falls back to a
	 * synthetic tick and the player behaves identically apart from being silent.
	 */
	let hasAudio = $state(true);
	/** Synthetic 0–1 position, used only when there is no file to read one from. */
	let syntheticProgress = $state(0.31);

	const progress = $derived(
		hasAudio && duration > 0 ? Math.min(1, elapsed / duration) : syntheticProgress
	);

	/**
	 * A quarter-second tick rather than a `requestAnimationFrame` loop, deliberately,
	 * and the same reason `timeupdate` is left at its native cadence below: the point
	 * of this screen is to measure what the *glass* costs while the user scrolls, and
	 * a harness driving its own rAF every frame puts its own work in that number.
	 */
	$effect(() => {
		if (!playing || hasAudio) return;
		const id = setInterval(() => {
			syntheticProgress = syntheticProgress >= 1 ? 0 : syntheticProgress + 0.0025;
		}, 250);
		return () => clearInterval(id);
	});

	function toggle(): void {
		if (!audio || !hasAudio) {
			playing = !playing;
			return;
		}

		if (playing) {
			audio.pause();
			playing = false;
			return;
		}

		// Autoplay policy rejects until the page has been interacted with, and a
		// rejected promise here is unhandled otherwise.
		audio.play().then(
			() => (playing = true),
			() => (playing = false)
		);
	}

	/** Click anywhere on the track to seek, which is the least a real player does. */
	function seek(event: MouseEvent): void {
		const bar = event.currentTarget as HTMLElement;
		const ratio = (event.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth;
		const clamped = Math.min(1, Math.max(0, ratio));

		if (audio && hasAudio && duration > 0) audio.currentTime = clamped * duration;
		else syntheticProgress = clamped;
	}

	function clock(seconds: number): string {
		if (!Number.isFinite(seconds)) return '--:--';
		const whole = Math.floor(seconds);
		return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
	}

	// ------------------------------------------------------------------- chrome ---

	/**
	 * `$derived` rather than a plain `const`, and not for reactivity: the icons are
	 * snippets declared in the markup below, so a `const` evaluates during component
	 * init while those bindings are still in their temporal dead zone. Deferring the
	 * array to first read is what makes the reference legal — the same shape `/demo`
	 * uses for its icon tabs.
	 */
	const TABS: LiquidTab[] = $derived([
		{ id: 'listen', label: 'Listen Now', icon: listenIcon },
		{ id: 'browse', label: 'Browse', icon: browseIcon },
		{ id: 'radio', label: 'Radio', icon: radioIcon },
		{ id: 'library', label: 'Library', icon: libraryIcon },
		{ id: 'search', label: 'Search', icon: searchIcon }
	]);

	let tab = $state('listen');

	const MENU_ITEMS: LiquidMenuItem[] = [
		{ id: 'next', label: 'Play Next' },
		{ id: 'later', label: 'Play Last' },
		{ id: 'library', label: 'Add to Library', separated: true },
		{ id: 'playlist', label: 'Add to Playlist' },
		{ id: 'share', label: 'Share Album…', separated: true }
	];

	let scroller = $state<HTMLElement | null>(null);
	let largeTitle = $state<HTMLElement | null>(null);

	// ---------------------------------------------------------------- dev panel ---

	/**
	 * The controls are plain CSS on purpose — see `FpsMeter` for the same argument.
	 * A panel that participated in the pipeline would be one more surface in the
	 * number it is being used to read.
	 */
	let scheme = $state<'light' | 'dark'>('dark');
	let quality = $state<GlassQuality>('medium');
	let variant = $state<GlassVariant>('regular');
	let tierOverride = $state<GlassMode>('auto');
	let showPanel = $state(true);

	/**
	 * Ctrl toggles the harness chrome — dev panel and FPS pill — so the screen can be
	 * looked at (or captured) as the application it is pretending to be.
	 *
	 * The `{#if}` unmounts `FpsMeter` rather than hiding it, which also stops its
	 * `requestAnimationFrame` loop — the meter costs a frame callback it should not be
	 * spending while nobody is reading it. The counter restarts from 0 when the chrome
	 * comes back and needs its 500ms window to settle; that is the trade, and it is the
	 * right way round since the number is unreadable while hidden anyway.
	 */
	let chromeHidden = $state(false);

	$effect(() => {
		setGlassModeOverride(tierOverride);
	});
</script>

<!--
	`event.repeat` is load-bearing, not a nicety. A held modifier auto-repeats its
	`keydown` at the OS repeat rate, so without the guard resting a finger on Ctrl
	strobes the panel several times a second — and which state it lands in depends on
	how long the key was held, which is the worst possible answer for a toggle.
-->
<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Control' && !event.repeat) chromeHidden = !chromeHidden;
	}}
/>

{#snippet listenIcon()}<Sparkles size={17} />{/snippet}
{#snippet browseIcon()}<Library size={17} />{/snippet}
{#snippet radioIcon()}<Radio size={17} />{/snippet}
{#snippet libraryIcon()}<Library size={17} />{/snippet}
{#snippet searchIcon()}<Search size={17} />{/snippet}

<svelte:head>
	<title>liquid-svelte — application screen</title>
</svelte:head>

<!--
	Nothing between the root and a `.lg` may carry `filter`, `opacity < 1`, `mask`,
	`clip-path`, `mix-blend-mode`, `isolation` — or, in Chromium, a `transform`. Any
	of them turns that ancestor into a backdrop root and the refraction below it
	silently becomes a flat tint. That constraint is the reason the chrome is
	`position: fixed` siblings of the scroller rather than children of it, and the
	reason nothing here animates by wrapping something in a transformed div. It is
	also the single most likely way a consumer breaks this library, so a screen
	claiming to be a realistic integration has to respect it visibly.
-->
<div class="app" data-scheme={scheme}>
	<div class="wallpaper" style={coverStyle(nowPlaying)} aria-hidden="true"></div>
	<div class="veil" aria-hidden="true"></div>

	<main class="scroller" bind:this={scroller}>
		<h1 class="large-title" bind:this={largeTitle}>Listen Now</h1>

		<section class="hero">
			<div class="hero-art" style={coverStyle(ALBUMS[0])} aria-hidden="true"></div>
			<div class="hero-body">
				<p class="eyebrow">Album of the day</p>
				<h2>Nocturne Bleu</h2>
				<p class="hero-artist">Camille Ardent · 2026 · 9 titres</p>
				<!--
					Small glass directly on artwork: the case a calm gradient backdrop
					flatters and this one does not.
				-->
				<div class="hero-actions">
					<LiquidButton tone="prominent" {quality} {variant} onclick={() => (playing = true)}>
						<Play size={16} /> Lire
					</LiquidButton>
					<LiquidButton {quality} {variant}>
						<Shuffle size={16} /> Aléatoire
					</LiquidButton>
					<LiquidMenu
						items={MENU_ITEMS}
						triggerShape="circle"
						{variant}
						{quality}
						menuLabel="Album actions"
					>
						<Ellipsis size={18} />
					</LiquidMenu>
				</div>
			</div>
		</section>

		<section class="shelf">
			<h3>Écoutés récemment</h3>
			<div class="row">
				{#each ALBUMS.slice(0, 6) as album (album.id)}
					<button
						class="card"
						type="button"
						onclick={() => (nowPlaying = album)}
						aria-label="Lire {album.title}"
					>
						<span class="cover" style={coverStyle(album)}></span>
						<span class="card-title">{album.title}</span>
						<span class="card-artist">{album.artist}</span>
					</button>
				{/each}
			</div>
		</section>

		<section class="shelf">
			<h3>Conçu pour vous</h3>
			<div class="row">
				{#each ALBUMS.slice(6) as album (album.id)}
					<button
						class="card"
						type="button"
						onclick={() => (nowPlaying = album)}
						aria-label="Lire {album.title}"
					>
						<span class="cover" style={coverStyle(album)}></span>
						<span class="card-title">{album.title}</span>
						<span class="card-artist">{album.artist}</span>
					</button>
				{/each}
			</div>
		</section>

		<!--
			The reason the track list is here at all: 13px text with thin strokes, which
			scrolls under the player slab. If the rim antialias is doing anything, this
			is where it shows, and if the refraction crawls, this is where it is
			unbearable.
		-->
		<section class="tracks">
			<h3>Nocturne Bleu — titres</h3>
			<ol>
				{#each TRACKS as track (track.id)}
					<li>
						<span class="track-no">{track.id}</span>
						<span class="track-title">{track.title}</span>
						<span class="track-artist">{track.artist}</span>
						<span class="track-time">{track.duration}</span>
					</li>
				{/each}
			</ol>
			<p class="filler">
				Le reste de la page existe pour qu'il y ait quelque chose à faire défiler sous le lecteur.
				Faire défiler refiltre chaque surface de verre à chaque frame — c'est la mesure qui compte,
				et elle demande du contenu réel plutôt qu'une mire.
			</p>
		</section>
	</main>

	<div class="nav">
		<LiquidNavBar
			title="Listen Now"
			titleTarget={largeTitle}
			{scroller}
			{scheme}
			position="fixed"
			mode="auto"
		>
			{#snippet leading()}
				<LiquidButton shape="circle" {quality} {variant} aria-label="Recherche">
					<Search size={17} />
				</LiquidButton>
			{/snippet}
			{#snippet trailing()}
				<LiquidButton
					shape="circle"
					{quality}
					{variant}
					aria-label="Ajouter aux favoris"
					onclick={() => (liked = !liked)}
				>
					<Heart size={17} fill={liked ? 'currentColor' : 'none'} />
				</LiquidButton>
			{/snippet}
		</LiquidNavBar>
	</div>

	<!--
		The mini player: one wide, short slab, which is the geometry the count ladder
		on `/bench` is structurally unable to price. Controls inside it are plain — not
		a stylistic choice but a structural one, since `backdrop-filter` does not
		compose: a glass button on a glass panel refracts the panel's output, not the
		artwork, and reads as a dead patch. iOS does the same thing for the same
		reason.
	-->
	<!--
		Outside the glass, and not merely for tidiness: an `<audio>` element inside a
		`.lg` would be one more child the content flex has to size around, and the
		player's layout is already the thing this screen is most sensitive about.
	-->
	<audio
		bind:this={audio}
		src="/audio/in-that-future-bass.mp3"
		preload="metadata"
		ontimeupdate={() => (elapsed = audio?.currentTime ?? 0)}
		onloadedmetadata={() => (duration = audio?.duration ?? 0)}
		onended={() => (playing = false)}
		onerror={() => (hasAudio = false)}
	></audio>

	<div class="player">
		<LiquidGlass
			height={72}
			borderRadius={26}
			bezel={16}
			{quality}
			{variant}
			interactive
			class="player-glass"
		>
			<div class="player-inner">
				<span class="player-art" style={coverStyle(nowPlaying)} aria-hidden="true"></span>
				<span class="player-meta">
					<span class="player-line">
						<span class="player-title">{nowPlaying.title}</span>
						<span class="player-artist">{nowPlaying.artist}</span>
					</span>
					<!--
						In flow rather than absolutely positioned against the slab. An
						absolute line has to be inset past a 26px corner and a 16px bezel to
						avoid sitting *inside* the refraction band, and what is left is a
						line that looks mispositioned because it is — it clears the geometry
						instead of belonging to the layout. A row in the metadata column
						cannot collide with either.
					-->
					<span class="player-scrub">
						<span class="player-time">{clock(hasAudio ? elapsed : progress * 214)}</span>
						<span
							class="player-track"
							role="slider"
							tabindex="0"
							aria-label="Position de lecture"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={Math.round(progress * 100)}
							onclick={seek}
							onkeydown={(event) => {
								if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
								event.preventDefault();
								const step = event.key === 'ArrowLeft' ? -5 : 5;
								if (audio && hasAudio && duration > 0)
									audio.currentTime = Math.min(duration, Math.max(0, audio.currentTime + step));
								else syntheticProgress = Math.min(1, Math.max(0, syntheticProgress + step / 214));
							}}
						>
							<span class="player-fill" style="width: {progress * 100}%"></span>
						</span>
						<span class="player-time">{clock(hasAudio ? duration : 214)}</span>
					</span>
				</span>
				<span class="player-controls">
					<button type="button" aria-label="Titre précédent"><SkipBack size={18} /></button>
					<button
						type="button"
						class="play"
						aria-label={playing ? 'Pause' : 'Lecture'}
						onclick={toggle}
					>
						{#if playing}<Pause size={20} />{:else}<Play size={20} />{/if}
					</button>
					<button type="button" aria-label="Titre suivant"><SkipForward size={18} /></button>
				</span>
			</div>
		</LiquidGlass>
	</div>

	<div class="tabbar">
		<LiquidTabs
			tabs={TABS}
			bind:value={tab}
			label="Sections"
			{quality}
			{variant}
			iconPlacement="top"
		/>
	</div>
</div>

{#if !chromeHidden}
	<FpsMeter />
{/if}

{#if chromeHidden}
	<!-- nothing: the screen stands on its own until Ctrl is pressed again -->
{:else if showPanel}
	<aside class="devpanel">
		<header>
			<strong>écran de test</strong>
			<button type="button" onclick={() => (showPanel = false)}>masquer</button>
		</header>
		<label>
			<span>tier — {glassSupport.detected ?? '…'}</span>
			<select bind:value={tierOverride}>
				<option value="auto">auto</option>
				<option value="full">full</option>
				<option value="degraded">degraded</option>
				<option value="flat">flat</option>
			</select>
		</label>
		<label>
			<span>quality</span>
			<select bind:value={quality}>
				<option value="low">low — ni spec ni rim</option>
				<option value="medium">medium — spec + rim</option>
				<option value="high">high — 3 passes</option>
			</select>
		</label>
		<label>
			<span>variant</span>
			<select bind:value={variant}>
				<option value="regular">regular — blur 6</option>
				<option value="clear">clear — blur 0.5</option>
			</select>
		</label>
		<label>
			<span>scheme</span>
			<select bind:value={scheme}>
				<option value="dark">dark</option>
				<option value="light">light</option>
			</select>
		</label>
		<p>
			~8 surfaces. Faire défiler la liste sous le lecteur, puis comparer
			<code>regular</code>/<code>clear</code> et <code>medium</code>/<code>low</code>.
		</p>
		<p><code>Ctrl</code> masque / réaffiche ce panneau et le compteur de fps.</p>
		<p class="links">
			<a href={resolve('/bench')}>bench</a> · <a href={resolve('/probe')}>probe</a> ·
			<a href={resolve('/demo')}>gallery</a>
		</p>
	</aside>
{:else}
	<button type="button" class="devshow" onclick={() => (showPanel = true)}>contrôles</button>
{/if}

<style>
	/*
	 * `.app` and `.scroller` are load-bearing *by what they do not have*. No
	 * transform, no filter, no opacity, no isolation — see the comment on the markup.
	 * Anything added here that creates a backdrop root turns every surface below into
	 * a flat tint, and it fails silently.
	 */
	.app {
		position: relative;
		min-height: 100vh;
		color: #f6f7fb;
		font-family:
			'Inter Variable',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}

	.app[data-scheme='light'] {
		color: #12131a;
	}

	.wallpaper {
		position: fixed;
		inset: 0;
		z-index: -2;
	}

	/*
	 * A scrim between the artwork and the content, so body text stays legible over a
	 * saturated cover. Its alpha is baked into the colour rather than applied with
	 * `opacity`, which would make this element a backdrop root — it sits below the
	 * glass, not above it, but the habit is the point.
	 */
	.veil {
		position: fixed;
		inset: 0;
		z-index: -1;
		background: linear-gradient(
			180deg,
			rgb(8 9 14 / 0.72) 0%,
			rgb(8 9 14 / 0.86) 38%,
			rgb(8 9 14 / 0.94) 100%
		);
	}

	.app[data-scheme='light'] .veil {
		background: linear-gradient(
			180deg,
			rgb(248 248 250 / 0.7) 0%,
			rgb(248 248 250 / 0.88) 38%,
			rgb(248 248 250 / 0.95) 100%
		);
	}

	.scroller {
		max-width: 74rem;
		margin: 0 auto;
		/* Top: navbar. Bottom: player slab + tab bar, both fixed. */
		padding: 5.5rem 1.5rem 12rem;
	}

	.large-title {
		margin: 0 0 1.75rem;
		font-size: 2.1rem;
		font-weight: 700;
		letter-spacing: -0.025em;
	}

	/* ------------------------------------------------------------------ hero --- */

	.hero {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		gap: 1.5rem;
		align-items: center;
		margin-bottom: 2.5rem;
		padding: 1.25rem;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 22px;
		background: rgb(255 255 255 / 0.05);
	}

	.app[data-scheme='light'] .hero {
		border-color: rgb(0 0 0 / 0.1);
		background: rgb(255 255 255 / 0.5);
	}

	.hero-art {
		aspect-ratio: 1;
		border-radius: 14px;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #ff5f6d;
	}

	.hero-body h2 {
		margin: 0 0 0.3rem;
		font-size: 1.6rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.hero-artist {
		margin: 0 0 1.1rem;
		font-size: 0.85rem;
		opacity: 0.7;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}

	/* ----------------------------------------------------------------- shelves --- */

	.shelf {
		margin-bottom: 2.25rem;
	}

	h3 {
		margin: 0 0 0.9rem;
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: -0.015em;
	}

	.row {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 1rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.cover {
		aspect-ratio: 1;
		margin-bottom: 0.5rem;
		border-radius: 12px;
	}

	.card-title {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.card-artist {
		font-size: 0.78rem;
		opacity: 0.62;
	}

	/* ----------------------------------------------------------------- tracks --- */

	.tracks ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tracks li {
		display: grid;
		grid-template-columns: 1.75rem minmax(0, 2fr) minmax(0, 1.5fr) auto;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.55rem 0.25rem;
		border-bottom: 1px solid rgb(128 128 128 / 0.18);
		/* 13px with thin strokes — the frequency the rim undersamples. */
		font-size: 0.8125rem;
	}

	.track-no {
		opacity: 0.45;
		font-variant-numeric: tabular-nums;
	}

	.track-title {
		font-weight: 600;
	}

	.track-artist,
	.track-time {
		opacity: 0.6;
	}

	.track-time {
		font-variant-numeric: tabular-nums;
	}

	.filler {
		max-width: 42rem;
		margin: 1.5rem 0 0;
		font-size: 0.85rem;
		line-height: 1.65;
		opacity: 0.62;
	}

	/* ----------------------------------------------------------------- chrome --- */

	.nav {
		position: fixed;
		inset: 0 0 auto;
		z-index: 20;
	}

	.player {
		position: fixed;
		right: 0;
		bottom: 5.25rem;
		left: 0;
		z-index: 25;
		display: flex;
		justify-content: center;
		padding: 0 1.5rem;
		pointer-events: none;
	}

	/*
	 * `width` is left to CSS rather than passed as a prop so the slab tracks the
	 * viewport. `LiquidGlass` measures itself through the shared `ResizeObserver` and
	 * quantises what it finds, so a drag-resize steps through a handful of cached
	 * maps instead of rasterising per frame — the same reason `/bench` can sweep tile
	 * scale without the map counter moving.
	 */
	.player :global(.player-glass) {
		width: min(68rem, 100%);
		pointer-events: auto;
	}

	/*
	 * `.lg-content` is `display: flex` and sized by its children, so a `width: 100%`
	 * child inside it resolves against a box that is only as wide as itself — the
	 * layout collapses to its intrinsic width and centres, and anything positioned
	 * against it lands somewhere that looks arbitrary. That was the real cause of the
	 * misplaced progress line, not the line's own rules.
	 *
	 * Reaching into a library class from a consumer is a liberty, and it is taken
	 * deliberately rather than by passing `width` as a prop: the slab tracks the
	 * viewport, and a measured pixel width handed back in would defeat the
	 * `ResizeObserver` path that quantises sizes into cached maps.
	 */
	.player :global(.player-glass > .lg-content) {
		width: 100%;
	}

	.player-inner {
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr) auto;
		gap: 0.9rem;
		align-items: center;
		width: 100%;
		padding: 0 1rem;
	}

	.player-art {
		aspect-ratio: 1;
		border-radius: 9px;
	}

	.player-meta {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.28rem;
	}

	.player-line {
		display: flex;
		overflow: hidden;
		min-width: 0;
		gap: 0.45rem;
		align-items: baseline;
		white-space: nowrap;
	}

	.player-title {
		overflow: hidden;
		font-size: 0.88rem;
		font-weight: 650;
		text-overflow: ellipsis;
	}

	.player-artist {
		overflow: hidden;
		font-size: 0.78rem;
		text-overflow: ellipsis;
		opacity: 0.62;
	}

	.player-scrub {
		display: flex;
		gap: 0.55rem;
		align-items: center;
	}

	.player-time {
		min-width: 2.4em;
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.55;
	}

	.player-time:last-child {
		text-align: right;
	}

	/*
	 * The hit area is taller than the line: a 3px target is unusable, and padding the
	 * box while keeping the visible rule thin is what a real scrubber does. The rule
	 * itself is drawn by the child, so the padding never shows.
	 */
	.player-track {
		flex: 1;
		min-width: 0;
		height: 3px;
		border-radius: 999px;
		background: rgb(128 128 128 / 0.38);
		cursor: pointer;
	}

	.player-track:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 4px;
	}

	.player-fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: currentColor;
	}

	.player-controls {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	.player-controls button {
		display: grid;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: inherit;
		cursor: pointer;
		place-items: center;
	}

	.player-controls button:hover {
		background: rgb(128 128 128 / 0.2);
	}

	.player-controls .play {
		width: 40px;
		height: 40px;
	}

	.tabbar {
		position: fixed;
		right: 0;
		bottom: 1rem;
		left: 0;
		z-index: 25;
		display: flex;
		justify-content: center;
		padding: 0 1.5rem;
	}

	/* --------------------------------------------------------------- devpanel --- */

	.devpanel,
	.devshow {
		position: fixed;
		bottom: 1rem;
		left: 1rem;
		z-index: 100;
		border: 1px solid rgb(255 255 255 / 0.16);
		border-radius: 12px;
		background: rgb(8 9 15 / 0.88);
		color: #f4f6fa;
		font-family: inherit;
		font-size: 0.75rem;
	}

	.devpanel {
		display: flex;
		width: 15rem;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
	}

	.devpanel header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.devpanel header button,
	.devshow {
		padding: 0.2rem 0.5rem;
		border: 1px solid rgb(128 128 128 / 0.4);
		border-radius: 7px;
		background: rgb(255 255 255 / 0.06);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.devshow {
		padding: 0.35rem 0.7rem;
	}

	.devpanel label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.devpanel label > span {
		font-size: 0.62rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		opacity: 0.6;
	}

	.devpanel select {
		padding: 0.25rem 0.4rem;
		border: 1px solid rgb(128 128 128 / 0.35);
		border-radius: 7px;
		background: rgb(0 0 0 / 0.4);
		color: inherit;
		font: inherit;
		font-size: 0.72rem;
	}

	.devpanel p {
		margin: 0;
		font-size: 0.68rem;
		line-height: 1.5;
		opacity: 0.68;
	}

	.devpanel code {
		padding: 0.05em 0.28em;
		border-radius: 4px;
		background: rgb(128 128 128 / 0.25);
	}

	.devpanel a {
		color: inherit;
		text-underline-offset: 3px;
	}

	@media (max-width: 52rem) {
		.hero {
			grid-template-columns: 1fr;
		}

		.hero-art {
			max-width: 200px;
		}
	}
</style>
