# liquid-svelte

Liquid Glass components for Svelte 5 — real SVG displacement refraction, specular highlights and
Motion-driven springs, modelled on iOS 26's glass material.

Where most "glassmorphism" libraries stop at `blur() saturate()`, this one builds an actual optical
pipeline: a signed-distance field of the element's silhouette, full vector Snell refraction across a
configurable bezel, and a per-instance SVG displacement filter applied through
`backdrop-filter: url(#…)`. The centre of the surface stays perfectly stable; the rim bends the
backdrop like glass does.

## Components

| Component | What it is |
| --- | --- |
| `LiquidGlass` | The primitive — a refracting glass surface everything else composes |
| `LiquidButton` | Button in three sizes, `prominent` tone, circle/capsule shapes |
| `LiquidSwitch` | Toggle with a glass droplet knob |
| `LiquidSlider` | Slider with velocity stretch on the thumb |
| `LiquidTabs` | ARIA tabs with a glass bubble that morphs between tab items |
| `LiquidMenu` | Menu that spreads open from its trigger like a puddle |
| `LiquidSearchField` | Search field that morphs open from a compact anchor |
| `LiquidToolbar` | Expanding toolbar with staged item rise |
| `LiquidNavBar` | Top or bottom navigation bar |
| `LiquidScrollEdge` | Progressive blur at a scroll container's edges |
| `LiquidCard` | Content card on the glass material |
| `LiquidPopover` | Anchored popover with puddle rise |
| `LiquidDialog` | Modal dialog / sheet presentations |
| `LiquidLens` | A magnifying lens that follows the pointer |

## Installation

```sh
npm install liquid-svelte
```

Peer dependencies: `svelte ^5.20` and `motion ^12` (used through its vanilla APIs — no wrapper).

## Quick start

```svelte
<script lang="ts">
	import { LiquidGlass, LiquidButton } from 'liquid-svelte';
</script>

<LiquidGlass width={280} height={140} borderRadius={48} bezel={26} interactive>
	<p>Refracted content</p>
</LiquidGlass>

<LiquidButton size="lg" tone="prominent" onclick={() => console.log('pressed')}>
	Press me
</LiquidButton>
```

The stylesheet is imported automatically by the components. If your bundler needs an explicit
import, it is also exposed as `liquid-svelte/liquid-glass.css`.

`displacement` is intentionally left unset above — it defaults to four times the bezel, which is
what the effect actually needs.

## Browser support — the three tiers

True refraction requires `backdrop-filter: url(#filter)`, which **only Chromium implements**.
Firefox and Safari claim support via `CSS.supports` and then paint nothing, and no web API can read
back composited pixels to check — so the library detects the engine and resolves one of three tiers
per instance:

- **`full`** — SVG displacement refraction, chromatic aberration, specular rim. Chromium only.
- **`degraded`** — plain `backdrop-filter: blur() saturate()`. Also the SSR tier, so server and
  client markup agree.
- **`flat`** — no backdrop filtering at all; a denser tint keeps content legible.

Every component accepts a `mode` prop (`'auto' | 'full' | 'degraded' | 'flat'`) to force a tier,
and `setGlassModeOverride()` forces one globally.

## `LiquidGlass` props

| Prop | Default | Description |
| --- | --- | --- |
| `width`, `height` | measured | Fixed size in CSS px; omit to size from content via a shared `ResizeObserver` |
| `borderRadius` | token | Corner radius; large values clamp to a pill |
| `cornerShape` | `'round'` | `'round'`, `'continuous'` (Apple's curve), `'squircle'`, or a superellipse `K` — needs `corner-shape` support (Chromium 139+), falls back to `round` |
| `bezel` | token | Thickness of the refracting rim; refraction is concentrated here |
| `variant` | `'regular'` | `'regular'` (frosted, what iOS builds controls from) or `'clear'` (transparent, for surfaces over media) |
| `profile` | token | Surface height profile: `'convex-squircle'`, `'convex-circle'`, `'concave'`, `'lip'` |
| `displacement` | `bezel × 4` | Peak refraction offset in px — animatable live |
| `blur`, `opacity`, `saturation` | from `variant` | Material optics; an explicit prop overrides the variant's default |
| `chromaticAberration` | `0`–`0.2` | Per-channel displacement spread; `0` disables the 3-pass chain |
| `specularIntensity` | token | Strength of the bright rim, `0`–`1` — animatable live |
| `shadowIntensity` | token | Outer drop shadow, `0`–`1` |
| `quality` | `'medium'` | `'low'`, `'medium'` or `'high'` — map resolution vs per-frame GPU cost |
| `mode` | `'auto'` | Force a rendering tier |
| `interactive` | `false` | Track the pointer and expose `--pointer-*` custom properties |
| `tag` | `'div'` | Host element tag, so wrappers keep native semantics |

### Geometry vs optics — what animates for free

Geometry (`width`, `height`, `radius`, `bezel`, `profile`, `resolution`) regenerates the
displacement texture and is cached in an LRU behind quantised sizes. Optics (`displacement`,
`blur`, `saturation`, `chromaticAberration`, `specularIntensity`) are live SVG filter attributes —
animatable at 60fps without ever touching a canvas. The droplet morphs and gesture springs live
entirely on the live side of that line.

## Things that will bite you

- **Transformed ancestors kill the refraction** (Chromium bug 1194050). Glass placed inside a
  wrapper that has a CSS `transform` silently loses its `backdrop-filter`. The library keeps its own
  transforms and filters on the same element for this reason, but it cannot fix a transformed
  ancestor in *your* tree.
- **Backdrop roots.** An ancestor with `filter`, `opacity < 1`, `mask`, `clip-path`,
  `mix-blend-mode` or `isolation: isolate` limits what the glass can see through to.
- **Nested glass does not compose** — an inner `backdrop-filter` only sees the outer one's output.
  This is a platform limitation, not a library one.

## Development

The repo is both the library (`src/lib`, packaged from `src/lib/index.ts`) and its demo app
(`src/routes`).

```sh
npm install
npm run dev      # demo app
npm run check    # svelte-check — the automated gate
npm run package  # build dist/ from src/lib
```

Useful routes while developing:

- `/demo` — component gallery with a tier switch
- `/docs` — per-component documentation with live examples
- `/probe` — optics harness: every primitive prop on a slider, plus live map-cache counters
- `/bench` — frame-time benchmark

There is no test runner; `npm run check` plus the browser harnesses are how changes get validated.

## License

MIT
