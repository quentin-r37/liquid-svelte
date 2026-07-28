import { highlight } from './_lib/highlight.server.js';
import type { PageServerLoad } from './$types.js';

const INSTALL = `npm install liquid-svelte motion`;

const QUICK_START = `<script lang="ts">
	import { LiquidGlass } from 'liquid-svelte';
</script>

<LiquidGlass width={280} height={140} borderRadius={48} bezel={26} interactive>
	<p>Refracted content</p>
</LiquidGlass>`;

const TIER_OVERRIDE = `import { setGlassModeOverride, glassSupport } from 'liquid-svelte';

// Force one tier everywhere — 'auto' or null returns to detection.
setGlassModeOverride('degraded');

// Or per component: <LiquidButton mode="flat">…</LiquidButton>
console.log(glassSupport.tier); // 'full' | 'degraded' | 'flat'`;

export const load: PageServerLoad = async () => {
	return {
		install: await highlight(INSTALL, 'sh'),
		quickStart: { html: await highlight(QUICK_START, 'svelte'), raw: QUICK_START },
		tierOverride: { html: await highlight(TIER_OVERRIDE, 'ts'), raw: TIER_OVERRIDE }
	};
};
