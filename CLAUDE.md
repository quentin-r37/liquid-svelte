# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev          # SvelteKit dev server (demo + probe routes)
npm run check        # svelte-kit sync && svelte-check — the only automated gate
npm run check:watch  # same, watching
npm run lint         # prettier --check . && eslint .
npm run format       # prettier --write .
npm run build        # build the demo app
npm run package      # svelte-kit sync && svelte-package && publint — builds dist/ from src/lib
```

There is **no test runner configured** — no vitest/playwright, no `test` script. `npm run check` plus the two
browser harnesses (`/probe`, `/demo`) are how changes get validated. Don't invent a `npm test`; if a change
needs verification, run `check` and say which harness route exercises it.

## What this repo is

Two things in one tree:

- **The library** — `src/lib/`. `svelte-package` builds `dist/` from `src/lib/index.ts`, which re-exports
  `src/lib/liquid-glass/index.ts`. That file is the entire public API: an explicit, curated list of
  re-exports. Anything new that consumers should reach must be added there, or it does not exist.
- **The demo app** — `src/routes/`. `/probe` is the optics harness (every primitive prop on a slider, plus
  live map-cache counters); `/demo` is the component gallery with a tier switch. Both are dev-only surfaces,
  not shipped.

## Rendering architecture

`LiquidGlass.svelte` is the primitive; every other component (`LiquidButton`, `LiquidSwitch`,
`LiquidSlider`, `LiquidTabs`, `LiquidLens`, `LiquidMenu`) composes it. Understanding the pipeline requires reading four
files together: `LiquidGlass.svelte` → `displacement/createDisplacementMap.ts` → `displacement/surfaceProfiles.ts`
→ `LiquidGlassFilter.svelte`.

**Three tiers, resolved per instance** (`GlassTier` in `liquidGlass.types.ts`):

- `full` — SVG displacement filter referenced from `backdrop-filter: url(#id)`. **Chromium only.**
- `degraded` — plain CSS `blur() saturate()`. Also the SSR tier, so server and client markup agree.
- `flat` — no backdrop filtering; a denser tint carries legibility.

`runtime/capabilities.svelte.ts` decides. It is a _heuristic_, not a feature test — Firefox and WebKit
report `CSS.supports('backdrop-filter', 'url(#x)') === true` and then paint nothing, and no web API can read
back composited pixels. So detection = syntax check + Chromium engine check, with escape hatches (`mode`
prop per component, `setGlassModeOverride()` globally). Detection runs in an `$effect` so first client render
matches SSR.

**The map pipeline:** geometry → `roundedBoxSdf.ts` (signed distance + analytic normal, mirroring CSS
`border-radius` exactly so there is no seam) → `surfaceProfiles.ts` (per-profile 1-D LUT of refraction
magnitude, built from full vector Snell refraction, cached per profile for the page) → per-pixel paint into a
PNG data URL → LRU cache in `displacement/mapCache.ts` (one shared scratch canvas, all synchronous) →
`<feImage href>` inside the filter.

### The invariant that matters most

Geometry regenerates textures; optics do not. Only `width`, `height`, `radius`, `bezel`, `profile` and
`resolution` are part of the cache key. `displacement`, `blur`, `saturation`, `chromaticAberration` and
`specularIntensity` are **live filter attributes**, animatable at 60fps without touching a canvas. This is
what makes the droplet morph (`runtime/dropletMorph.svelte.ts`) viable. When adding a feature, keep it on the
live side of that line — anything that ends up in the cache key and then gets animated will rasterise per
frame.

Sizes are quantised (`SIZE_QUANTUM`) before becoming cache keys, so a continuous resize steps rather than
thrashes. `sharedResizeObserver.ts` gives the whole page one `ResizeObserver`.

## Non-obvious constraints

**Backdrop roots.** `backdrop-filter` only sees down to its nearest backdrop root, and an ancestor becomes
one the moment it has `filter`, `opacity < 1`, `mask`, `clip-path`, `mix-blend-mode`, `isolation: isolate`,
or a `will-change` naming any of those. `.lg` must carry **none** of them or the glass vanishes. Hence: tint
opacity baked into colour alphas rather than the `opacity` property; blending and masking only on layers
painted _above_ the refraction. Nested `backdrop-filter` also does not compose — the inner one only
sees the outer one's output — which is why switch/slider tracks are plain translucent CSS, not glass.

Chromium adds an off-spec one: a **transformed ancestor** kills it too (crbug 1194050). Since
`glassTransform.ts` puts a live `transform` on `.lg` for every hover, press and drag, the refraction cannot
live on a child layer — `backdrop-filter` is declared on `.lg` itself, so the transform and the filter share
one element. Moving it back onto a `.lg-refraction` child silently limits refraction to surfaces that never
move. The same trap applies to consumers: glass inside a transformed wrapper loses its refraction, and the
library cannot fix that from the inside.

**Never bind the `style` attribute for library-owned inline properties.** Svelte rewrites `element.style.cssText`
wholesale when the attribute changes, wiping the `--pointer-*` properties written by `pointerTracking.ts` and
the `transform` written by Motion. Everything the library owns goes through `runtime/applyGlassStyle.ts`
(`setProperty`, called from an `$effect` — deliberately _not_ an attachment, since attachments tear down and
re-add every property per frame). The consumer-supplied `style` prop is the documented exception.

**One transform per element, many gestures.** `runtime/glassTransform.ts` owns `element.style.transform`.
Hover, press, drag, velocity-stretch and the per-axis reveal (`revealX`/`revealY`, used by `LiquidMenu`'s
puddle spread) each animate their own Motion channel; one `transformValue` composes them and `styleEffect`
flushes once per frame. If a gesture wrote `style.transform` directly the last writer
would win. Channels are reference-counted per element (`acquireGlassTransform` / `release`), so acquisition
belongs in its own `$effect` — re-acquiring on every state change tears the transform down mid-animation.
`will-change: transform` is only set while a gesture is in flight.

**Constants live in the token files, not in components.** `runtime/glassTokens.ts` (optics, geometry, cache
limits, droplet endpoints) and `runtime/motionTokens.ts` (named springs, gesture magnitudes). Both are
heavily commented with _why_ each value is what it is — several look wrong until you read the comment
(`DISPLACEMENT_PER_BEZEL = 4` yields a ~96px peak offset for a 24px bezel and is correct;
`DROPLET_REST.blur = 0.05` rather than `0` keeps the filter chain structurally stable across the morph).
Read the comment before changing a number.

## Conventions

- **Runes are forced** for all non-`node_modules` files via `compilerOptions.runes` in `vite.config.ts`.
  Modules using runes outside components take the `.svelte.ts` suffix (`capabilities.svelte.ts`,
  `dropletMorph.svelte.ts`).
- **Relative imports carry `.js` extensions** (`./glassTokens.js` from a `.ts` file) — required for the
  packaged output. Match this in new files.
- Peer deps are `svelte ^5.20` and `motion ^12`. Motion is used through its _vanilla_ APIs (`animate`,
  `hover`, `press`, `motionValue`, `styleEffect`, `frame`), never a Svelte wrapper.
- `$props.id()` supplies per-instance ids so SVG filter ids stay unique and SSR-stable.
- Prettier: tabs, single quotes, no trailing commas, 100 columns.
- Comments in this codebase explain _why_, at length, and assume the reader knows what the code does. Match
  that register — it is the main thing preserving the reasoning behind the optics.
